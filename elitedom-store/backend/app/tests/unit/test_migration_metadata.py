"""Guard the Alembic revision graph against deployment-breaking metadata."""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

MIGRATION_DIR = Path(__file__).resolve().parents[3] / "alembic" / "versions"
MAX_ALEMBIC_VERSION_LENGTH = 32


def _assignment_value(module: ast.Module, name: str) -> Any:
    for statement in module.body:
        if isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name):
            if statement.target.id == name and statement.value is not None:
                return ast.literal_eval(statement.value)
        if isinstance(statement, ast.Assign):
            for target in statement.targets:
                if isinstance(target, ast.Name) and target.id == name:
                    return ast.literal_eval(statement.value)
    raise AssertionError(f"Migration is missing {name!r}")


def _migration_metadata() -> list[tuple[Path, str, str | tuple[str, ...] | None]]:
    metadata: list[tuple[Path, str, str | tuple[str, ...] | None]] = []
    for path in sorted(MIGRATION_DIR.glob("*.py")):
        module = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        revision = _assignment_value(module, "revision")
        down_revision = _assignment_value(module, "down_revision")
        assert isinstance(revision, str), f"{path.name}: revision must be a string"
        assert down_revision is None or isinstance(down_revision, str | tuple), (
            f"{path.name}: down_revision must be a string, tuple, or None"
        )
        metadata.append((path, revision, down_revision))
    assert metadata, "No Alembic migrations were found"
    return metadata


def test_revision_identifiers_fit_alembic_version_column() -> None:
    for path, revision, _ in _migration_metadata():
        assert len(revision) <= MAX_ALEMBIC_VERSION_LENGTH, (
            f"{path.name}: revision {revision!r} is {len(revision)} characters; "
            f"Alembic's default version column accepts at most "
            f"{MAX_ALEMBIC_VERSION_LENGTH}."
        )


def test_revision_graph_references_existing_unique_revisions() -> None:
    metadata = _migration_metadata()
    revisions = [revision for _, revision, _ in metadata]
    assert len(revisions) == len(set(revisions)), "Alembic revision identifiers must be unique"

    known_revisions = set(revisions)
    for path, _, down_revision in metadata:
        parents = () if down_revision is None else (
            down_revision if isinstance(down_revision, tuple) else (down_revision,)
        )
        missing = [parent for parent in parents if parent not in known_revisions]
        assert not missing, f"{path.name}: unknown down_revision values: {missing}"
