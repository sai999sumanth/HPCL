#!/bin/bash

cd /opt/ceg/algo/api_manager
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/vendor_ingestion_retry.py > /var/log/ceg_sys_logs/vendor_ingestion_retry.log
