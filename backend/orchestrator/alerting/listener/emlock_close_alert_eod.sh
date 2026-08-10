#!/bin/bash

cd /opt/ceg/algo/api_manager
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/emlock_close_alert_eod.py > /var/log/ceg_sys_logs/emlock_close_alert_eod.log