#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

MAX_SKILL_ZIP_BYTES = 25 * 1024 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
MAX_COMPRESSION_RATIO = 100


def package_template_skill(skill_directory: Path, output_path: Path) -> None:
    if skill_directory.is_symlink():
        raise ValueError("--skill-directory cannot be a symlink")
    skill_directory = skill_directory.resolve(strict=True)
    if output_path.is_symlink():
        raise ValueError("--output-path cannot be a symlink")
    output_path = output_path.resolve()
    if not skill_directory.is_dir():
        raise ValueError("--skill-directory must point to a directory")
    if (
        len(skill_directory.name) > 64
        or re.fullmatch(r"artifact-template-[a-z0-9]+(?:-[a-z0-9]+)*", skill_directory.name) is None
    ):
        raise ValueError("--skill-directory must have a valid artifact-template skill name")
    if output_path.name.lower() != "skill.zip":
        raise ValueError("--output-path must end in skill.zip")
    if output_path.is_relative_to(skill_directory):
        raise ValueError("--output-path must be outside the skill directory")

    manifest_path = skill_directory / "artifact-template.json"
    if manifest_path.is_symlink():
        raise ValueError("Template manifest cannot be a symlink")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    required_paths = [
        skill_directory / "SKILL.md",
        skill_directory / "agents" / "openai.yaml",
    ]
    for manifest_field in ("reference", "preview"):
        manifest_value = manifest[manifest_field]
        if not isinstance(manifest_value, str):
            raise ValueError(
                f"Template {manifest_field} must be a relative file inside the skill directory"
            )
        relative_path = Path(manifest_value)
        if relative_path.is_absolute() or ".." in relative_path.parts or "\\" in manifest_value:
            raise ValueError(
                f"Template {manifest_field} must be a relative file inside the skill directory"
            )
        resolved_path = (skill_directory / relative_path).resolve(strict=True)
        if not resolved_path.is_relative_to(skill_directory):
            raise ValueError(
                f"Template {manifest_field} must be a relative file inside the skill directory"
            )
        if manifest_field == "reference" and manifest.get("kind") == "site":
            if not resolved_path.is_dir():
                raise ValueError(f"Missing template source directory: {resolved_path}")
        else:
            required_paths.append(resolved_path)

    for required_path in required_paths:
        if not required_path.is_file() or required_path.is_symlink():
            raise ValueError(f"Missing regular template file: {required_path}")

    archive_files: list[tuple[Path, str]] = []
    total_uncompressed_bytes = 0
    for file_path in sorted(skill_directory.rglob("*")):
        if file_path.is_symlink():
            raise ValueError(f"Template package cannot contain symlinks: {file_path}")
        if file_path.is_file():
            file_size = file_path.stat().st_size
            if file_size > MAX_SKILL_ZIP_BYTES:
                raise ValueError("Template skill files must be 25 MB or smaller")
            total_uncompressed_bytes += file_size
            if total_uncompressed_bytes > MAX_TOTAL_UNCOMPRESSED_BYTES:
                raise ValueError("Template skill files exceed the 50 MB uncompressed limit")
            relative_path = file_path.relative_to(skill_directory)
            if "\\" in relative_path.as_posix():
                raise ValueError(f"Template package contains an unsafe archive member: {file_path}")
            archive_path = Path(skill_directory.name) / relative_path
            archive_files.append((file_path, archive_path.as_posix()))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(
        prefix=f".{output_path.name}.", dir=output_path.parent, delete=False
    ) as temporary_file:
        temporary_path = Path(temporary_file.name)

    try:
        with ZipFile(temporary_path, "w", compression=ZIP_DEFLATED) as archive:
            for file_path, archive_path in archive_files:
                archive.write(file_path, archive_path)
            if any(
                entry.file_size > MAX_COMPRESSION_RATIO * entry.compress_size
                for entry in archive.infolist()
            ):
                raise ValueError("Template skill archive contains an over-compressed file")
        if temporary_path.stat().st_size > MAX_SKILL_ZIP_BYTES:
            raise ValueError("Template skill archive exceeds the 25 MB upload limit")
        temporary_path.replace(output_path)
    finally:
        temporary_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skill-directory", required=True, type=Path)
    parser.add_argument("--output-path", required=True, type=Path)
    args = parser.parse_args()
    package_template_skill(args.skill_directory, args.output_path)
    print(json.dumps({"archivePath": str(args.output_path.resolve())}))


if __name__ == "__main__":
    main()
