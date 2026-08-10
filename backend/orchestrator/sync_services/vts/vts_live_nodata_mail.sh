#!/bin/bash

cd /opt/ceg/algo/api_manager/
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/sync_services/vts/vts_live_nodata_mail.py > /var/log/ceg_logs/vts_live_nodata_mail.log 2>&1