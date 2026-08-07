"""Validated product-media persistence with durable metadata.

Stage 8 keeps the current local storage backend for compatibility, but the
catalogue now records the metadata required to move objects behind a CDN or
object-storage provider without changing product records.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.config import get_settings
from app.shared.exceptions import ResourceConflictError

_ALLOWED_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}
_MAX_DIMENSION = 12_000
_MAX_PIXELS = 40_000_000
Image.MAX_IMAGE_PIXELS = _MAX_PIXELS


@dataclass(frozen=True, slots=True)
class StoredCatalogMedia:
    url: str
    mime_type: str
    byte_size: int
    width: int
    height: int
    sha256: str
    storage_provider: str = "local"


async def store_catalog_media(upload: UploadFile, product_id: int) -> StoredCatalogMedia:
    settings = get_settings()
    content = await upload.read(settings.product_image_max_bytes + 1)
    if not content:
        raise ResourceConflictError("The uploaded product image is empty.")
    if len(content) > settings.product_image_max_bytes:
        raise ResourceConflictError(
            f"Product images must be no larger than {settings.product_image_max_bytes // 1_048_576} MB."
        )

    try:
        with Image.open(BytesIO(content)) as candidate:
            detected_format = (candidate.format or "").upper()
            width, height = candidate.size
            candidate.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ResourceConflictError("The uploaded file is not a safe supported raster image.") from exc

    if detected_format not in _ALLOWED_FORMATS:
        raise ResourceConflictError("Product images must be JPEG, PNG, or WebP files.")
    mime_type, extension = _ALLOWED_FORMATS[detected_format]
    if upload.content_type and upload.content_type != mime_type:
        raise ResourceConflictError("The uploaded image content does not match its declared media type.")
    if width <= 0 or height <= 0 or width > _MAX_DIMENSION or height > _MAX_DIMENSION:
        raise ResourceConflictError(
            f"Product image dimensions must be between 1 and {_MAX_DIMENSION} pixels per side."
        )
    if width * height > _MAX_PIXELS:
        raise ResourceConflictError("The product image contains too many pixels.")

    relative_directory = Path("products") / str(product_id)
    storage_directory = Path(settings.media_root) / relative_directory
    storage_directory.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    destination = storage_directory / filename
    temporary = destination.with_suffix(f"{destination.suffix}.tmp")
    temporary.write_bytes(content)
    os.replace(temporary, destination)

    return StoredCatalogMedia(
        url=f"{settings.media_public_path.rstrip('/')}/{relative_directory.as_posix()}/{filename}",
        mime_type=mime_type,
        byte_size=len(content),
        width=width,
        height=height,
        sha256=hashlib.sha256(content).hexdigest(),
    )


def delete_catalog_media_file(url: str) -> None:
    """Best-effort cleanup for locally managed catalogue objects."""
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
    try:
        if candidate.is_file():
            candidate.unlink()
    except OSError:
        # The database transaction is already authoritative at this point.
        # A later storage janitor may remove a local orphan; never turn a
        # committed catalogue mutation into an apparent request failure.
        return
