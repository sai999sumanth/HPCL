#!/bin/bash

cd /opt/ceg/algo/api_manager/
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_consumer_pump_data.py > /var/log/ceg_sys_logs/consumer_pump_data_sync.log 2>&2