# Railway Deployment Setup

## Prerequisites
- Railway account (railway.app)
- GitHub repo connected to Railway
- This branch: `railway/deploy`

## Services to Create in Railway

### 1. PostgreSQL (Managed)
- Type: PostgreSQL
- Region: us-west2
- Auto-generated DATABASE_URL
- Railway will provide connection details

### 2. Backend Service
- Name: `backend`
- Dockerfile: `backend/Dockerfile`
- Port: 8002
- Link: PostgreSQL (auto-injects DATABASE_URL)
- Environment variables:
  ```
  DATABASE_URL=${DATABASE_URL}          # Auto-injected by PostgreSQL link
  SECRET_KEY=<generate-secure-key>
  ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=30
  REFRESH_TOKEN_EXPIRE_DAYS=7
  ADMIN_EMAIL=admin@example.com
  ADMIN_PASSWORD=<secure-password>
  SUPABASE_URL=<your-supabase-url>
  SUPABASE_SERVICE_KEY=<your-supabase-key>
  ```

### 3. Frontend Service
- Name: `frontend`
- Dockerfile: `frontend/Dockerfile`
- Port: 5173
- Environment variables:
  ```
  VITE_SUPABASE_URL=<your-supabase-url>
  VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
  ```

### 4. Nginx Service
- Name: `nginx`
- Dockerfile: `nginx/Dockerfile`
- Port: 80 (HTTP) and 443 (HTTPS)
- Public domain: Railway assigns automatically
- Link to backend service (internal networking)

## Service Links (Internal)
- nginx → backend (http://backend:8002)
- nginx → frontend (http://frontend:5173)
- backend → PostgreSQL (via DATABASE_URL env)

## Deployment Steps

1. Push this branch to GitHub
2. In Railway Dashboard:
   - New Project
   - Connect GitHub repo
   - Select `railway/deploy` branch
   - Create services in order above
   - Set environment variables for each
   - Deploy

3. Database migrations:
   ```bash
   railway run python backend/alembic/env.py
   # Or use Railway shell to run migrations
   ```

4. Test:
   - Frontend: https://<railway-domain>/
   - Backend API: https://<railway-domain>/api/
   - Docs: https://<railway-domain>/docs

## Notes
- Nginx acts as reverse proxy (production-like setup)
- All services communicate internally
- Only Nginx port 80/443 exposed publicly
- SSL/TLS via Railway
