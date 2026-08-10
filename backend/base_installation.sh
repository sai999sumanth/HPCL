#!/bin/bash

install_pre-requisites() {
  apt install software-properties-common -y
  apt-get install curl gnupg apt-transport-https -y
  add-apt-repository ppa:deadsnakes/ppa
  apt update
  apt install -y apt install build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libssl-dev \
  libreadline-dev libffi-dev libsqlite3-dev wget libbz2-dev libpq-dev libsasl2-dev python-dev-is-python3 libldap2-dev libssl-dev
  apt install -y python3.12 nginx-core nginx expect python3.12-dev python3.12-venv
}

rabbitmq_configuration() {
  rabbitmqctl add_user hpcl_ceg 'algo#ceg@4321'
  rabbitmqctl delete_user guest
  rabbitmqctl add_vhost hpcl_ceg
  rabbitmqctl set_permissions -p hpcl_ceg hpcl_ceg ".*" ".*" ".*"

}

install_rabbitmq() {
  curl -1sLf "https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA" | sudo gpg --dearmor | sudo tee /usr/share/keyrings/com.rabbitmq.team.gpg > /dev/null
  curl -1sLf "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xf77f1eda57ebb1cc" | sudo gpg --dearmor | sudo tee /usr/share/keyrings/net.launchpad.ppa.rabbitmq.erlang.gpg > /dev/null
  curl -1sLf "https://packagecloud.io/rabbitmq/rabbitmq-server/gpgkey" | sudo gpg --dearmor | sudo tee /usr/share/keyrings/io.packagecloud.rabbitmq.gpg > /dev/null
  tee /etc/apt/sources.list.d/rabbitmq.list <<EOF > /dev/null 2<&1
deb [signed-by=/usr/share/keyrings/net.launchpad.ppa.rabbitmq.erlang.gpg] http://ppa.launchpad.net/rabbitmq/rabbitmq-erlang/ubuntu jammy main
deb-src [signed-by=/usr/share/keyrings/net.launchpad.ppa.rabbitmq.erlang.gpg] http://ppa.launchpad.net/rabbitmq/rabbitmq-erlang/ubuntu jammy main
deb [signed-by=/usr/share/keyrings/io.packagecloud.rabbitmq.gpg] https://packagecloud.io/rabbitmq/rabbitmq-server/ubuntu/ jammy main
deb-src [signed-by=/usr/share/keyrings/io.packagecloud.rabbitmq.gpg] https://packagecloud.io/rabbitmq/rabbitmq-server/ubuntu/ jammy main
EOF
  apt update
  apt-get install -y erlang-base \
    erlang-asn1 erlang-crypto erlang-eldap erlang-ftp erlang-inets \
    erlang-mnesia erlang-os-mon erlang-parsetools erlang-public-key \
    erlang-runtime-tools erlang-snmp erlang-ssl \
    erlang-syntax-tools erlang-tftp erlang-tools erlang-xmerl
  apt-get install rabbitmq-server -y --fix-missing

}