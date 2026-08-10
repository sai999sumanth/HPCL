#!/bin/bash
cd /opt/ceg/algo/services/base_configuration/scripts
source /opt/ceg/venv/bin/activate
unbuffer python retry_camunda_task_vts.py >> /var/log/ceg_sys_logs/retry_camunda_task_vts.log 2>&1
