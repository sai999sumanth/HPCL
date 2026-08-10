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


def _route_exists(path: str, methods: set) -> bool:
    """Return True if the app already has a route matching path + methods."""
    for route in app.routes:
        if getattr(route, "path", None) == path:
            route_methods = set(getattr(route, "methods", set()))
            if methods.issubset(route_methods):
                return True
    return False


def _log_registered_routes():
    """Log every registered route so 404s are easy to diagnose from the logs."""
    routes = []
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", set())
        if path and methods:
            routes.append(f"{','.join(sorted(methods))} {path}")
    logger.info("Registered routes:\n  " + "\n  ".join(sorted(routes)))


# ── Fallback login route ─────────────────────────────────────────────────────
# Auto-discovery loads users_actions.py and registers /api/users/login. If that
# file fails to import (missing env, broken dependency, etc.), login returns
# 404 even though the rest of the app appears healthy. This fallback keeps the
# login endpoint alive and surfaces the real import error in the response/logs.
if not _route_exists("/api/users/login", {"POST"}):
    logger.warning(
        "users_actions router did not register /api/users/login; enabling fallback login route"
    )

    @app.post("/api/users/login", tags=["Users"])
    async def fallback_users_login(request: Request, data: dict):
        try:
            import authenticator.authentication_manager_ad as auth_manager

            status, resp, user_info = await auth_manager.AuthenticationManager.login(
                data.get("username"), data.get("password"), data.get("login_type")
            )
            if not status:
                return JSONResponse({"status": False, "msg": resp}, 401)

            response = JSONResponse(
                {"status": True, "msg": "Logged in Successfully"}, 200
            )
            response.set_cookie(
                urdhva_base.settings.cookie_name,
                resp,
                httponly=urdhva_base.settings.session_httponly,
                secure=urdhva_base.settings.session_secure,
                samesite=urdhva_base.settings.session_same_site,
            )
            return response
        except Exception as exc:
            logger.exception("Fallback login route failed")
            return JSONResponse(
                {"status": False, "msg": f"Login service unavailable: {exc}"},
                503,
            )


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

    _log_registered_routes()
    logger.info("Startup complete")


def _ensure_hpcl_ceg_model():
    """
    The generated hpcl_ceg_model.py is large and occasionally ends up empty or
    partially imported in the deployed image (stale cache, truncated copy, etc.).
    This helper guarantees a fresh import and replaces any broken module in
    sys.modules before the API routers are loaded.
    """
    required = ("Users", "Users_LoginParams", "Users_Fetch_UsersParams")
    try:
        import hpcl_ceg_model

        missing = [name for name in required if not hasattr(hpcl_ceg_model, name)]
        if not missing:
            logger.info("hpcl_ceg_model loaded successfully")
            return

        logger.warning(
            f"hpcl_ceg_model is missing attributes: {missing}; forcing re-import from file"
        )
    except Exception as exc:
        logger.warning(f"hpcl_ceg_model initial import failed: {exc}; forcing re-import")

    # Remove any cached partial/empty module and load directly from disk.
    sys.modules.pop("hpcl_ceg_model", None)
    model_path = os.path.join(os.getcwd(), "hpcl_ceg_model.py")
    if not os.path.exists(model_path):
        logger.error(f"hpcl_ceg_model.py not found at {model_path}")
        return

    try:
        spec = importlib.util.spec_from_file_location("hpcl_ceg_model", model_path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules["hpcl_ceg_model"] = mod
        spec.loader.exec_module(mod)
        missing = [name for name in required if not hasattr(mod, name)]
        if missing:
            logger.error(
                f"Re-imported hpcl_ceg_model is still missing: {missing}"
            )
        else:
            logger.info("hpcl_ceg_model re-imported successfully from file")
    except Exception as exc:
        logger.exception(f"Failed to re-import hpcl_ceg_model from {model_path}")


# ── Load routers at import time ───────────────────────────────────────────────
# (Runs when uvicorn imports this module, which is after sys.path is set.)
_ensure_hpcl_ceg_model()
_load_routers(app)
_log_registered_routes()
