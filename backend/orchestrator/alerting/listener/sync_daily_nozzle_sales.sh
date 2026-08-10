#!/bin/bash

cd /opt/ceg/algo/api_manager
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_daily_nozzle_sales_data.py > /var/log/ceg_sys_logs/sync_daily_nozzle_sales_data.log