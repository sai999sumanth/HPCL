"""
Health-check endpoints for diagnosing live service status.

Routes (registered under /api prefix by restapi.py auto-discovery):
  GET /api/health          — overall status (DB + Redis)
  GET /api/health/db       — PostgreSQL reachability (SELECT 1)
  GET /api/health/redis    — Redis ping
"""
import asyncio
import fastapi
from sqlalchemy import text

router = fastapi.APIRouter(prefix="/health")


async def _check_db() -> dict:
    try:
        import urdhva_base.postgresmodel as pgm
        session = await pgm.manager.get_session()
        try:
            result = await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=8.0)
            _ = result.scalar()
            db_host = str(pgm.manager.engine.url).split("@")[-1]
            return {"status": "ok", "host": db_host}
        finally:
            try:
                await asyncio.shield(session.close())
            except Exception:
                pass
    except asyncio.TimeoutError:
        return {"status": "timeout", "error": "DB did not respond within 8 s"}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


async def _check_redis() -> dict:
    try:
        import urdhva_base.redispool as rp
        redis = await rp.get_redis_connection()
        pong = await asyncio.wait_for(redis.ping(), timeout=3.0)
        return {"status": "ok" if pong else "no_pong"}
    except asyncio.TimeoutError:
        return {"status": "timeout", "error": "Redis did not respond within 3 s"}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


@router.get("", tags=["Health"], summary="Overall health (DB + Redis)")
async def health_all():
    db_result, redis_result = await asyncio.gather(
        _check_db(), _check_redis(), return_exceptions=True
    )
    if isinstance(db_result, Exception):
        db_result = {"status": "error", "error": str(db_result)}
    if isinstance(redis_result, Exception):
        redis_result = {"status": "error", "error": str(redis_result)}
    all_ok = db_result.get("status") == "ok" and redis_result.get("status") == "ok"
    return fastapi.responses.JSONResponse(
        status_code=200 if all_ok else 503,
        content={"status": "healthy" if all_ok else "degraded", "db": db_result, "redis": redis_result},
    )


@router.get("/db", tags=["Health"], summary="PostgreSQL connectivity")
async def health_db():
    result = await _check_db()
    return fastapi.responses.JSONResponse(
        status_code=200 if result.get("status") == "ok" else 503, content=result
    )


@router.get("/redis", tags=["Health"], summary="Redis connectivity")
async def health_redis():
    result = await _check_redis()
    return fastapi.responses.JSONResponse(
        status_code=200 if result.get("status") == "ok" else 503, content=result
    )
