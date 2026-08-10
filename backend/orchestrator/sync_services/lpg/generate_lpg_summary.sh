#!/bin/bash
cd /opt/ceg/algo/api_manager
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/sync_services/lpg/generate_lpg_summary.py > /var/log/ceg_sys_logs/lpg/generate_lpg_summary_log_$(date +\%Y-\%m-\%d_\%H-\%M).log 2>&1