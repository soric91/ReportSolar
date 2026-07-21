# Guía de Deployment a Producción

## 📋 Pre-requisitos

- Servidor Linux (Ubuntu 20.04+ recomendado)
- Docker & Docker Compose instalados
- Dominio DNS apuntando al servidor
- Acceso SSH al servidor

## 🚀 Configuración de Producción

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd informeappsolar
```

### 2. Configurar Variables de Entorno

```bash
# Crear archivo .env.prod
cp .env .env.prod

# Editar con valores de producción
nano .env.prod
```

**Variables críticas:**

```env
# Backend
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=<generate-with-python>
DATABASE_URL=postgresql://user:pass@db:5432/prod_db
REDIS_HOST=redis
REDIS_PORT=6379

# Domain
DOMAIN_NAME=yourdomain.com

# Supabase
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_KEY=<your-key>

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ALGORITHM=HS256

# CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Nginx
NGINX_PORT=800
```

### 3. SSL/TLS con Let's Encrypt

```bash
# Instalar certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Crear certificado
sudo certbot certonly --manual \
  --preferred-challenges=http \
  -d yourdomain.com \
  -d www.yourdomain.com

# El certificado se guarda en:
# /etc/letsencrypt/live/yourdomain.com/
```

### 4. Configurar Nginx para HTTPS

```bash
# Copiar configuración de producción
cp nginx/nginx.prod.conf nginx/nginx.conf.template

# Actualizar docker-compose.yml para usar certificados
# (Agregar volumen: /etc/letsencrypt:/etc/letsencrypt)
```

### 5. Docker Compose con Healthchecks

```bash
# Con healthchecks y auto-restart
docker-compose -f docker-compose.yml up -d

# Verificar estado
docker-compose ps

# Ver healthchecks
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### 6. Database Setup

```bash
# Las migraciones se corren automáticamente en startup
# Pero si necesitas correrlas manualmente:
docker-compose exec backend alembic upgrade head

# Seed de datos (usuario admin inicial)
docker-compose exec backend python seed_admin.py
```

### 7. Verificar Deploymen

```bash
# Backend health check
curl https://yourdomain.com/api/health

# Frontend
curl https://yourdomain.com/

# Swagger docs
curl https://yourdomain.com/api/docs
```

## 🔐 Security Checklist

- [ ] SECRET_KEY es largo y aleatorio (32+ chars)
- [ ] DEBUG=false en .env.prod
- [ ] CORS solo permite el dominio actual
- [ ] SSL/TLS certificado válido
- [ ] Database credenciales fuertes
- [ ] Redis accesible solo internamente
- [ ] Firewall configu rado (solo 80, 443, 22)
- [ ] SSH keys configuradas (no password auth)
- [ ] Secrets guardados en GitHub secrets (no .env en repo)

## 📊 Monitoreo

### Logs de Docker

```bash
# Ver logs en tiempo real
docker-compose logs -f backend

# Ver logs específicos
docker-compose logs backend | tail -100
```

### Health Checks

```bash
# Ver estado de servicios
docker-compose ps

# Si un servicio falla, reiniciar:
docker-compose restart <service-name>
```

### Métricas (Opcional)

Instalar Prometheus y Grafana:

```bash
# Agregar al docker-compose.yml
# (ver docker-compose-monitoring.yml como referencia)
```

## 🔄 Actualizaciones

### Actualizar Código

```bash
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

### Renovar Certificados SSL

```bash
# Automático si configuras cron:
sudo certbot renew --quiet

# O manual:
sudo certbot renew
```

## 🆘 Troubleshooting

### Backend no inicia

```bash
# Ver logs
docker-compose logs backend

# Verificar BD conexión
docker-compose exec backend python -c "from app.core.database import engine; print('OK')"
```

### Redis connection error

```bash
# Verificar Redis
docker-compose exec redis redis-cli ping

# Reiniciar Redis
docker-compose restart redis
```

### Certificado SSL expira

```bash
# Renovar manualmente
sudo certbot renew --force-renewal

# Reiniciar nginx
docker-compose restart nginx
```

## 📈 Escalabilidad Futura

- [ ] Load balancer (nginx-upstream o HAProxy)
- [ ] Database replication (master-slave)
- [ ] Redis cluster
- [ ] CDN para assets estáticos
- [ ] Container orchestration (Kubernetes)

## 🔗 Referencias

- [Let's Encrypt](https://letsencrypt.org/)
- [Docker Compose Healthchecks](https://docs.docker.com/compose/compose-file/#healthcheck)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
