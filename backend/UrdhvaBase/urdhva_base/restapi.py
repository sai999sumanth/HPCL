"""
restapi.py — FastAPI application factory for urdhva_base services.

How it works:
  • Launched by `python -m urdhva_base` from a service working directory
    (e.g. api_manager/, vendor_ingestion_api/, …).
  • On startup it walks every *.py file in the CWD and imports modules that
    contain a `router` attribute (fastapi.APIRouter), auto-registering them
    under the /api prefix.
  • CORS, session middleware (Redis-backed, Fernet-encrypted cookie), and
    SlowAPI rate-limiting are configured from .alg_env settings.
"""

import os
import sys
import json
import types
import inspect
import asyncio
import logging
import importlib
import importlib.util
import traceback

import fastapi
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import urdhva_base
import urdhva_base.settings
import urdhva_base.redispool
import urdhva_base.postgresmodel

logger = logging.getLogger("urdhva_base.restapi")

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["1000/minute"])

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=urdhva_base.settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow all origins; in production nginx is the actual gateway so this is safe.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Session middleware ────────────────────────────────────────────────────────
class SessionMiddleware(BaseHTTPMiddleware):
    """
    Reads the session cookie, decrypts it with Fernet, and stores the payload
    in request.state.session. Downstream handlers can read session data via
    request.state.session.
    """

    async def dispatch(self, request: Request, call_next):
        from cryptography.fernet import Fernet, InvalidToken

        session_data = {}
        cookie_value = request.cookies.get(urdhva_base.settings.cookie_name)

        if cookie_value:
            try:
                f = Fernet(urdhva_base.settings.fernet_key)
                decrypted = f.decrypt(cookie_value.encode()).decode()
                session_data = json.loads(decrypted)
            except (InvalidToken, Exception):
                # Invalid / expired session — treat as anonymous
                pass

        request.state.session = session_data

        # Inject entity context used by ACL helpers
        if session_data:
            try:
                urdhva_base.ctx.set(session_data)
            except Exception:
                pass

        response = await call_next(request)
        return response


app.add_middleware(SessionMiddleware)


# ── /api/session/me ──────────────────────────────────────────────────────────
@app.get("/api/session/me", tags=["Session"])
async def session_me(request: Request):
    """
    Returns the decrypted session payload (user info) if a valid session cookie
    is present, or is_authenticated: false otherwise.
    """
    session = getattr(request.state, "session", {})
    if not session or not session.get("employee_id"):
        return JSONResponse({"is_authenticated": False}, status_code=200)
    return JSONResponse({**session, "is_authenticated": True}, status_code=200)


# ── /api/logout ───────────────────────────────────────────────────────────────
@app.get("/api/logout", tags=["Session"])
async def logout(request: Request):
    """Clear the session cookie."""
    response = JSONResponse({"status": True, "msg": "Logged out"})
    response.delete_cookie(urdhva_base.settings.cookie_name)
    return response


# ── /api/health ───────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health():
    """Quick liveness probe — returns 200 if the process is up."""
    return {"status": "ok"}


# ── Router auto-discovery ────────────────────────────────────────────────────
def _load_routers(app: FastAPI):
    """
    Walk every .py file in the current working directory (i.e. the service
    folder) and include any fastapi.APIRouter found as `router` or nested
    inside sub-modules.
    """
    cwd = os.getcwd()
    if cwd not in sys.path:
        sys.path.insert(0, cwd)

    loaded = 0
    errors = 0

    for filename in sorted(os.listdir(cwd)):
        if not filename.endswith(".py"):
            continue
        if filename.startswith("_"):
            continue

        module_name = filename[:-3]
        filepath = os.path.join(cwd, filename)

        try:
            spec = importlib.util.spec_from_file_location(module_name, filepath)
            if spec is None or spec.loader is None:
                continue
            mod = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = mod
            spec.loader.exec_module(mod)

            # Include top-level router attribute
            symbol = getattr(mod, "router", None)
            if isinstance(symbol, fastapi.routing.APIRouter):
                app.include_router(symbol, prefix="/api")
                logger.info(f"  ✓ router from {filename}")
                loaded += 1
                continue

            # Also scan sub-attributes for routers (some modules nest them)
            for attr_name in dir(mod):
                if attr_name.startswith("_"):
                    continue
                attr = getattr(mod, attr_name, None)
                if isinstance(attr, fastapi.routing.APIRouter):
                    app.include_router(attr, prefix="/api")
                    logger.info(f"  ✓ router '{attr_name}' from {filename}")
                    loaded += 1

        except Exception as exc:
            errors += 1
            logger.warning(f"  ✗ failed to load {filename}: {exc}")
            if True:  # always log tracebacks for router load failures
                traceback.print_exc()

    logger.info(f"Router discovery: {loaded} loaded, {errors} skipped")


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    logger.info(f"Starting {urdhva_base.settings.app_name} …")

    # Ensure DB tables exist
    try:
        await urdhva_base.postgresmodel.create_tables()
        logger.info("DB tables verified/created")
    except Exception as exc:
        logger.warning(f"DB table creation failed (non-fatal): {exc}")

    # Warm up Redis connection pool
    try:
        redis = await urdhva_base.redispool.get_redis_connection()
        await redis.ping()
        logger.info("Redis connection pool warmed up")
    except Exception as exc:
        logger.warning(f"Redis warm-up failed (non-fatal): {exc}")

    logger.info("Startup complete")


# ── Load routers at import time ───────────────────────────────────────────────
# (Runs when uvicorn imports this module, which is after sys.path is set.)
_load_routers(app)
