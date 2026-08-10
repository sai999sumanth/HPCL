#!/bin/bash
cd /opt/ceg/algo/orchestrator/sync_services/lpg
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/sync_services/lpg/lpg_prod_event_sync.py > /var/log/ceg_sys_logs/lpg/lpg_prod_event_sync_$(date +\%Y-\%m-\%d_\%H-\%M).log 2>&1