#!/bin/bash

cd /opt/ceg/algo/api_manager/
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_ro_daily_sales.py > /var/log/ceg_sys_logs/cris_sales_sync.log 2>&2
