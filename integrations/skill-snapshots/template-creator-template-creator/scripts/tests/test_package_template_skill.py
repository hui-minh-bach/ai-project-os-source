from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

SCRIPT = Path(__file__).resolve().parents[1] / "package-template-skill.py"
GENERATOR = SCRIPT.parent / "create-template-skill.mjs"
SITE_PREVIEW = SCRIPT.parent.parent / "assets" / "site-preview.png"


class PackageTemplateSkillTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        self.root = Path(temporary_directory.name)
        self.skill_directory = self.root / "artifact-template-example"
        self.source = self.skill_directory / "assets" / "source"
        (self.source / "src").mkdir(parents=True)
        (self.source / "src" / "index.ts").write_text("export const site = true;\n")
        (self.skill_directory / "SKILL.md").write_text("# Example template\n")
        (self.skill_directory / "agents").mkdir()
        (self.skill_directory / "agents" / "openai.yaml").write_text("interface: {}\n")
        (self.skill_directory / "assets" / "preview.png").write_bytes(b"preview")
        self.manifest: dict[str, object] = {
            "schemaVersion": 1,
            "kind": "site",
            "reference": "assets/source",
            "preview": "assets/preview.png",
        }
        self.write_manifest()

    def write_manifest(self) -> None:
        (self.skill_directory / "artifact-template.json").write_text(json.dumps(self.manifest))

    def run_packager(self, *, expected_returncode: int = 0) -> subprocess.CompletedProcess[str]:
        completed = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--skill-directory",
                str(self.skill_directory),
                "--output-path",
                str(self.root / "skill.zip"),
            ],
            capture_output=True,
            check=False,
            text=True,
        )
        self.assertEqual(completed.returncode, expected_returncode, completed.stderr)
        return completed

    def test_packages_site_directory_reference(self) -> None:
        result = self.run_packager()

        self.assertEqual(
            json.loads(result.stdout)["archivePath"], str((self.root / "skill.zip").resolve())
        )
        with ZipFile(self.root / "skill.zip") as archive:
            self.assertEqual(
                archive.read("artifact-template-example/assets/source/src/index.ts"),
                b"export const site = true;\n",
            )

    def test_packages_existing_document_file_reference(self) -> None:
        self.manifest.update(kind="document", reference="assets/reference.docx")
        self.write_manifest()
        (self.skill_directory / "assets" / "reference.docx").write_bytes(b"document")

        self.run_packager()

        with ZipFile(self.root / "skill.zip") as archive:
            self.assertEqual(
                archive.read("artifact-template-example/assets/reference.docx"), b"document"
            )

    def test_preserves_google_workspace_template_creation(self) -> None:
        created = subprocess.run(
            [
                "node",
                str(GENERATOR),
                "--draft-directory",
                str(self.root),
                "--kind",
                "google-docs",
                "--source-url",
                "https://docs.google.com/document/d/example/edit?resourcekey=example&usp=sharing",
                "--reference-path",
                str(SITE_PREVIEW),
                "--preview-path",
                str(SITE_PREVIEW),
                "--display-name",
                "Project Brief",
                "--description",
                "Create a project brief.",
            ],
            capture_output=True,
            check=True,
            text=True,
        )
        skill_directory = Path(json.loads(created.stdout)["skillPath"])

        self.assertEqual(
            json.loads((skill_directory / "artifact-template.json").read_text()),
            {
                "schemaVersion": 1,
                "kind": "google-docs",
                "sourceUrl": "https://docs.google.com/document/d/example/edit?resourcekey=example",
                "reference": "assets/reference.png",
                "preview": "assets/preview.png",
            },
        )
        self.assertIn("Google Drive", (skill_directory / "SKILL.md").read_text())

    def test_generates_updates_and_packages_sanitized_site_template(self) -> None:
        project = self.root / "marketing-site"
        (project / ".openai").mkdir(parents=True)
        (project / "src").mkdir()
        (project / "src" / "private").mkdir()
        (project / ".sites-runtime").mkdir()
        (project / "node_modules").mkdir()
        (project / "uploads").mkdir()
        (project / ".yarn" / "cache").mkdir(parents=True)
        (project / ".yarn" / "releases").mkdir()
        subprocess.run(["git", "init", "--quiet", str(project)], check=True)
        original_hosting = {"project_id": "proj_original", "d1": "DB", "r2": "FILES"}
        (project / ".openai" / "hosting.json").write_text(json.dumps(original_hosting))
        (project / ".gitignore").write_text(
            ".openai/\n.sites-runtime/\n.yarn/cache/\nuploads/\ncustomer-export.csv\n"
        )
        (project / ".git" / "info" / "exclude").write_text("developer-local.json\n")
        (project / "src" / ".gitignore").write_text("private/\n")
        (project / "src" / "old.ts").write_text("export const site = true;\n")
        (project / "src" / "private" / "customer.json").write_text("private customer data")
        (project / ".sites-runtime" / "npm-cache.log").write_text("private runtime data")
        (project / "developer-local.json").write_text("private local configuration")
        (project / ".env").write_text("SECRET=private\n")
        (project / "node_modules" / "dependency.js").write_text("dependency")
        (project / ".openai" / "credentials.json").write_text("private credentials")
        (project / "customer-export.csv").write_text("private customer data")
        (project / "uploads" / "customer.json").write_text("private uploads")
        (project / ".yarn" / "cache" / "dependency.zip").write_text("cached dependency")
        (project / ".yarn" / "releases" / "yarn-4.0.0.cjs").write_text("yarn release")
        (project / ".yarnrc.yml").write_text(
            "nodeLinker: node-modules\n"
            "yarnPath: .yarn/releases/yarn-4.0.0.cjs\n"
            "npmAuthToken: top-level-secret\n"
            "npmScopes:\n"
            "  private:\n"
            "    npmAuthIdent: nested-secret\n"
        )
        (project / "src" / "linked.ts").symlink_to(project / "src" / "old.ts")

        created = subprocess.run(
            [
                "node",
                str(GENERATOR),
                "--draft-directory",
                str(self.root),
                "--kind",
                "site",
                "--reference-path",
                str(project),
                "--display-name",
                "Marketing Site",
                "--description",
                "Create a reusable marketing Site.",
            ],
            capture_output=True,
            check=True,
            text=True,
        )
        self.skill_directory = Path(json.loads(created.stdout)["skillPath"])
        retained = self.skill_directory / "assets" / "source"

        self.assertEqual(
            json.loads((self.skill_directory / "artifact-template.json").read_text()),
            {
                "schemaVersion": 1,
                "kind": "site",
                "reference": "assets/source",
                "preview": "assets/preview.png",
            },
        )
        self.assertEqual(
            json.loads((retained / ".openai" / "hosting.json").read_text()),
            {"d1": "DB", "r2": "FILES"},
        )
        self.assertEqual(
            json.loads((project / ".openai" / "hosting.json").read_text()), original_hosting
        )
        self.assertEqual(
            (retained / ".yarnrc.yml").read_text(),
            "nodeLinker: node-modules\nyarnPath: .yarn/releases/yarn-4.0.0.cjs\n",
        )
        self.assertEqual(
            (retained / ".yarn" / "releases" / "yarn-4.0.0.cjs").read_text(),
            "yarn release",
        )
        for excluded in (
            ".env",
            ".git/config",
            "node_modules/dependency.js",
            ".openai/credentials.json",
            ".sites-runtime/npm-cache.log",
            "customer-export.csv",
            "developer-local.json",
            "uploads/customer.json",
            ".yarn/cache/dependency.zip",
            "src/private/customer.json",
            "src/linked.ts",
        ):
            with self.subTest(excluded=excluded):
                self.assertFalse((retained / excluded).exists())
        self.assertEqual(
            (self.skill_directory / "assets" / "preview.png").read_bytes(),
            SITE_PREVIEW.read_bytes(),
        )
        skill_path = self.skill_directory / "SKILL.md"
        original_skill = skill_path.read_text()
        skill_path.write_text(f"{original_skill}\n## Custom workflow\nPreserve this instruction.\n")
        (self.skill_directory / "custom-notes.md").write_text("preserve custom notes")
        (self.skill_directory / "assets" / "preview.png").write_bytes(b"custom preview")
        (retained / ".openai" / "hosting.json").write_text('{"d1":"DB","r2":"FILES"}\n')
        (retained / ".env").write_text("preserve existing source exactly\n")

        updated = subprocess.run(
            [
                "node",
                str(GENERATOR),
                "--draft-directory",
                str(self.root),
                "--mode",
                "update",
                "--skill-name",
                self.skill_directory.name,
                "--kind",
                "site",
                "--reference-path",
                str(retained),
                "--display-name",
                "Marketing Homepage",
                "--description",
                "Create a reusable marketing homepage.",
                "--updated-fields",
                "display-name,description",
            ],
            capture_output=True,
            check=True,
            text=True,
        )
        self.assertEqual(Path(json.loads(updated.stdout)["skillPath"]), self.skill_directory)
        self.assertEqual((retained / "src" / "old.ts").read_text(), "export const site = true;\n")
        self.assertEqual(
            (retained / ".openai" / "hosting.json").read_text(),
            '{"d1":"DB","r2":"FILES"}\n',
        )
        self.assertEqual((retained / ".env").read_text(), "preserve existing source exactly\n")
        self.assertEqual(
            (self.skill_directory / "assets" / "preview.png").read_bytes(), b"custom preview"
        )
        self.assertIn("# Marketing Homepage", skill_path.read_text())
        self.assertIn("Preserve this instruction.", skill_path.read_text())
        self.assertEqual(
            (self.skill_directory / "custom-notes.md").read_text(), "preserve custom notes"
        )

        (project / "src" / "old.ts").rename(project / "src" / "current.ts")
        (project / "src" / "linked.ts").unlink()
        subprocess.run(
            [
                "node",
                str(GENERATOR),
                "--draft-directory",
                str(self.root),
                "--mode",
                "update",
                "--skill-name",
                self.skill_directory.name,
                "--kind",
                "site",
                "--reference-path",
                str(project),
                "--display-name",
                "Marketing Homepage",
                "--description",
                "Create a reusable marketing homepage.",
            ],
            capture_output=True,
            check=True,
            text=True,
        )
        self.assertFalse((retained / "src" / "old.ts").exists())
        self.assertEqual(
            (retained / "src" / "current.ts").read_text(), "export const site = true;\n"
        )
        self.assertFalse((retained / ".env").exists())
        self.assertEqual(
            (self.skill_directory / "assets" / "preview.png").read_bytes(), b"custom preview"
        )
        self.assertIn("Preserve this instruction.", skill_path.read_text())

        self.run_packager()

        with ZipFile(self.root / "skill.zip") as archive:
            root = self.skill_directory.name
            self.assertEqual(
                archive.read(f"{root}/assets/source/src/current.ts"),
                b"export const site = true;\n",
            )
            self.assertEqual(
                json.loads(archive.read(f"{root}/assets/source/.openai/hosting.json")),
                {"d1": "DB", "r2": "FILES"},
            )
            self.assertNotIn(f"{root}/assets/source/src/old.ts", archive.namelist())

    def test_rejects_directory_reference_for_non_site_template(self) -> None:
        self.manifest["kind"] = "document"
        self.write_manifest()

        result = self.run_packager(expected_returncode=1)

        self.assertIn("Missing regular template file", result.stderr)

    def test_rejects_file_reference_for_site_template(self) -> None:
        self.manifest["reference"] = "assets/preview.png"
        self.write_manifest()

        result = self.run_packager(expected_returncode=1)

        self.assertIn("Missing template source directory", result.stderr)

    def test_rejects_directory_preview_for_site_template(self) -> None:
        self.manifest["preview"] = "assets/source"
        self.write_manifest()

        result = self.run_packager(expected_returncode=1)

        self.assertIn("Missing regular template file", result.stderr)

    def test_rejects_site_reference_paths_outside_skill_directory(self) -> None:
        outside_directory = self.root / "outside"
        outside_directory.mkdir()
        (self.skill_directory / "assets" / "external").symlink_to(
            outside_directory, target_is_directory=True
        )

        for reference in ("../outside", "assets/external"):
            with self.subTest(reference=reference):
                self.manifest["reference"] = reference
                self.write_manifest()

                result = self.run_packager(expected_returncode=1)

                self.assertIn("inside the skill directory", result.stderr)

    def test_rejects_symlinks_inside_site_reference(self) -> None:
        (self.source / "linked.ts").symlink_to(self.source / "src" / "index.ts")

        result = self.run_packager(expected_returncode=1)

        self.assertIn("cannot contain symlinks", result.stderr)


if __name__ == "__main__":
    unittest.main()
