#!/bin/bash

if [ ! -f /etc/nginx/certs/privatekey.key ]; then
  echo "Nginx certificate files missing, generating"
  mkdir -p /etc/nginx/certs/ | true
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/nginx/certs/privatekey.key -out /etc/nginx/certs/certificate.crt \
    -subj "/C=IN/ST=MH/L=MUM/O=HPCL. /OU=CEG/CN=hindustanpetroleum.com"
fi

mkdir -p /var/log/ceg_sys_logs/ | true
mkdir -p /var/log/ceg_logs/ | true


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
