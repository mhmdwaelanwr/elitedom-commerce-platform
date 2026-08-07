"""Validated product-media persistence for local or S3-compatible storage."""

from __future__ import annotations

import asyncio
import hashlib
import os
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.config import get_settings
from app.shared.exceptions import ExternalServiceError, ResourceConflictError

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


async def _validated_content(upload: UploadFile) -> tuple[bytes, str, str, int, int]:
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
        raise ResourceConflictError(
            "The uploaded file is not a safe supported raster image."
        ) from exc

    if detected_format not in _ALLOWED_FORMATS:
        raise ResourceConflictError("Product images must be JPEG, PNG, or WebP files.")
    mime_type, extension = _ALLOWED_FORMATS[detected_format]
    if upload.content_type and upload.content_type != mime_type:
        raise ResourceConflictError(
            "The uploaded image content does not match its declared media type."
        )
    if width <= 0 or height <= 0 or width > _MAX_DIMENSION or height > _MAX_DIMENSION:
        raise ResourceConflictError(
            f"Product image dimensions must be between 1 and {_MAX_DIMENSION} pixels per side."
        )
    if width * height > _MAX_PIXELS:
        raise ResourceConflictError("The product image contains too many pixels.")
    return content, mime_type, extension, width, height


def _s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        region_name=settings.s3_region,
        endpoint_url=settings.s3_endpoint_url or None,
    )


async def _store_s3(*, key: str, content: bytes, mime_type: str) -> str:
    settings = get_settings()
    client = _s3_client()
    try:
        await asyncio.to_thread(
            client.put_object,
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content,
            ContentType=mime_type,
            CacheControl="public, max-age=31536000, immutable",
        )
    except (BotoCoreError, ClientError):
        raise ExternalServiceError(
            "object-storage",
            "catalogue media upload failed",
        ) from None
    return f"{settings.media_cdn_base_url.rstrip('/')}/{key}"


async def store_catalog_media(upload: UploadFile, product_id: int) -> StoredCatalogMedia:
    settings = get_settings()
    content, mime_type, extension, width, height = await _validated_content(upload)
    relative_directory = Path("products") / str(product_id)
    filename = f"{uuid4().hex}{extension}"
    key = f"{relative_directory.as_posix()}/{filename}"

    if settings.media_storage_provider == "s3":
        url = await _store_s3(key=key, content=content, mime_type=mime_type)
        provider = "s3"
    else:
        storage_directory = Path(settings.media_root) / relative_directory
        storage_directory.mkdir(parents=True, exist_ok=True)
        destination = storage_directory / filename
        temporary = destination.with_suffix(f"{destination.suffix}.tmp")
        temporary.write_bytes(content)
        os.replace(temporary, destination)
        url = f"{settings.media_public_path.rstrip('/')}/{key}"
        provider = "local"

    return StoredCatalogMedia(
        url=url,
        mime_type=mime_type,
        byte_size=len(content),
        width=width,
        height=height,
        sha256=hashlib.sha256(content).hexdigest(),
        storage_provider=provider,
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
        return


async def delete_catalog_media_object(url: str) -> None:
    """Best-effort post-transaction cleanup for local and S3-managed objects."""
    settings = get_settings()
    public_prefix = f"{settings.media_public_path.rstrip('/')}/"
    if url.startswith(public_prefix):
        delete_catalog_media_file(url)
        return

    cdn_prefix = f"{settings.media_cdn_base_url.rstrip('/')}/"
    if not settings.media_cdn_base_url or not url.startswith(cdn_prefix):
        return
    key = url.removeprefix(cdn_prefix)
    if not key or key.startswith("/") or ".." in Path(key).parts:
        return

    try:
        client = _s3_client()
        await asyncio.to_thread(
            client.delete_object,
            Bucket=settings.s3_bucket,
            Key=key,
        )
    except (BotoCoreError, ClientError):
        # The database transaction is authoritative. Storage lifecycle rules or
        # an operational janitor can remove a rare orphan without lying to the
        # client about an already-committed catalog mutation.
        return
