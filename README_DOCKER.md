# Docker 실행 가이드

## EC2 인스턴스 재시작 후 실행 방법

### 방법 1: 간단한 명령어 (추천)
```bash
cd /home/ubuntu/sandwich_v2 && docker-compose up -d
```

### 방법 2: 스크립트 사용
```bash
cd /home/ubuntu/sandwich_v2 && bash start.sh
```

### 방법 3: 자동 시작 설정 (한 번만 설정)
```bash
cd /home/ubuntu/sandwich_v2 && sudo bash setup-auto-start.sh
```

## 유용한 명령어

### 컨테이너 상태 확인
```bash
docker-compose ps
```

### 로그 확인
```bash
docker-compose logs -f
```

### 컨테이너 중지
```bash
docker-compose stop
```

### 컨테이너 재시작
```bash
docker-compose restart
```

### 컨테이너 완전 삭제
```bash
docker-compose down
```

