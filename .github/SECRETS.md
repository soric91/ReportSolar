# GitHub Secrets Configuration

Para que CI/CD funcione correctamente, configura los siguientes secrets en GitHub:

## Backend Secrets

### DATABASE_URL
- **Descripción:** URL de conexión a la base de datos PostgreSQL
- **Formato:** `postgresql://user:password@host:port/database`
- **Ejemplo:** `postgresql://pguser:pgpass@db.example.com:5432/proddb`

### SECRET_KEY
- **Descripción:** Clave secreta para JWT
- **Recomendación:** Usar `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- **Longitud mínima:** 32 caracteres

### SUPABASE_URL
- **Descripción:** URL de proyecto Supabase
- **Formato:** `https://<project_id>.supabase.co`

### SUPABASE_SERVICE_KEY
- **Descripción:** Service role key de Supabase
- **Nota:** Mantener secreto, solo usar en backend

## Frontend Secrets

### VITE_API_URL
- **Descripción:** URL del backend API
- **Desarrollo:** `http://localhost:8002`
- **Producción:** `https://api.yourdomain.com`

## Cómo configurar en GitHub

1. Ve a: `Settings > Secrets and variables > Actions`
2. Haz clic en "New repository secret"
3. Ingresa el nombre y valor del secret
4. Haz clic en "Add secret"

## Secrets de Workflow (Opcionales)

### CODECOV_TOKEN
- **Descripción:** Token para codecov.io (para reportes de coverage)
- **Crear en:** https://codecov.io/

### DOCKER_REGISTRY_TOKEN
- **Descripción:** Token para Docker Registry (si usas Docker Hub privado)
- **Crear en:** https://hub.docker.com/

## Seguridad

⚠️ **IMPORTANTES:**
- Never commit `.env` o archivos con secrets
- Usar solo en CI/CD workflows
- Rotar secrets regularmente
- Monitorear acceso a secrets

## Verificar Secrets

Para verificar que los secrets estén configurados:

```bash
gh secret list
```

Para eliminar un secret:

```bash
gh secret remove SECRET_NAME
```
