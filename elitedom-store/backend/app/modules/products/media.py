"""Safe local product-image persistence.

The API accepts only raster image formats that browsers can render without
executing active content. Files are stored under a generated name and are
served read-only by FastAPI's /media mount.
"""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.config import get_settings
from app.shared.exceptions import ResourceConflictError

_IMAGE_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"RIFF", ".webp"),
)
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _detect_extension(content: bytes) -> str | None:
    for signature, extension in _IMAGE_SIGNATURES:
        if not content.startswith(signature):
            continue
        if extension == ".webp" and (len(content) < 12 or content[8:12] != b"WEBP"):
            continue
        return extension
    return None


async def store_product_image(upload: UploadFile, product_id: int) -> str:
    """Validate and persist one product image, returning its public URL."""
    settings = get_settings()
    if upload.content_type not in _ALLOWED_CONTENT_TYPES:
        raise ResourceConflictError("Product images must be JPEG, PNG, or WebP files.")

    content = await upload.read(settings.product_image_max_bytes + 1)
    if not content:
        raise ResourceConflictError("The uploaded product image is empty.")
    if len(content) > settings.product_image_max_bytes:
        raise ResourceConflictError(
            f"Product images must be no larger than {settings.product_image_max_bytes // 1_048_576} MB."
        )

    extension = _detect_extension(content)
    if extension is None:
        raise ResourceConflictError("The uploaded file does not contain a supported image format.")

    relative_directory = Path("products") / str(product_id)
    storage_directory = Path(settings.media_root) / relative_directory
    storage_directory.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    destination = storage_directory / filename

    temporary = destination.with_suffix(f"{destination.suffix}.tmp")
    temporary.write_bytes(content)
    os.replace(temporary, destination)
    return f"{settings.media_public_path.rstrip('/')}/{relative_directory.as_posix()}/{filename}"


def delete_product_image_file(url: str) -> None:
    """Delete a locally-managed image without allowing path traversal."""
    settings = get_settings()
    public_prefix = f"{settings.media_public_path.rstrip('/')}/"
    if not url.startswith(public_prefix):
        return

    relative = url.removeprefix(public_prefix)
    root = Path(settings.media_root).resolve()
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return
    if candidate.is_file():
        candidate.unlink()
