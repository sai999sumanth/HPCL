#!/bin/bash
cd /opt/ceg/algo/orchestrator/reporting_services
unbuffer /opt/ceg/venv/bin/python novex_retail_bi_hourly_report.py >> /var/log/ceg_sys_logs/novex_retail_bi_hourly_report.log 2>&1