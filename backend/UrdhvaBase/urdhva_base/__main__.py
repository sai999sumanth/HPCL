import os
import sys
import argparse
import uvicorn
import urdhva_base

# Ensure the service working directory (e.g. api_manager/) is importable for
# auto-discovered modules such as users_actions.py.
sys.path.append(os.getcwd())

parser = argparse.ArgumentParser(description='Run the Urdhva base FastAPI service.')
parser.add_argument('-c', '--config', action='store_true', help='Print the current runtime configuration.')
args = parser.parse_args()

if __name__ == "__main__":
    log_level = None
    reload = False

    # CRITICAL: bind to 0.0.0.0 so the port is reachable from outside the
    # container. uvicorn's default host is 127.0.0.1 (loopback only), which
    # means Docker's published port 8002 would accept no traffic from the
    # host — exactly the recurring "direct :8002 access fails" symptom.
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 9000))

    if args.config:
        print(urdhva_base.settings.json(indent=2))
        sys.exit(0)

    if os.environ.get("MODE", "prod") == "dev":
        log_level = "debug"
        reload = True

    uvicorn.run(
        "urdhva_base.restapi:app",
        host=host,
        port=port,
        log_level=log_level,
        reload=reload,
        reload_dirs=[os.getcwd()],
    )
