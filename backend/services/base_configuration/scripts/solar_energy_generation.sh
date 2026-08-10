#!/bin/bash

cd /opt/ceg/algo/api_manager
source /opt/ceg/venv/bin/activate
unbuffer python /opt/ceg/algo/orchestrator/analytics/solar_energy_generation.py > /var/log/ceg_sys_logs/solar_energy_generation.log