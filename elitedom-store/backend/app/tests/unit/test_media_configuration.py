"""Regression coverage for runtime media-directory configuration."""

from pathlib import Path

from app.config import Settings


def test_default_media_root_is_process_local_and_writable(
    monkeypatch,
    tmp_path: Path,
) -> None:
    """Non-container imports must not try to create a root-owned /app directory."""
    monkeypatch.chdir(tmp_path)

    configured_default = Settings.model_fields["media_root"].default
    media_root = Path(configured_default)

    assert configured_default == "media"
    assert not media_root.is_absolute()

    media_root.mkdir(parents=True, exist_ok=True)

    assert media_root.is_dir()
    assert media_root.resolve().is_relative_to(tmp_path)
