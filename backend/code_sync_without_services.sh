#!/bin/bash

echo "Code Sync Started"
InstallDir=`pwd`
CodeDir='/opt/ceg/algo'
LogPath='/var/log/ceg_sys_logs'
LogerPath='/var/log/ceg_logs'

if [ ! -f /opt/ceg/venv/bin/python ]; then
  echo "venv not found, creating venv"
else

  for folder in UrdhvaBase api_manager ceg_role_master_api orchestrator utilities vendor_ingestion_api authenticator cache_gateway
  do
    if [ ! -d $CodeDir/$folder ]; then
      mkdir -p $CodeDir/$folder
    fi
    rsync -azSP $folder/ $CodeDir/$folder/ --exclude .alg_env --exclude .db_creds_env

  done

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
  if [ ! -d $LogPath ]; then
    mkdir -p $LogPath | true
  fi
  if [ ! -d $LogerPath ]; then
    mkdir -p $LogerPath | true
  fi
fi
