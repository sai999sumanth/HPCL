# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline

COPY frontend/ .
RUN npm run build

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV MODE=prod

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    redis-server \
    supervisor \
    libldap2-dev \
    libsasl2-dev \
    libssl-dev \
    unixodbc-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    build-essential \
    python3-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY backend/requirements.txt /tmp/requirements.txt
COPY backend/UrdhvaBase /opt/ceg/algo/UrdhvaBase

RUN pip install --upgrade pip setuptools wheel \
    && pip install -e /opt/ceg/algo/UrdhvaBase \
    && pip install -r /tmp/requirements.txt

# Copy backend modules and services.
# NOTE: backend/api_manager/.alg_env is INTENTIONALLY EXCLUDED from the image.
# It contains live credentials (DB, SMTP, ThingsBoard, encryption key) and is
# filtered out by .dockerignore. It is provided at *runtime* via a read-only
# volume mount (see docker-compose.yml / deploy.yml), never baked into the
# image or committed to git.
COPY backend/api_manager             /opt/ceg/algo/api_manager
COPY backend/authenticator           /opt/ceg/algo/authenticator
COPY backend/orchestrator            /opt/ceg/algo/orchestrator
COPY backend/utilities               /opt/ceg/algo/utilities
COPY backend/cache_gateway           /opt/ceg/algo/cache_gateway
COPY backend/ceg_role_master_api     /opt/ceg/algo/ceg_role_master_api
COPY backend/vendor_ingestion_api    /opt/ceg/algo/vendor_ingestion_api
COPY backend/Thingsboard             /opt/ceg/algo/Thingsboard

# Copy configuration and environment files (Wildcards will match if present)
COPY backend/.env*                   /opt/ceg/algo/
COPY backend/config*                 /opt/ceg/algo/

RUN rm -rf /usr/share/nginx/html/*
COPY --from=frontend-build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

COPY supervisord.conf /etc/supervisor/conf.d/novex.conf

RUN mkdir -p /var/log/ceg_sys_logs /var/log/ceg_logs /var/run/redis

EXPOSE 5378 8002

# Health check MUST hit the real backend (/api/health), not just nginx.
# The old healthcheck only probed nginx's /health, which returns 200 even
# when FastAPI is dead — masking the exact failure this deploy has been
# hitting (container "healthy", but /docs and /api 404/500).
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8002/api/health || curl -fsS http://127.0.0.1:5378/api/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/novex.conf"]
