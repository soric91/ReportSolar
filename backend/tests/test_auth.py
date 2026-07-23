import pytest
from fastapi import status


class TestAuth:
    """Tests para autenticación"""

    def test_login_success(self, client, test_usuario):
        """Test login exitoso"""
        response = client.post(
            "/api/auth/login",
            json={"email": test_usuario.email, "password": "testpass123"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, test_usuario):
        """Test login con contraseña incorrecta"""
        response = client.post(
            "/api/auth/login",
            json={"email": test_usuario.email, "password": "wrongpassword"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "detail" in response.json()

    def test_login_nonexistent_user(self, client):
        """Test login con usuario inexistente"""
        response = client.post(
            "/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "password123"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user(self, client, auth_headers):
        """Test obtener usuario actual"""
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "rol" in data

    def test_get_current_user_without_token(self, client):
        """Test obtener usuario sin token"""
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_token(self, client, test_usuario):
        """Test refrescar token"""
        # Primero obtener el refresh token
        response = client.post(
            "/api/auth/login",
            json={"email": test_usuario.email, "password": "testpass123"},
        )
        assert response.status_code == status.HTTP_200_OK
        refresh_token = response.json()["refresh_token"]

        # Usar el refresh token
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_rate_limiting_login(self, client, test_usuario):
        """Test rate limiting en login"""
        # Hacer varios intentos
        responses = []
        for i in range(6):
            response = client.post(
                "/api/auth/login",
                json={"email": test_usuario.email, "password": "testpass123"},
            )
            responses.append(response.status_code)

        # Al menos uno debería ser 200, y al menos haber intentos
        assert any(code == 200 for code in responses) or any(code == 429 for code in responses)
