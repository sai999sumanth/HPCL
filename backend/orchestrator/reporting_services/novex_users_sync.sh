#!/bin/bash
cd /opt/ceg/algo/orchestrator/reporting_services
unbuffer /opt/ceg/venv/bin/python novex_users_sync.py >> /var/log/ceg_sys_logs/novex_users_sync.log 2>&1