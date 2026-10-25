#!/usr/bin/env python3
import json
import sys
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

# Managed runtimes can enable PYTHONSAFEPATH, which omits the script directory
# even for an absolute entrypoint. Only bundled sibling modules are added.
SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

from library_file_transfer import (  # noqa: E402
    DownloadCompletionReporter,
    LibraryFileMaterializer,
    LibraryFileTransfer,
    LibraryFileTransferError,
    include_library_file_id_xattr,
    parse_xattrs,
    require_object,
    require_string,
)
from library_hosted_apps import HostedAppsClient, HostedAppsError  # noqa: E402


class LibraryDownloadRequestError(Exception):
    pass


_LIBRARY_CONNECTOR_ID = "connector_openai_library"
_PREPARE_MATERIALIZE_BATCH_SIZE = 20
_MAX_PARALLEL_PREPARE_MATERIALIZE_BATCHES = 4


class ListOrSearchResult:
    def __init__(self, entries: list[object]) -> None:
        self.entries = entries

    @classmethod
    def parse(cls, value: str) -> "ListOrSearchResult":
        try:
            decoded: object = json.loads(value)
        except json.JSONDecodeError as exc:
            raise LibraryDownloadRequestError("list/search result must be valid JSON") from exc
        payload = cls._find_payload(decoded)
        has_items = "items" in payload
        has_results = "results" in payload
        if has_items == has_results:
            raise LibraryDownloadRequestError(
                "list/search output must contain exactly one of items or results"
            )
        entries_value = payload["items" if has_items else "results"]
        if not isinstance(entries_value, list):
            raise LibraryDownloadRequestError("items/results must be a JSON array")
        if not has_items:
            title_entries = payload.get("retrieval_title_results")
            if title_entries is None:
                title_entries = []
            if not isinstance(title_entries, list):
                raise LibraryDownloadRequestError("retrieval_title_results must be a JSON array")
            entries_value = [*entries_value, *title_entries]
        return cls(entries=entries_value)

    @classmethod
    def _find_payload(cls, value: object) -> dict[str, object]:
        payload = require_object(value, "list/search output")
        if "items" in payload or "results" in payload:
            return payload

        for wrapper_key in ("structuredContent", "result"):
            wrapped = payload.get(wrapper_key)
            if wrapped is not None:
                try:
                    return cls._find_payload(wrapped)
                except (LibraryDownloadRequestError, LibraryFileTransferError):
                    pass

        content = payload.get("content")
        if isinstance(content, list):
            for index, item in enumerate(content):
                try:
                    content_item = require_object(item, f"content[{index}]")
                    text = require_string(
                        content_item.get("text"),
                        f"content[{index}].text",
                    )
                    nested: object = json.loads(text)
                    return cls._find_payload(nested)
                except (
                    json.JSONDecodeError,
                    LibraryDownloadRequestError,
                    LibraryFileTransferError,
                ):
                    continue

        raise LibraryDownloadRequestError("list/search output does not contain items or results")


@dataclass(frozen=True)
class IndexSelection:
    indices: tuple[int, ...] | None

    @classmethod
    def parse(cls, value: str) -> "IndexSelection":
        if value == "ALL":
            return cls(indices=None)
        if not value or not value.isdigit() or len(value) % 3 != 0:
            raise LibraryDownloadRequestError(
                'selection must be "ALL" or digits grouped in triples'
            )
        indices: list[int] = []
        seen: set[int] = set()
        for offset in range(0, len(value), 3):
            index = int(value[offset : offset + 3])
            if index not in seen:
                indices.append(index)
                seen.add(index)
        return cls(indices=tuple(indices))

    def resolve(self, entries: list[object]) -> tuple[int, ...]:
        if self.indices is None:
            return tuple(
                index
                for index, entry in enumerate(entries)
                if not LibraryEntry.parse(entry, index).is_folder
            )
        for index in self.indices:
            if index >= len(entries):
                raise LibraryDownloadRequestError(
                    f"selected index {index:03d} is outside the {len(entries)} returned entries"
                )
            if LibraryEntry.parse(entries[index], index).is_folder:
                raise LibraryDownloadRequestError(
                    f"selected index {index:03d} is a folder, not a downloadable file"
                )
        return self.indices


@dataclass(frozen=True)
class LibraryEntry:
    payload: dict[str, object]
    metadata: dict[str, object]
    index: int

    @classmethod
    def parse(cls, value: object, index: int) -> "LibraryEntry":
        payload = require_object(value, f"entry[{index}]")
        metadata_value = payload.get("metadata")
        metadata = (
            require_object(metadata_value, f"entry[{index}].metadata")
            if metadata_value is not None
            else {}
        )
        return cls(payload=payload, metadata=metadata, index=index)

    @property
    def is_folder(self) -> bool:
        return self.payload.get("kind", self.metadata.get("kind")) == "folder"

    def materialize_item(self) -> dict[str, object]:
        result: dict[str, object] = {
            "file_id": self._required_string(
                self.payload.get("file_id"),
                self.metadata.get("file_id"),
                self.payload.get("id"),
                self.metadata.get("id"),
                label="file id",
            ),
            "file_name": self._required_string(
                self.payload.get("name"),
                self.metadata.get("name"),
                label="file name",
            ),
        }
        library_file_id = self._optional_string(
            self.payload.get("library_file_id"),
            self.metadata.get("library_file_id"),
            label="library file id",
        )
        if library_file_id is not None:
            result["library_file_id"] = library_file_id
        return result

    def relative_path(self) -> Path:
        library_path = self.library_path()
        relative_path = library_path.relative_to("/")
        if not relative_path.parts:
            raise LibraryDownloadRequestError(
                f"entry[{self.index}] Library path does not name a file"
            )
        return Path(*relative_path.parts)

    def deduplication_key(self) -> tuple[str, ...]:
        library_file_id = self._optional_string(
            self.payload.get("library_file_id"),
            self.metadata.get("library_file_id"),
            label="library file id",
        )
        if library_file_id is not None:
            return ("library_file_id", library_file_id)
        file_id = self._required_string(
            self.payload.get("file_id"),
            self.metadata.get("file_id"),
            self.payload.get("id"),
            self.metadata.get("id"),
            label="file id",
        )
        return ("file_id_and_path", file_id, self.library_path().as_posix())

    def library_path(self) -> PurePosixPath:
        value = self._required_string(
            self.payload.get("path"),
            self.metadata.get("path"),
            label="Library path",
        )
        path = PurePosixPath(value)
        if not path.is_absolute() or ".." in path.parts:
            raise LibraryDownloadRequestError(
                f"entry[{self.index}] Library path must be absolute and normalized"
            )
        return path

    def _required_string(self, *values: object, label: str) -> str:
        result = self._optional_string(*values, label=label)
        if result is None:
            raise LibraryDownloadRequestError(f"entry[{self.index}] {label} is missing")
        return result

    def _optional_string(self, *values: object, label: str) -> str | None:
        for value in values:
            if value is not None:
                return require_string(value, f"entry[{self.index}] {label}")
        return None


@dataclass(frozen=True)
class MaterializePlan:
    items: tuple[dict[str, object], ...]
    destination: dict[str, object]

    @property
    def arguments(self) -> dict[str, object]:
        return {
            "items": list(self.items),
            "destination": self.destination,
        }

    def batches(
        self,
        batch_size: int,
    ) -> tuple["MaterializeBatch", ...]:
        if batch_size < 1:
            raise LibraryDownloadRequestError("materialize batch size must be positive")
        return tuple(
            MaterializeBatch(
                items=self.items[offset : offset + batch_size],
                destination=self.destination,
            )
            for offset in range(0, len(self.items), batch_size)
        )


@dataclass(frozen=True)
class MaterializeBatch:
    items: tuple[dict[str, object], ...]
    destination: dict[str, object]

    @property
    def arguments(self) -> dict[str, object]:
        return {
            "items": list(self.items),
            "destination": self.destination,
        }


class MaterializeRequestBuilder:
    def build(
        self,
        list_or_search_json: str,
        selection: str,
        destination: "DownloadDestination | None" = None,
    ) -> dict[str, object]:
        return self.build_plan(
            list_or_search_json,
            selection,
            destination,
        ).arguments

    def build_plan(
        self,
        list_or_search_json: str,
        selection: str,
        destination: "DownloadDestination | None" = None,
    ) -> MaterializePlan:
        result = ListOrSearchResult.parse(list_or_search_json)
        indices = IndexSelection.parse(selection).resolve(result.entries)
        entries: list[LibraryEntry] = []
        identities: set[tuple[str, ...]] = set()
        # Selection addresses the raw search order. Collapse repeated primary and
        # supplemental hits only afterward so model-visible indices stay stable.
        for index in indices:
            entry = LibraryEntry.parse(result.entries[index], index)
            identity = entry.deduplication_key()
            if identity not in identities:
                entries.append(entry)
                identities.add(identity)
        relative_paths = tuple(entry.relative_path() for entry in entries)
        materialize_directory = Path.cwd().resolve()
        if destination is not None:
            destination.prepare()
            materialize_directory = destination.path
        items: list[dict[str, object]] = []
        for entry, relative_path in zip(entries, relative_paths, strict=True):
            item = entry.materialize_item()
            if relative_path.parent != Path("."):
                item["relative_directory"] = relative_path.parent.as_posix()
            items.append(item)
        return MaterializePlan(
            items=tuple(items),
            destination={
                "directory": str(materialize_directory),
            },
        )


@dataclass(frozen=True)
class DownloadDestination:
    working_directory: Path
    relative_path: Path

    @classmethod
    def parse(cls, value: str) -> "DownloadDestination":
        relative_path = Path(value)
        if not value or relative_path.is_absolute() or relative_path == Path("."):
            raise LibraryDownloadRequestError(
                "the destination directory must be a non-empty relative path"
            )
        if ".." in relative_path.parts:
            raise LibraryDownloadRequestError("the destination directory cannot contain '..'")
        working_directory = Path.cwd().resolve()
        path = (working_directory / relative_path).resolve()
        if not path.is_relative_to(working_directory):
            raise LibraryDownloadRequestError(
                "the destination directory must remain inside the working directory"
            )
        return cls(
            working_directory=working_directory,
            relative_path=relative_path,
        )

    @property
    def path(self) -> Path:
        return self.working_directory / self.relative_path

    def prepare(self) -> None:
        self.path.mkdir(parents=True, exist_ok=True)


class PrepareMaterializeResult:
    def __init__(self, transfers: list[dict[str, object]]) -> None:
        self.transfers = transfers

    @classmethod
    def parse(cls, value: object) -> "PrepareMaterializeResult":
        payload = cls._find_payload(value)
        transfers_value = payload.get("transfers")
        if not isinstance(transfers_value, list):
            raise LibraryDownloadRequestError("transfers must be a JSON array")
        return cls(
            transfers=[
                require_object(transfer, f"transfers[{index}]")
                for index, transfer in enumerate(transfers_value)
            ]
        )

    @classmethod
    def _find_payload(cls, value: object) -> dict[str, object]:
        payload = require_object(value, "prepare_materialize output")
        if "transfers" in payload:
            return payload
        for wrapper_key in ("structuredContent", "result"):
            wrapped = payload.get(wrapper_key)
            if wrapped is not None:
                try:
                    return cls._find_payload(wrapped)
                except (LibraryDownloadRequestError, LibraryFileTransferError):
                    pass
        content = payload.get("content")
        if isinstance(content, list):
            for index, item in enumerate(content):
                try:
                    content_item = require_object(item, f"content[{index}]")
                    nested: object = json.loads(
                        require_string(
                            content_item.get("text"),
                            f"content[{index}].text",
                        )
                    )
                    return cls._find_payload(nested)
                except (
                    json.JSONDecodeError,
                    LibraryDownloadRequestError,
                    LibraryFileTransferError,
                ):
                    continue
        raise LibraryDownloadRequestError("prepare_materialize output does not contain transfers")


@dataclass(frozen=True)
class PreparedMaterializeBatch:
    transfers: tuple[dict[str, object], ...]

    @classmethod
    def from_result(
        cls,
        batch: MaterializeBatch,
        result: PrepareMaterializeResult,
        batch_index: int,
    ) -> "PreparedMaterializeBatch":
        expected_count = len(batch.items)
        actual_count = len(result.transfers)
        if actual_count != expected_count:
            raise LibraryDownloadRequestError(
                "prepare_materialize batch "
                f"{batch_index + 1} returned {actual_count} transfers; "
                f"expected {expected_count}"
            )
        return cls(transfers=tuple(result.transfers))


class PreparedDownloadInstaller:
    def __init__(
        self,
        destination: DownloadDestination,
        materializer: LibraryFileMaterializer,
        apps_client: HostedAppsClient | None = None,
    ) -> None:
        self.destination = destination
        self.materializer = materializer
        self.apps_client = apps_client

    def install(
        self,
        batches: tuple[PreparedMaterializeBatch, ...],
    ) -> list[Path]:
        installed_paths: list[Path] = []
        item_index = 0
        reporter = DownloadCompletionReporter(self.apps_client)
        try:
            for batch in batches:
                for transfer in batch.transfers:
                    with reporter.observe(transfer):
                        suggested_path = self._suggested_path(transfer, item_index)
                        destination_path = self.destination.path / suggested_path
                        workspace_path = self._workspace_path(
                            transfer,
                            item_index,
                            destination_path,
                        )
                        if workspace_path is not None:
                            self._apply_xattrs(transfer, workspace_path)
                            installed_paths.append(workspace_path)
                        else:
                            self.materializer.materialize(
                                LibraryFileTransfer.parse(transfer),
                                destination_path,
                            )
                            installed_paths.append(destination_path)
                        item_index += 1
        finally:
            reporter.flush()
        return installed_paths

    def _apply_xattrs(self, transfer: dict[str, object], path: Path) -> None:
        library_file_id_value = transfer.get("library_file_id")
        library_file_id = (
            require_string(library_file_id_value, "transfer.library_file_id")
            if library_file_id_value is not None
            else None
        )
        self.materializer.apply_xattrs(
            include_library_file_id_xattr(
                parse_xattrs(transfer.get("xattrs", [])),
                library_file_id,
            ),
            path,
        )

    @staticmethod
    def _workspace_path(
        transfer: dict[str, object],
        index: int,
        expected_path: Path,
    ) -> Path | None:
        value = transfer.get("workspace_path")
        if value is None:
            return None
        path = Path(require_string(value, f"transfers[{index}].workspace_path"))
        if not path.is_absolute():
            raise LibraryDownloadRequestError("workspace_path must be absolute")
        if path.resolve() != expected_path.resolve():
            raise LibraryDownloadRequestError(
                "workspace_path does not match the requested destination"
            )
        if not path.is_file():
            raise LibraryDownloadRequestError(f"workspace_path does not name a file: {path}")
        return path

    @staticmethod
    def _suggested_path(transfer: dict[str, object], index: int) -> Path:
        value = require_string(
            transfer.get("suggested_path"),
            f"transfers[{index}].suggested_path",
        )
        path = PurePosixPath(value)
        if path.is_absolute() or not path.parts or ".." in path.parts:
            raise LibraryDownloadRequestError(
                f"transfers[{index}].suggested_path must stay beneath the destination"
            )
        return Path(*path.parts)


class LibraryDownloadWorkflow:
    def __init__(
        self,
        apps_client: HostedAppsClient,
        materializer: LibraryFileMaterializer,
    ) -> None:
        self.apps_client = apps_client
        self.materializer = materializer

    def run(
        self,
        list_or_search_json: str,
        selection: str,
        destination_value: str,
    ) -> dict[str, object]:
        destination = DownloadDestination.parse(destination_value)
        plan = MaterializeRequestBuilder().build_plan(
            list_or_search_json,
            selection,
            destination,
        )
        if plan.items:
            prepared_batches = self._prepare_batches(plan)
        else:
            prepared_batches = ()
        paths = PreparedDownloadInstaller(
            destination=destination,
            materializer=self.materializer,
            apps_client=self.apps_client,
        ).install(prepared_batches)
        return {
            "directory": str(destination.path),
            "files": [str(path) for path in paths],
        }

    def _prepare_batches(
        self,
        plan: MaterializePlan,
    ) -> tuple[PreparedMaterializeBatch, ...]:
        batches = plan.batches(_PREPARE_MATERIALIZE_BATCH_SIZE)
        worker_count = min(
            len(batches),
            _MAX_PARALLEL_PREPARE_MATERIALIZE_BATCHES,
        )
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures: tuple[Future[dict[str, object]], ...] = tuple(
                executor.submit(
                    self.apps_client.call_tool,
                    _LIBRARY_CONNECTOR_ID,
                    "prepare_materialize",
                    batch.arguments,
                )
                for batch in batches
            )
            return tuple(
                PreparedMaterializeBatch.from_result(
                    batch,
                    PrepareMaterializeResult.parse(future.result()),
                    batch_index,
                )
                for batch_index, (batch, future) in enumerate(zip(batches, futures, strict=True))
            )


def main(argv: list[str]) -> int:
    if argv:
        print("usage: library_download.py < request.json", file=sys.stderr)
        return 2
    if sys.stdin.isatty():
        print(
            "library download request failed: stdin must be closed after one JSON request",
            file=sys.stderr,
        )
        return 2
    try:
        try:
            request = require_object(json.load(sys.stdin), "download request")
        except json.JSONDecodeError as exc:
            raise LibraryDownloadRequestError("stdin must contain valid JSON") from exc
        list_or_search_json = json.dumps(
            require_object(request.get("result"), "download request result")
        )
        selection = require_string(request.get("selection"), "download request selection")
        if "destination" not in request:
            result = MaterializeRequestBuilder().build(list_or_search_json, selection)
        else:
            result = LibraryDownloadWorkflow(
                apps_client=HostedAppsClient(),
                materializer=LibraryFileMaterializer(),
            ).run(
                list_or_search_json,
                selection,
                require_string(request["destination"], "download request destination"),
            )
        print(json.dumps(result, separators=(",", ":")))
    except (
        HostedAppsError,
        LibraryDownloadRequestError,
        LibraryFileTransferError,
        OSError,
    ) as exc:
        print(f"library download request failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
