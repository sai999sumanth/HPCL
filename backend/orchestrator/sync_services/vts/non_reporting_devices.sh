#!/bin/bash

cd /opt/ceg/algo/api_manager/
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/sync_services/vts/non_reporting_devices.py > /var/log/ceg_logs/non_reporting_devices.log 2>&1