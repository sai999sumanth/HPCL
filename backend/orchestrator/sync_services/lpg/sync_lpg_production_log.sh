#!/bin/bash
cd /opt/ceg/algo/orchestrator/sync_services/lpg
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/sync_services/lpg/production_log_sync.py > /var/log/ceg_sys_logs/lpg/sync_production_log_$(date +\%Y-\%m-\%d_\%H-\%M).log 2>&1