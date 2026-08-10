#!/bin/bash

cd /opt/ceg/algo/api_manager
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/ro_va_day_end_closure.py > /var/log/ceg_sys_logs/ro_va_day_end_closure.log