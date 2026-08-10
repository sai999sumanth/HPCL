#!/bin/bash

echo "Code Sync Started"
# apt-get install libsasl2-dev python-dev-is-python3 libldap2-dev libssl-dev -y
InstallDir=`pwd`
CodeDir='/opt/ceg/algo'
for folder in UrdhvaBase api_manager ceg_role_master_api orchestrator utilities vendor_ingestion_api authenticator cache_gateway
do
  if [ ! -d $CodeDir/$folder ]; then
    mkdir -p $CodeDir/$folder
  fi
  rsync -azSP $folder/ $CodeDir/$folder/ --exclude .alg_env --exclude .db_creds_env

done


# Copying all service files
rsync -aS "$InstallDir"/services/base_configuration/system_services/* /etc/systemd/system/
systemctl daemon-reload

cd $CodeDir/UrdhvaBase

# shellcheck disable=SC2006
proxy_settings=`env | grep http_proxy`

if [ -z "$proxy_settings" ]; then
    /opt/ceg/venv/bin/python -m pip install -e .
    /opt/ceg/venv/bin/python -m pip install  -r "$InstallDir"/requirements.txt
else
  /opt/ceg/venv/bin/python -m pip install --proxy "$proxy_settings" -e .
  /opt/ceg/venv/bin/python -m pip install --proxy "$proxy_settings" -r "$InstallDir"/requirements.txt
fi

mkdir -p /var/log/ceg_sys_logs/ | true
mkdir -p /var/log/ceg_logs/ | true

cd $CodeDir/api_manager
echo "Creating DB Tables if not available"
/opt/ceg/venv/bin/python -c 'import urdhva_base;import hpcl_ceg_model;import asyncio;print(asyncio.run(urdhva_base.postgresmodel.create_tables()))'


echo "Starting TTL Cache Service"
systemctl start ceg_ttl_cache.service
systemctl enable ceg_ttl_cache.service

echo "Restarting All Base API Services"

for ((port=9001; port <= 9005; port++))
do
  echo "Restarting ceg_api@\"$port\" Service"
  systemctl restart ceg_api@"$port".service
  systemctl enable ceg_api@"$port".service
  sleep 5
done

echo "Restarting DNC API Services"

for ((port=9009; port <= 9009; port++))
do
  echo "Restarting ceg_dnc_role_api@\"$port\" Service"
  systemctl restart ceg_dnc_role_api@"$port".service
  systemctl enable ceg_dnc_role_api@"$port".service
  sleep 5
done

echo "Restarting Vendor Ingestion API Services"

for ((port=9010; port <= 9014; port++))
do
  echo "Restarting ceg_ingest_api@\"$port\" Service"
  systemctl restart ceg_ingest_api@"$port".service
  systemctl enable ceg_ingest_api@"$port".service
  sleep 5
done

systemctl start nginx

# Creating all pending tables

# systemctl start dry_out_cammunda_processor@{camunda_dryout_01,camunda_dryout_02,camunda_dryout_03,camunda_dryout_04,camunda_dryout_05,camunda_dryout_06,camunda_dryout_07,camunda_dryout_08,camunda_dryout_09,camunda_dryout_10}.service
# systemctl start dryout_manager@{camunda_dryout_01,camunda_dryout_02,camunda_dryout_03,camunda_dryout_04,camunda_dryout_05,camunda_dryout_06,camunda_dryout_07,camunda_dryout_08,camunda_dryout_09,camunda_dryout_10}.service
echo "Code Sync Completed"
