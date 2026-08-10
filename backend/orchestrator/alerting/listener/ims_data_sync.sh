#!/bin/bash

cd /opt/ceg/algo/api_manager
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_ims_truck_swipe.py > /var/log/ceg_sys_logs/sync_ims_truck_swipe.log
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_ims_indent_products.py > /var/log/ceg_sys_logs/sync_ims_indent_products.log
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_ims_indent_request.py > /var/log/ceg_sys_logs/sync_ims_indent_request.log
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_ims_dealer_details.py > /var/log/ceg_sys_logs/sync_ims_dealer_details.log
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_auto_dc_requests.py > /var/log/ceg_sys_logs/sync_auto_dc_requests.log
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_ims_truck_details.py > /var/log/ceg_sys_logs/sync_ims_truck_details.log
unbuffer python /opt/ceg/algo/orchestrator/alerting/listener/sync_ro_ims_report.py >> /var/log/ceg_sys_logs/ro_ims_report_sync.log 2>&1
