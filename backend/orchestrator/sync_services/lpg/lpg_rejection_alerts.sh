#!/bin/bash
cd /opt/ceg/algo/orchestrator/actions
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/actions/lpg_rejections.py > /var/log/ceg_sys_logs/lpg/rejection_alert_sync_$(date +\%Y-\%m-\%d_\%H-\%M).log 2>&1