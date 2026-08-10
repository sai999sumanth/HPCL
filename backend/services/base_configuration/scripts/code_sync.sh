#!/bin/bash

rsync -azSP UrdhvaBase/ /opt/ceg/algo/UrdhvaBase/ --exclude .alg_env
rsync -azSP api_manager/  /opt/ceg/algo/api_manager/  --exclude .alg_env
rsync -azSP ceg_role_master_api/  /opt/ceg/algo/ceg_role_master_api/  --exclude .alg_env
rsync -azSP orchestrator/  /opt/ceg/algo/orchestrator/  --exclude .alg_env
rsync -azSP utilities/  /opt/ceg/algo/utilities/  --exclude .alg_env
rsync -azSP vendor_ingestion_api/  /opt/ceg/algo/vendor_ingestion_api/  --exclude .alg_env
rsync -azSP workflow/  /opt/ceg/algo/workflow/  --exclude .alg_env