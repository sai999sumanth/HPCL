from inspect import indentsize
from logging import debug
import os
import sys
import urdhva_base
import uvicorn
import argparse

sys.path.append(os.getcwd())
parser = argparse.ArgumentParser(description='Parse Model & generate code for a target language.')
parser.add_argument('-c','--config', action='store_true', help='Sample config file.')
args = parser.parse_args()

if __name__ == "__main__":
    log_level: str = None
    reload: bool = False
    # CRITICAL: bind to 0.0.0.0 so the port is reachable from outside the
    # container. uvicorn's default host is 127.0.0.1 (loopback only), which
    # means Docker's published port 8002 would accept no traffic from the
    # host — exactly the recurring "direct :8002 access fails" symptom.
    host: str = os.environ.get("HOST", "0.0.0.0")
    port: int = int(os.environ.get("PORT", 9000))
    # print(os.getcwd(), sys.path)
    if args.config:
        print(urdhva_base.settings.json(indent=2))
        sys.exit(0)

    if os.environ.get("MODE", "prod") == "dev":
        log_level = "debug"
        reload = True

    uvicorn.run("urdhva_base.restapi:app", host=host, port=port, log_level=log_level, reload=reload, reload_dirs=[os.getcwd()])
