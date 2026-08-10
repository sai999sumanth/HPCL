#!/bin/bash
cd /opt/ceg/algo/orchestrator/sync_services/lpg
source /opt/ceg/venv/bin/activate
export LPG_UNIFIED_ALWAYS_DEDUPE="1"
export LPG_UNIFIED_SKIP_EXTRA_COL_DDL="1"
unbuffer python /opt/ceg/algo/orchestrator/sync_services/lpg/lpg_unified_log_sync.py > /var/log/ceg_sys_logs/lpg/lpg_unified_log_sync_$(date +\%Y-\%m-\%d_\%H-\%M).log 2>&1
