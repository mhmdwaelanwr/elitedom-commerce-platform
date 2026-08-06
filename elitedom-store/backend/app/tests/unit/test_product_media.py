from app.modules.products.media import _detect_extension


def test_product_media_magic_detection_rejects_active_content() -> None:
    assert _detect_extension(b"\xff\xd8\xff\xe0jpeg") == ".jpg"
    assert _detect_extension(b"\x89PNG\r\n\x1a\npng") == ".png"
    assert _detect_extension(b"RIFF1234WEBPdata") == ".webp"
    assert _detect_extension(b"<svg onload=alert(1)>") is None
