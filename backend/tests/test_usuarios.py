import pytest
from fastapi import status


class TestUsuarios:
    """Tests para endpoints de usuarios"""

    def test_list_usuarios(self, client, auth_headers):
        """Test listar usuarios"""
        response = client.get("/api/usuarios/", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert "page" in data
        assert "total" in data
        assert isinstance(data["data"], list)

    def test_list_usuarios_pagination(self, client, auth_headers):
        """Test paginación en listado de usuarios"""
        response = client.get("/api/usuarios/?page=1&limit=10", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10
        assert "pages" in data
        assert "has_next" in data
        assert "has_prev" in data

    def test_list_usuarios_without_auth(self, client):
        """Test listar usuarios sin autenticación"""
        response = client.get("/api/usuarios/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_usuario(self, client, auth_headers, test_usuario):
        """Test obtener usuario específico"""
        response = client.get(f"/api/usuarios/{test_usuario.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == test_usuario.id
        assert data["email"] == test_usuario.email
        assert data["nombre"] == test_usuario.nombre

    def test_get_usuario_not_found(self, client, auth_headers):
        """Test obtener usuario inexistente"""
        response = client.get("/api/usuarios/99999", headers=auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_usuario(self, client, auth_headers):
        """Test crear usuario"""
        new_usuario = {
            "nombre": "New User",
            "email": "newuser@example.com",
            "password": "newpass123",
            "rol": "tecnico",
        }
        response = client.post(
            "/api/usuarios/", json=new_usuario, headers=auth_headers
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["email"] == new_usuario["email"]
        assert data["nombre"] == new_usuario["nombre"]

    def test_create_usuario_validation_error(self, client, auth_headers):
        """Test crear usuario con datos inválidos"""
        invalid_usuario = {
            "nombre": "N",  # Muy corto
            "email": "invalid",  # Email inválido
            "password": "short",  # Muy corta
            "rol": "invalid_rol",  # Rol inválido
        }
        response = client.post(
            "/api/usuarios/", json=invalid_usuario, headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_usuario(self, client, auth_headers, test_usuario):
        """Test actualizar usuario"""
        update_data = {"nombre": "Updated Name"}
        response = client.put(
            f"/api/usuarios/{test_usuario.id}",
            json=update_data,
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["nombre"] == "Updated Name"

    def test_delete_usuario(self, client, auth_headers, test_usuario):
        """Test eliminar usuario"""
        response = client.delete(
            f"/api/usuarios/{test_usuario.id}", headers=auth_headers
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verificar que fue eliminado
        response = client.get(
            f"/api/usuarios/{test_usuario.id}", headers=auth_headers
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
