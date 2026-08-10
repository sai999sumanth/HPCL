#!/bin/bash

cd /opt/ceg/algo/api_manager/
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/services/base_configuration/scripts/vts_device_expiry_check.py > /var/log/ceg_sys_logs/vts_device_expiry_check.log 2>&2
