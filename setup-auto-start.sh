#!/bin/bash
# Docker Compose 자동 시작 설정 스크립트

SERVICE_NAME="sandwich-v2"
COMPOSE_DIR="/home/ubuntu/sandwich_v2"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# systemd 서비스 파일 생성
sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=Sandwich V2 Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${COMPOSE_DIR}
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}.service

echo "자동 시작 설정이 완료되었습니다!"
echo "이제 EC2 인스턴스가 재시작되면 자동으로 서버가 시작됩니다."
echo ""
echo "서비스 상태 확인: sudo systemctl status ${SERVICE_NAME}"
echo "서비스 시작: sudo systemctl start ${SERVICE_NAME}"
echo "서비스 중지: sudo systemctl stop ${SERVICE_NAME}"

