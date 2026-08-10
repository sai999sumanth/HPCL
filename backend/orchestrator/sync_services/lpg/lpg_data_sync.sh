#!/bin/bash
cd /opt/ceg/algo/orchestrator/sync_services/lpg
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/sync_services/lpg/LPG_DOMESTIC_SALES_VS_PENDING.py > /var/log/ceg_sys_logs/lpg/cdcms_data_sync_$(date +\%Y-\%m-\%d_\%H-\%M).log 2>&1