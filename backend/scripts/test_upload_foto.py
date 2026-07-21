#!/usr/bin/env python3
"""
Test del endpoint POST /api/reportes/upload-foto
Valida:
  1. Login y obtención de token
  2. Upload de imagen base64 al backend
  3. Backend sube a Supabase y devuelve URL pública
  4. La URL pública es accesible (GET 200)
"""

import httpx
import sys
import base64

BACKEND_URL = "http://localhost:8002"

# Imagen 1x1 pixel verde en WebP (base64)
# Generada con: python3 -c "from PIL import Image; import io, base64; img=Image.new('RGB',(1,1),(0,255,0)); buf=io.BytesIO(); img.save(buf,'WEBP'); print(base64.b64encode(buf.getvalue()).decode())"
MINI_WEBP = "UklGRiYAAABXRUJQVlA4IBoAAAAwAQCdASoBAAEAAQAcJYwCdAEO/hepgAAA"


def main():
    print("=" * 60)
    print("TEST: POST /api/reportes/upload-foto")
    print("=" * 60)

    # 1. Login
    print("\n[1] Login como admin...")
    login_resp = httpx.post(
        f"{BACKEND_URL}/api/auth/login",
        json={"email": "admin@solar.com", "password": "admin123"},
        timeout=10,
    )
    if login_resp.status_code != 200:
        print(f"  FAIL: login {login_resp.status_code} - {login_resp.text}")
        sys.exit(1)
    token = login_resp.json()["access_token"]
    print(f"  OK: token obtenido ({token[:20]}...)")

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Upload foto
    print("\n[2] Subiendo foto de prueba (1x1 pixel verde)...")
    payload = {
        "proyecto_nombre": "Proyecto Test Upload",
        "proyecto_id": 9999,
        "checklist_item": "prueba-foto",
        "tipo": "evidencia",
        "imagen": f"data:image/webp;base64,{MINI_WEBP}",
    }
    upload_resp = httpx.post(
        f"{BACKEND_URL}/api/reportes/upload-foto",
        json=payload,
        headers=headers,
        timeout=30,
    )
    if upload_resp.status_code != 200:
        print(f"  FAIL: upload {upload_resp.status_code} - {upload_resp.text}")
        sys.exit(1)

    data = upload_resp.json()
    public_url = data["url"]
    path = data["path"]
    print(f"  OK: foto subida")
    print(f"     path: {path}")
    print(f"     url:  {public_url}")

    # 3. Verificar que la URL pública es accesible
    print("\n[3] Verificando URL pública (GET)...")
    img_resp = httpx.get(public_url, timeout=10)
    if img_resp.status_code != 200:
        print(f"  FAIL: GET {img_resp.status_code}")
        sys.exit(1)

    content_type = img_resp.headers.get("content-type", "")
    content_len = len(img_resp.content)
    print(
        f"  OK: status={img_resp.status_code}, content-type={content_type}, bytes={content_len}"
    )

    # 4. Verificar que es imagen válida (WebP header o bytes)
    if content_len > 0:
        print(f"\n  Primeros bytes: {img_resp.content[:16].hex()}")
        print("  OK: imagen descargable correctamente")

    print("\n" + "=" * 60)
    print("TODOS LOS TESTS PASARON")
    print("=" * 60)


if __name__ == "__main__":
    main()
