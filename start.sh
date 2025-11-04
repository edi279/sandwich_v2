#!/bin/bash
# Sandwich V2 Docker Compose 시작 스크립트

cd /home/ubuntu/sandwich_v2
docker-compose up -d

echo "서버가 시작되었습니다!"
echo "접속 주소: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"

