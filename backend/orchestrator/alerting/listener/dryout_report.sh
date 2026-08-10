#!/bin/bash

cd /opt/ceg/algo/api_manager
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/dryout_report.py > /var/log/ceg_sys_logs/dryout_report.log