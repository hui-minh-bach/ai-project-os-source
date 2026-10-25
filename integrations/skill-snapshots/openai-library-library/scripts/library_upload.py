#!/usr/bin/env python3
# ruff: noqa: TID251
import json
import mimetypes
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterator
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import TypeVar

# Managed runtimes can enable PYTHONSAFEPATH, which omits the script directory
# even for an absolute entrypoint. Only bundled sibling modules are added.
SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

from library_file_transfer import (  # noqa: E402
    LibraryFileMaterializer,
    LibraryFileTransferError,
    _NoAuthenticatedRedirect,
    include_library_file_id_xattr,
    parse_xattrs,
    require_object,
    require_string,
)
from library_hosted_apps import (  # noqa: E402
    HostedAppsClient,
    HostedAppsError,
    HostedAppsToolError,
)


class LibraryUploadError(Exception):
    pass


_LIBRARY_CONNECTOR_ID = "connector_openai_library"
_LIBRARY_ARTIFACT_TYPES = {"other", "image", "image_gen", "report", "sheet", "slides"}
_APP_BATCH_SIZE = 20
_DEFAULT_TRANSFER_CONCURRENCY = 20
_SMALL_TRANSFER_CONCURRENCY = 100
_SMALL_FILE_BYTES = 1024 * 1024
_SMALL_BATCH_BYTES = 100 * 1024 * 1024
_ESTUARY_UPLOAD_PATH = "/backend-api/estuary/upload_content_bytes"
_ESTUARY_UPLOAD_TIMEOUT_SECONDS = 300
_MAX_SHARED_UPLOAD_BYTES = 512 * 1024 * 1024
_LIBRARY_FILE_WRITE_RECEIPT_PREFIX = "__OPENAI_LIBRARY_FILE_WRITE_RECEIPT_V1__="
_SHARED_PREPARE_FALLBACK_ERRORS = {
    "Library prepare_uploads is not available",
    "prepare_uploads failed",
}
T = TypeVar("T")


@dataclass(frozen=True)
class UploadRequest:
    index: int
    local_path: Path
    purpose: str
    library_file_id: str | None
    library_file_name: str | None
    directory_id: str | None
    expected_current_version: int | None
    version_reason: str | None
    size_bytes: int
    mime_type: str | None
    library_artifact_type: str | None
    is_shared: bool

    @classmethod
    def parse(
        cls,
        value: object,
        index: int,
    ) -> "UploadRequest":
        payload = require_object(value, f"uploads[{index}]")
        unexpected_keys = set(payload) - {
            "local_path",
            "purpose",
            "library_file_id",
            "library_file_name",
            "directory_id",
            "expected_current_version",
            "version_reason",
            "is_shared",
            "library_artifact_type",
        }
        if unexpected_keys:
            raise LibraryUploadError(f"uploads[{index}] contains unsupported fields")

        local_path = Path(require_string(payload.get("local_path"), f"uploads[{index}].local_path"))
        if not local_path.is_absolute():
            raise LibraryUploadError(f"uploads[{index}].local_path must be absolute")
        if not local_path.is_file():
            raise LibraryUploadError(f"uploads[{index}].local_path must name a file")

        purpose = require_string(payload.get("purpose"), f"uploads[{index}].purpose")
        if purpose not in {"create_library_file", "replace_library_file"}:
            raise LibraryUploadError(f"uploads[{index}].purpose is unsupported")

        library_artifact_type = cls._optional_string(
            payload.get("library_artifact_type"),
            f"uploads[{index}].library_artifact_type",
        )
        if library_artifact_type is not None:
            if library_artifact_type not in _LIBRARY_ARTIFACT_TYPES:
                raise LibraryUploadError(f"uploads[{index}].library_artifact_type is unsupported")
            if purpose != "create_library_file":
                raise LibraryUploadError("Replacement uploads cannot change library_artifact_type")

        library_file_id = cls._optional_string(
            payload.get("library_file_id"),
            f"uploads[{index}].library_file_id",
        )
        library_file_name = cls._optional_string(
            payload.get("library_file_name"),
            f"uploads[{index}].library_file_name",
        )
        directory_id = cls._optional_string(
            payload.get("directory_id"),
            f"uploads[{index}].directory_id",
        )
        expected_current_version = cls._optional_version(
            payload.get("expected_current_version"),
            f"uploads[{index}].expected_current_version",
        )
        version_reason = cls._optional_string(
            payload.get("version_reason"),
            f"uploads[{index}].version_reason",
        )
        is_shared = payload.get("is_shared", False)
        if not isinstance(is_shared, bool):
            raise LibraryUploadError(f"uploads[{index}].is_shared must be a boolean")
        if purpose == "replace_library_file" and library_file_id is None:
            raise LibraryUploadError(f"uploads[{index}] replacement requires library_file_id")
        if purpose == "create_library_file" and (
            library_file_id is not None
            or library_file_name is not None
            or expected_current_version is not None
            or version_reason is not None
            or is_shared
        ):
            raise LibraryUploadError(f"uploads[{index}] create cannot include replacement metadata")

        mime_type, _ = mimetypes.guess_type(local_path.name)
        size_bytes = local_path.stat().st_size
        if is_shared:
            if size_bytes > _MAX_SHARED_UPLOAD_BYTES:
                raise LibraryUploadError(f"uploads[{index}] exceeds the maximum shared upload size")
            if expected_current_version is None:
                try:
                    stored_id, stored_version = (
                        bytes.fromhex(
                            subprocess.run(
                                ["/usr/bin/xattr", "-px", name, local_path],
                                check=True,
                                capture_output=True,
                                text=True,
                            ).stdout
                        )
                        if sys.platform == "darwin"
                        else os.getxattr(local_path, name)
                        for name in ("user.library-file-id", "user.library-file-version")
                    )
                    if (
                        stored_id != (library_file_id or "").encode()
                        or not stored_version.isdigit()
                        or len(stored_version) > 19
                    ):
                        raise ValueError
                    expected_current_version = int(stored_version)
                    if (
                        expected_current_version > 2**63 - 1
                        or stored_version != str(expected_current_version).encode()
                    ):
                        raise ValueError
                except (
                    AttributeError,
                    NotImplementedError,
                    OSError,
                    subprocess.CalledProcessError,
                    ValueError,
                ):
                    raise LibraryUploadError(
                        f"uploads[{index}] shared replacement requires expected_current_version"
                    ) from None
            if directory_id is not None:
                raise LibraryUploadError(f"uploads[{index}] shared replacement cannot move files")
        return cls(
            index=index,
            local_path=local_path,
            purpose=purpose,
            library_file_id=library_file_id,
            library_file_name=library_file_name,
            directory_id=directory_id,
            expected_current_version=expected_current_version,
            version_reason=version_reason,
            size_bytes=size_bytes,
            mime_type=mime_type,
            library_artifact_type=library_artifact_type,
            is_shared=is_shared,
        )

    @property
    def prepare_payload(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "file_name": self.local_path.name,
            "purpose": self.purpose,
            "file_size_bytes": self.size_bytes,
            "workspace_path": str(self.local_path),
        }
        if self.mime_type is not None:
            payload["mime_type"] = self.mime_type
        if self.library_artifact_type is not None:
            payload["library_artifact_type"] = self.library_artifact_type
        if self.is_shared:
            payload["file_name"] = self.library_file_name or self.local_path.name
            payload["library_file_id"] = self.library_file_id
            payload["expected_current_version"] = self.expected_current_version
        return payload

    @staticmethod
    def _optional_string(value: object, label: str) -> str | None:
        if value is None:
            return None
        return require_string(value, label)

    @staticmethod
    def _optional_version(value: object, label: str) -> int | None:
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise LibraryUploadError(f"{label} must be a non-negative integer")
        return value


@dataclass(frozen=True)
class PreparedUpload:
    request: UploadRequest
    payload: dict[str, object]
    transfer_mode: str

    @classmethod
    def parse(
        cls,
        request: UploadRequest,
        value: object,
    ) -> "PreparedUpload":
        payload = require_object(value, f"uploads[{request.index}] result")
        fields = {
            name: payload[name]
            for name in (
                "upload_session_id",
                "file_id",
                "file_name",
                "upload_url",
                "workspace_path",
                "method",
                "required_headers",
                "purpose",
                "store_in_library",
                "mime_type",
                "library_artifact_type",
                "file_size_bytes",
                "library_file_id",
                "expected_current_version",
                "shared_library_upload",
                "pdf_c2pa_upload",
            )
            if name in payload
        }
        for name in ("upload_session_id", "file_id", "file_name"):
            require_string(fields.get(name), f"prepared upload {name}")
        purpose = require_string(fields.get("purpose"), "prepared upload purpose")
        if purpose != request.purpose:
            raise LibraryUploadError("prepare_uploads returned a mismatched purpose")
        if fields.get("library_artifact_type") != request.library_artifact_type:
            raise LibraryUploadError("prepare_uploads returned a mismatched library_artifact_type")
        if not isinstance(fields.get("store_in_library"), bool):
            raise LibraryUploadError("prepare_uploads omitted its retention mode")
        if request.is_shared:
            if fields.get("shared_library_upload") is not True:
                raise LibraryUploadError("prepare_uploads omitted the shared upload marker")
            if fields.get("library_file_id") != request.library_file_id:
                raise LibraryUploadError("prepare_uploads returned a mismatched shared file")
            version = UploadRequest._optional_version(
                fields.get("expected_current_version"),
                "prepared shared upload version",
            )
            if version != request.expected_current_version:
                raise LibraryUploadError("prepare_uploads returned a mismatched shared version")
            if fields["store_in_library"] or fields.get("pdf_c2pa_upload", False) is not False:
                raise LibraryUploadError("prepare_uploads returned an invalid shared upload")
        elif fields.get("shared_library_upload") is not None:
            raise LibraryUploadError("prepare_uploads returned an unexpected shared upload marker")
        if fields.get("method", "PUT") != "PUT":
            raise LibraryUploadError("prepare_uploads returned an unsupported method")

        upload_url = fields.get("upload_url")
        workspace_path = fields.get("workspace_path")
        if (upload_url is None) == (workspace_path is None):
            raise LibraryUploadError("prepare_uploads must return exactly one transfer mode")
        if upload_url is not None:
            require_string(upload_url, "prepared upload URL")
            raw_headers = require_object(
                fields.get("required_headers", {}),
                "prepared upload headers",
            )
            fields["required_headers"] = {
                name: require_string(value, f"prepared upload header {name!r}")
                for name, value in raw_headers.items()
            }
            transfer_mode = "upload_url"
        else:
            path = Path(require_string(workspace_path, "prepared workspace path"))
            if not path.is_absolute():
                raise LibraryUploadError("prepared workspace path must be absolute")
            transfer_mode = "workspace_path"
        return cls(request=request, payload=fields, transfer_mode=transfer_mode)

    @property
    def finalize_payload(self) -> dict[str, object]:
        payload = dict(self.payload)
        if self.request.directory_id is not None:
            payload["directory_id"] = self.request.directory_id
        if self.request.purpose == "replace_library_file":
            payload["library_file_id"] = self.request.library_file_id
            if self.request.expected_current_version is not None:
                payload["expected_current_version"] = self.request.expected_current_version
            if self.request.version_reason is not None:
                payload["version_reason"] = self.request.version_reason
        return payload


class SignedUrlUploader:
    """Transfer signed-URL items without exposing their transport details."""

    def upload(
        self,
        uploads: tuple[PreparedUpload, ...],
        state_directory: Path,
    ) -> set[int]:
        if not uploads:
            return set()
        executable: str | None = None
        environment: dict[str, str] = {}
        if any(not self._is_estuary_upload(upload) for upload in uploads):
            executable = shutil.which("azcopy")
            if executable is None and Path("/usr/local/bin/azcopy").is_file():
                executable = "/usr/local/bin/azcopy"
            if executable is not None:
                logs_directory = state_directory / "logs"
                jobs_directory = state_directory / "jobs"
                logs_directory.mkdir(mode=0o700)
                jobs_directory.mkdir(mode=0o700)
                environment = {
                    **os.environ,
                    "AZCOPY_LOG_LOCATION": str(logs_directory),
                    "AZCOPY_JOB_PLAN_LOCATION": str(jobs_directory),
                    "AZCOPY_CONCURRENCY_VALUE": os.environ.get(
                        "AZCOPY_CONCURRENCY_VALUE",
                        "16",
                    ),
                }
        worker_count = min(len(uploads), self._concurrency(uploads))
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures: dict[Future[bool], int] = {
                executor.submit(
                    self._upload_one,
                    executable,
                    upload,
                    state_directory,
                    environment,
                ): upload.request.index
                for upload in uploads
            }
            return {index for future, index in futures.items() if future.result()}

    @staticmethod
    def _concurrency(uploads: tuple[PreparedUpload, ...]) -> int:
        if (
            all(upload.request.size_bytes < _SMALL_FILE_BYTES for upload in uploads)
            and sum(upload.request.size_bytes for upload in uploads) < _SMALL_BATCH_BYTES
        ):
            return _SMALL_TRANSFER_CONCURRENCY
        return _DEFAULT_TRANSFER_CONCURRENCY

    @staticmethod
    def _upload_one(
        executable: str | None,
        upload: PreparedUpload,
        state_directory: Path,
        environment: dict[str, str],
    ) -> bool:
        if SignedUrlUploader._is_estuary_upload(upload):
            return SignedUrlUploader._upload_estuary(upload)
        if executable is None:
            return False
        upload_url = require_string(upload.payload.get("upload_url"), "prepared upload URL")
        destination = urllib.parse.urlsplit(upload_url)
        required_headers = require_object(
            upload.payload.get("required_headers", {}), "prepared upload headers"
        )
        transfer_options: list[str] = []
        if (
            destination.scheme == "https"
            and (destination.hostname or "").endswith(".oaiusercontent.com")
            and any(
                name.lower() == "x-ms-blob-type" and value == "BlockBlob"
                for name, value in required_headers.items()
            )
        ):
            # Public aliases need an explicit Azure type and requests below the edge size limit.
            # This selects transport options for the returned URL; it grants no destination access.
            transfer_options = [
                "--from-to=LocalBlob",
                "--blob-type=BlockBlob",
                "--block-size-mb=64",
                "--put-blob-size-mb=64",
            ]
        log_path = state_directory / f"transfer-{upload.request.index}.log"
        try:
            with log_path.open("xb") as output:
                result = subprocess.run(
                    [
                        executable,
                        "copy",
                        str(upload.request.local_path),
                        upload_url,
                        "--overwrite=true",
                        "--output-type=json",
                        *transfer_options,
                    ],
                    check=False,
                    env=environment,
                    stdout=output,
                    stderr=subprocess.STDOUT,
                )
        except OSError:
            return False
        return result.returncode == 0

    @staticmethod
    def _is_estuary_upload(upload: PreparedUpload) -> bool:
        destination = urllib.parse.urlsplit(
            require_string(upload.payload.get("upload_url"), "prepared upload URL")
        )
        hosted_apps = urllib.parse.urlsplit(
            os.environ.get("CODEX_APPS_MCP_URL", "https://chatgpt.com/backend-api/wham/apps")
        )
        try:
            same_origin = (
                destination.hostname,
                443 if destination.port is None else destination.port,
            ) == (
                hosted_apps.hostname,
                443 if hosted_apps.port is None else hosted_apps.port,
            )
        except ValueError:
            return False
        return (
            destination.scheme == hosted_apps.scheme == "https"
            and same_origin
            and destination.username is None
            and destination.password is None
            and destination.path == _ESTUARY_UPLOAD_PATH
            and not destination.fragment
        )

    @staticmethod
    def _upload_estuary(upload: PreparedUpload) -> bool:
        upload_url = require_string(upload.payload.get("upload_url"), "prepared upload URL")
        required_headers = require_object(
            upload.payload.get("required_headers", {}),
            "prepared upload headers",
        )
        headers = {
            "Content-Length": str(upload.request.size_bytes),
            **{
                name: require_string(value, f"prepared upload header {name!r}")
                for name, value in required_headers.items()
            },
        }
        if upload.request.mime_type is not None:
            headers.setdefault("Content-Type", upload.request.mime_type)
        try:
            with upload.request.local_path.open("rb") as body:
                request = urllib.request.Request(
                    upload_url, data=body, headers=headers, method="PUT"
                )
                with urllib.request.urlopen(
                    request,
                    timeout=_ESTUARY_UPLOAD_TIMEOUT_SECONDS,
                    context=HostedAppsClient._ssl_context(),
                ) as response:
                    response.read()
                    return 200 <= response.status < 300
        except OSError:
            return False


class LibraryUploadWorkflow:
    def __init__(
        self,
        apps_client: HostedAppsClient,
        materializer: LibraryFileMaterializer,
        uploader: SignedUrlUploader,
        *,
        state_parent: Path = Path("/tmp"),
    ) -> None:
        self.apps_client = apps_client
        self.materializer = materializer
        self.uploader = uploader
        self.state_parent = state_parent
        self._publish_all_receipts = False

    def run(self, value: object) -> dict[str, object]:
        requests = self._parse_requests(value)
        self._publish_all_receipts = len(requests) <= _APP_BATCH_SIZE
        prepared, prepare_failures, prepare_fallbacks = self._prepare(requests)

        results: list[dict[str, object] | None] = [
            prepare_failures.get(index) for index in range(len(requests))
        ]
        url_uploads = tuple(upload for upload in prepared if upload.transfer_mode == "upload_url")
        with tempfile.TemporaryDirectory(
            prefix="openai-library-upload-",
            dir=self.state_parent,
        ) as state_directory_value:
            transferred_url_indices = (
                self.uploader.upload(
                    url_uploads,
                    Path(state_directory_value),
                )
                if url_uploads
                else set()
            )

            for upload in url_uploads:
                if upload.request.index not in transferred_url_indices:
                    results[upload.request.index] = {
                        "local_path": str(upload.request.local_path),
                        "purpose": upload.request.purpose,
                        "status": "failed",
                        "error_code": "transfer_failed",
                        "message": "file transfer failed",
                    }

            prepared_by_index = {
                upload.request.index: upload
                for upload in prepared
                if upload.transfer_mode == "workspace_path"
                or upload.request.index in transferred_url_indices
            }
            pending: list[PreparedUpload] = []
            for request in requests:
                if not request.is_shared:
                    if (upload := prepared_by_index.get(request.index)) is not None:
                        pending.append(upload)
                    continue
                for upload, result in self._finalize(tuple(pending)):
                    results[upload.request.index] = self._result(upload, result)
                pending.clear()
                if (shared_upload := prepared_by_index.get(request.index)) is None:
                    if request.index in prepare_failures:
                        continue
                    if request.index in prepare_fallbacks or results[request.index] is not None:
                        results[request.index] = self._shared_result(request)
                    continue
                try:
                    finalized = self._finalize((shared_upload,))
                except HostedAppsError as error:
                    if str(error) != "finalize_uploads failed":
                        raise
                    finalized = [
                        (
                            shared_upload,
                            {
                                "operation": request.purpose,
                                "status": "failed",
                                "error_code": "operation_failed",
                            },
                        )
                    ]
                for upload, result in finalized:
                    shared_result = self._result(upload, result)
                    if (
                        shared_result.get("status") == "failed"
                        and shared_result.get("error_code") == "operation_failed"
                    ):
                        shared_result = self._shared_result(request)
                        if shared_result.get("status") != "succeeded":
                            shared_result["error_code"] = "commit_unknown"
                            shared_result["message"] = "Library finalization failed"
                    results[upload.request.index] = shared_result
            for upload, result in self._finalize(tuple(pending)):
                results[upload.request.index] = self._result(upload, result)

        if any(result is None for result in results):
            raise LibraryUploadError("upload results are incomplete")
        return {"results": [result for result in results if result is not None]}

    def _parse_requests(self, value: object) -> tuple[UploadRequest, ...]:
        payload = require_object(value, "upload request")
        if set(payload) != {"uploads"}:
            raise LibraryUploadError("upload request must contain only uploads")
        uploads_value = payload.get("uploads")
        if not isinstance(uploads_value, list) or not uploads_value:
            raise LibraryUploadError("uploads must be a non-empty array")
        return tuple(
            UploadRequest.parse(upload, index) for index, upload in enumerate(uploads_value)
        )

    def _prepare(
        self,
        requests: tuple[UploadRequest, ...],
    ) -> tuple[
        tuple[PreparedUpload, ...],
        dict[int, dict[str, object]],
        frozenset[int],
    ]:
        prepared: list[PreparedUpload] = []
        failures: dict[int, dict[str, object]] = {}
        fallbacks: set[int] = set()
        for batch in self._prepare_batches(requests):
            try:
                response = self.apps_client.call_tool(
                    _LIBRARY_CONNECTOR_ID,
                    "prepare_uploads",
                    {"uploads": [request.prepare_payload for request in batch]},
                )
            except HostedAppsError as error:
                request = batch[0] if len(batch) == 1 and batch[0].is_shared else None
                if request is not None and isinstance(error, HostedAppsToolError):
                    conflict_result = self._prepare_conflict_result(request, error)
                    if conflict_result is not None:
                        failures[request.index] = conflict_result
                        continue
                if request is not None and str(error) in _SHARED_PREPARE_FALLBACK_ERRORS:
                    fallbacks.add(request.index)
                else:
                    raise
                continue
            values = self._result_array(response, "uploads")
            if len(values) != len(batch):
                raise LibraryUploadError("prepare_uploads returned an unexpected number of uploads")
            prepared.extend(
                PreparedUpload.parse(request, value)
                for request, value in zip(batch, values, strict=True)
            )
        return tuple(prepared), failures, frozenset(fallbacks)

    def _prepare_conflict_result(
        self,
        request: UploadRequest,
        error: HostedAppsToolError,
    ) -> dict[str, object] | None:
        if not request.is_shared:
            return None
        structured_content = error.result.get("structuredContent")
        if not isinstance(structured_content, dict):
            return None
        error_data = structured_content.get("error_data")
        if (
            not isinstance(error_data, dict)
            or error_data.get("code") != "conflict"
            or error_data.get("reason") != "version_conflict"
        ):
            return None
        return self._failed_result(
            request,
            {
                "operation": request.purpose,
                "status": "failed",
                "error_code": "conflict",
                "error_data": error_data,
            },
        )

    @classmethod
    def _prepare_batches(
        cls,
        requests: tuple[UploadRequest, ...],
    ) -> tuple[tuple[UploadRequest, ...], ...]:
        batches: list[tuple[UploadRequest, ...]] = []
        pending: list[UploadRequest] = []
        for request in requests:
            if request.is_shared:
                batches.extend(cls._batches(tuple(pending)))
                pending.clear()
                batches.append((request,))
            else:
                pending.append(request)
        batches.extend(cls._batches(tuple(pending)))
        return tuple(batches)

    def _finalize(
        self,
        uploads: tuple[PreparedUpload, ...],
    ) -> list[tuple[PreparedUpload, dict[str, object]]]:
        finalized: list[tuple[PreparedUpload, dict[str, object]]] = []
        for batch in self._batches(uploads):
            response = self.apps_client.call_tool(
                _LIBRARY_CONNECTOR_ID,
                "finalize_uploads",
                {"uploads": [upload.finalize_payload for upload in batch]},
            )
            values = self._result_array(response, "results")
            if len(values) != len(batch):
                raise LibraryUploadError(
                    "finalize_uploads returned an unexpected number of results"
                )
            finalized.extend(
                (upload, require_object(value, "finalize upload result"))
                for upload, value in zip(batch, values, strict=True)
            )
        return finalized

    def _shared_result(self, request: UploadRequest) -> dict[str, object]:
        endpoint = urllib.parse.urlsplit(
            os.environ.get("CODEX_APPS_MCP_URL", "https://chatgpt.com/backend-api/wham/apps")
        )
        if endpoint.scheme != "https" or endpoint.netloc not in {
            "chatgpt.com",
            "chatgpt-staging.com",
        }:
            raise LibraryUploadError("shared replacement requires the official ChatGPT origin")
        library_file_id = require_string(request.library_file_id, "shared library_file_id")
        url = (
            f"https://{endpoint.netloc}/backend-api/files/library/shared/files/"
            f"{urllib.parse.quote(library_file_id, safe='')}"
        )
        headers: dict[str, str] = {"X-OpenAI-Library-Work-Replacement": "1"}
        authorization = os.environ.get("CODEX_APPS_AUTHORIZATION", "").strip()
        account_id = os.environ.get("CODEX_APPS_CHATGPT_ACCOUNT_ID", "").strip()
        if not authorization and not os.environ.get("CODEX_CONNECTORS_TOKEN", "").strip():
            try:
                token, auth_account_id = HostedAppsClient._auth_file_tokens()
                if token and token != "access_token":
                    authorization = f"Bearer {token}"
                    account_id = account_id or auth_account_id or ""
            except (HostedAppsError, OSError):
                pass
        if authorization:
            headers["Authorization"] = authorization
            if account_id:
                headers["ChatGPT-Account-ID"] = account_id
        opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=HostedAppsClient._ssl_context()),
            _NoAuthenticatedRedirect(),
        )
        boundary = os.urandom(16).hex()
        prefix = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; '
            f"filename={json.dumps(request.local_path.name, ensure_ascii=False)}\r\n"
            f"Content-Type: {request.mime_type or 'application/octet-stream'}\r\n\r\n"
        ).encode()
        suffix = f"\r\n--{boundary}--\r\n".encode()

        def content() -> Iterator[bytes]:
            with request.local_path.open("rb") as source:
                initial = os.fstat(source.fileno())
                remaining = request.size_bytes
                if initial.st_size != remaining:
                    raise LibraryUploadError("shared replacement file changed")
                initial_state = (initial.st_size, initial.st_mtime_ns)
                yield prefix
                while remaining and (chunk := source.read(min(1024 * 1024, remaining))):
                    remaining -= len(chunk)
                    yield chunk
                final = os.fstat(source.fileno())
                if remaining or (final.st_size, final.st_mtime_ns) != initial_state:
                    raise LibraryUploadError("shared replacement file changed")
                yield suffix

        upload = PreparedUpload(request=request, payload={}, transfer_mode="workspace_path")
        method = "POST"
        try:
            upload_request = urllib.request.Request(
                f"{url}/upload",
                data=content(),
                headers={
                    **headers,
                    "Content-Type": f"multipart/form-data; boundary={boundary}",
                    "Content-Length": str(len(prefix) + request.size_bytes + len(suffix)),
                },
                method=method,
            )
            # Shared PDFs bypass C2PA signing; add signing in a follow-up.
            with opener.open(upload_request, timeout=_ESTUARY_UPLOAD_TIMEOUT_SECONDS) as response:
                staged = require_object(json.loads(response.read()), "shared upload result")
            body: dict[str, object] = {
                "source_file_id": require_string(staged.get("source_file_id"), "shared source id"),
                "expected_current_version": request.expected_current_version,
            }
            if request.version_reason is not None:
                body["version_reason"] = request.version_reason
            method = "PATCH"
            commit_request = urllib.request.Request(
                url,
                data=json.dumps(body, separators=(",", ":")).encode(),
                headers={**headers, "Content-Type": "application/json"},
                method=method,
            )
            with opener.open(commit_request, timeout=_ESTUARY_UPLOAD_TIMEOUT_SECONDS) as response:
                updated = require_object(json.loads(response.read()), "shared replacement result")
            if require_string(updated.get("id"), "shared replacement id") != library_file_id:
                raise LibraryUploadError("shared replacement returned a mismatched file")
            version = UploadRequest._optional_version(
                updated.get("current_version_number"),
                "shared replacement version",
            )
            if (
                version is None
                or request.expected_current_version is None
                or version != request.expected_current_version + 1
            ):
                raise LibraryUploadError("shared replacement returned an unexpected version")
            return self._result(
                upload,
                {
                    "operation": request.purpose,
                    "status": "succeeded",
                    "file_id": library_file_id,
                    "library_file_id": library_file_id,
                    "file_name": request.library_file_name or request.local_path.name,
                    "current_version_number": version,
                    "xattrs": [{"name": "user.library-file-version", "value": str(version)}],
                },
            )
        except urllib.error.HTTPError as error:
            error_code = {
                401: "access_denied",
                403: "access_denied",
                404: "not_found",
                409: "version_conflict",
            }.get(
                error.code,
                "commit_unknown" if method == "PATCH" and error.code >= 500 else "operation_failed",
            )
        except (OSError, LibraryFileTransferError, LibraryUploadError, json.JSONDecodeError):
            error_code = "commit_unknown" if method == "PATCH" else "transfer_failed"
        return self._result(
            upload,
            {"operation": request.purpose, "status": "failed", "error_code": error_code},
        )

    def _result(
        self,
        upload: PreparedUpload,
        value: dict[str, object],
    ) -> dict[str, object]:
        status = require_string(value.get("status"), "finalize upload status")
        operation = require_string(
            value.get("operation"),
            "finalize upload operation",
        )
        if operation != upload.request.purpose:
            raise LibraryUploadError("finalize_uploads returned a mismatched operation")
        if status == "failed":
            return self._failed_result(upload.request, value)
        if status != "succeeded":
            raise LibraryUploadError("finalize_uploads returned an unsupported status")

        library_file_id = require_string(
            value.get("library_file_id"),
            "finalize upload library_file_id",
        )
        file_id = require_string(value.get("file_id"), "finalize upload file_id")
        if upload.request.is_shared:
            if library_file_id != upload.request.library_file_id or file_id != library_file_id:
                raise LibraryUploadError("finalize_uploads returned a mismatched shared file")
            current_version = value.get("current_version_number")
            expected_version = upload.request.expected_current_version
            if (
                expected_version is None
                or isinstance(current_version, bool)
                or not isinstance(current_version, int)
                or current_version != expected_version + 1
            ):
                raise LibraryUploadError("finalize_uploads returned a mismatched shared version")
        metadata_applied = True
        try:
            self.materializer.apply_xattrs(
                include_library_file_id_xattr(
                    parse_xattrs(value.get("xattrs", [])),
                    library_file_id,
                ),
                upload.request.local_path,
            )
        except (LibraryFileTransferError, OSError):
            metadata_applied = False

        result: dict[str, object] = {
            "local_path": str(upload.request.local_path),
            "purpose": upload.request.purpose,
            "status": "succeeded",
            "file_id": file_id,
            "library_file_id": library_file_id,
            "file_name": require_string(
                value.get("file_name"),
                "finalize upload file_name",
            ),
            "local_metadata_applied": metadata_applied,
        }
        path = value.get("path")
        if path is not None:
            result["path"] = require_string(path, "finalize upload path")
        current_version = value.get("current_version_number")
        if current_version is not None:
            if (
                isinstance(current_version, bool)
                or not isinstance(current_version, int)
                or current_version < 0
            ):
                raise LibraryUploadError("finalize upload version must be a non-negative integer")
            result["current_version_number"] = current_version
        warnings = value.get("warnings")
        if warnings is not None:
            if not isinstance(warnings, list):
                raise LibraryUploadError("finalize upload warnings must be an array")
            result["warnings"] = [
                require_string(warning, "finalize upload warning") for warning in warnings
            ]
        if not upload.request.is_shared and (
            self._publish_all_receipts or upload.payload.get("pdf_c2pa_upload") is True
        ):
            try:
                receipt = json.dumps(
                    {
                        "sandbox_path": str(upload.request.local_path),
                        "file_id": result["file_id"],
                        "library_file_id": library_file_id,
                    },
                    separators=(",", ":"),
                )
                sys.stderr.write(f"{_LIBRARY_FILE_WRITE_RECEIPT_PREFIX}{receipt}\n")
                sys.stderr.flush()
            except (OSError, ValueError):
                pass
        return result

    @staticmethod
    def _failed_result(
        request: UploadRequest,
        value: dict[str, object],
    ) -> dict[str, object]:
        error_code = require_string(
            value.get("error_code"),
            "finalize upload error code",
        )
        result: dict[str, object] = {
            "local_path": str(request.local_path),
            "purpose": request.purpose,
            "status": "failed",
            "error_code": error_code,
            "message": (
                "Library file version conflict."
                if error_code == "version_conflict"
                else "Library finalization failed"
            ),
        }
        error_data = value.get("error_data")
        if (
            error_code == "conflict"
            and isinstance(error_data, dict)
            and error_data.get("reason") == "version_conflict"
        ):
            conflict: dict[str, object] = {
                "code": "conflict",
                "reason": "version_conflict",
                "failure_stage": "version_check",
                "retryable": False,
                "recovery": "refresh_and_reapply",
            }
            for field in ("expected_current_version", "current_version_number"):
                version = error_data.get(field)
                conflict[field] = version if type(version) is int and version >= 0 else None
            result["error_data"] = conflict
            result["message"] = (
                "Library file version conflict. Refresh the Library file and reapply your changes "
                "only if still valid; do not retry the stale write."
            )
        return result

    @staticmethod
    def _result_array(value: object, field: str) -> list[object]:
        payload = require_object(value, "hosted app result")
        structured_content = payload.get("structuredContent")
        if structured_content is not None:
            result = require_object(
                structured_content,
                "hosted app structured content",
            ).get(field)
            if not isinstance(result, list):
                raise LibraryUploadError(f"{field} must be an array")
            return result

        content = payload.get("content")
        if isinstance(content, list):
            for index, item in enumerate(content):
                try:
                    content_item = require_object(item, f"content[{index}]")
                    text_payload = require_object(
                        json.loads(
                            require_string(
                                content_item.get("text"),
                                f"content[{index}].text",
                            )
                        ),
                        f"content[{index}].text payload",
                    )
                    result = text_payload.get(field)
                    if not isinstance(result, list):
                        continue
                    return result
                except (json.JSONDecodeError, LibraryFileTransferError):
                    continue
        raise LibraryUploadError(f"hosted app result does not contain {field}")

    @staticmethod
    def _batches(values: tuple[T, ...]) -> tuple[tuple[T, ...], ...]:
        return tuple(
            values[offset : offset + _APP_BATCH_SIZE]
            for offset in range(0, len(values), _APP_BATCH_SIZE)
        )


def main(argv: list[str]) -> int:
    if argv:
        print("usage: library_upload.py < request.json", file=sys.stderr)
        return 2
    if sys.stdin.isatty():
        print(
            "library upload failed: stdin must be closed after one JSON request",
            file=sys.stderr,
        )
        return 2
    try:
        try:
            request = json.load(sys.stdin)
        except json.JSONDecodeError as exc:
            raise LibraryUploadError("stdin must contain valid JSON") from exc
        result = LibraryUploadWorkflow(
            apps_client=HostedAppsClient(),
            materializer=LibraryFileMaterializer(),
            uploader=SignedUrlUploader(),
        ).run(request)
        print(json.dumps(result, separators=(",", ":")))
    except (
        HostedAppsError,
        LibraryFileTransferError,
        LibraryUploadError,
        OSError,
    ) as exc:
        print(f"library upload failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
