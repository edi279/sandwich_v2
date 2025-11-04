# 데이터베이스 설정 가이드

## 개요
샌드위치냠냠 애플리케이션의 MySQL 데이터베이스 설정 가이드입니다.

## Docker 환경에서 실행 (추천)

### 1. Docker Compose로 전체 애플리케이션 실행
```bash
docker-compose up -d
```

이 명령어로 MySQL과 웹 애플리케이션이 함께 실행됩니다. MySQL 컨테이너가 시작되면 자동으로 데이터베이스와 테이블이 생성됩니다.

### 2. 샘플 데이터 추가 (선택사항)
샘플 데이터를 추가하려면:
```bash
# 샘플 데이터 파일 실행
docker exec -i sandwich_mysql mysql -u root -prootpassword sandwich_db < database/sample-data.sql
```

또는 MySQL 컨테이너 내부에서:
```bash
docker exec -it sandwich_mysql mysql -u root -prootpassword sandwich_db
```
그 다음 MySQL 프롬프트에서:
```sql
SOURCE /docker-entrypoint-initdb.d/sample-data.sql;
```

또는 전체 스키마 + 샘플 데이터를 한 번에 추가하려면:
```bash
docker exec -i sandwich_mysql mysql -u root -prootpassword < database/schema.sql
```

### 3. 데이터베이스 상태 확인
```bash
# MySQL 컨테이너에 접속하여 확인
docker exec -it sandwich_mysql mysql -u root -prootpassword sandwich_db -e "SHOW TABLES;"
```

**참고**: 호스트에서 MySQL 클라이언트로 직접 접속하려면:
```bash
mysql -h 127.0.0.1 -P 3307 -u sandwich_user -psandwich_password sandwich_db
```

### Docker 환경 변수 (이미 설정됨)
- `DB_HOST`: mysql (Docker 서비스 이름)
- `DB_USER`: sandwich_user
- `DB_PASSWORD`: sandwich_password
- `DB_NAME`: sandwich_db

**참고**: 호스트에서 MySQL에 접근하려면 포트 3307을 사용하세요 (호스트의 3306 포트가 이미 사용 중인 경우).

## 로컬 환경에서 직접 실행

### 1. MySQL 설치 확인
MySQL이 설치되어 있는지 확인하세요:
```bash
mysql --version
```

### 2. 데이터베이스 생성 (샘플 데이터 포함)
샘플 데이터를 포함하여 데이터베이스를 생성하려면:
```bash
mysql -u root -p < database/schema.sql
```

### 3. 데이터베이스 생성 (샘플 데이터 없음)
빈 테이블만 생성하려면:
```bash
mysql -u root -p < database/init.sql
```

### 4. 환경 변수 설정 (선택사항)
기본값으로는 다음 설정이 사용됩니다:
- `DB_HOST`: localhost
- `DB_USER`: root
- `DB_PASSWORD`: (빈 문자열)
- `DB_NAME`: sandwich_db

환경 변수를 설정하려면 `.env` 파일을 생성하거나 서버 실행 시 환경 변수를 설정하세요:
```bash
export DB_HOST=localhost
export DB_USER=your_username
export DB_PASSWORD=your_password
export DB_NAME=sandwich_db
```

### 5. Node.js 패키지 설치
```bash
npm install
```

### 6. 서버 실행
```bash
npm start
```

## 테이블 구조

### RECIPE_TB (이렇게 만들어요 게시판)
- `RECIPE_ID`: 레시피 게시글 ID (Primary Key, AUTO_INCREMENT)
- `TITLE`: 제목 (VARCHAR(200))
- `IMAGE_URL`: 이미지 URL (VARCHAR(500))
- `AUTHOR_ID`: 작성자 ID (INT)
- `AUTHOR_NAME`: 작성자 이름 (VARCHAR(50))
- `CATEGORY`: 카테고리 (VARCHAR(20)) - 'picnic' (피크닉/홈카페) 또는 'lunchbox' (데일리 도시락)
- `CONTENT`: 내용 (TEXT)
- `VIEWS`: 조회수 (INT, 기본값: 0)
- `CREATED_AT`: 작성일 (TIMESTAMP)
- `UPDATED_AT`: 수정일 (TIMESTAMP)

### TIP_TB (정보 공유해요 게시판)
- `TIP_ID`: 정보 공유 게시글 ID (Primary Key, AUTO_INCREMENT)
- `TITLE`: 제목 (VARCHAR(200))
- `AUTHOR_ID`: 작성자 ID (INT)
- `AUTHOR_NAME`: 작성자 이름 (VARCHAR(50))
- `SUBCATEGORY`: 서브카테고리 (VARCHAR(20)) - 'sauce' (소스 배합), 'tool' (조리 도구), 'sale' (할인 소식), 'etc' (기타)
- `CONTENT`: 내용 (TEXT)
- `VIEWS`: 조회수 (INT, 기본값: 0)
- `CREATED_AT`: 작성일 (TIMESTAMP)
- `UPDATED_AT`: 수정일 (TIMESTAMP)

## API 엔드포인트

### 레시피 게시판
- `GET /api/recipes` - 레시피 목록 조회
  - Query Parameters:
    - `category` (optional): 'picnic' 또는 'lunchbox'
    - `page` (optional): 페이지 번호 (기본값: 1)
    - `limit` (optional): 페이지당 개수 (기본값: 20)
- `GET /api/recipes/:id` - 레시피 상세 조회

### 정보 공유 게시판
- `GET /api/tips` - 정보 공유 목록 조회
  - Query Parameters:
    - `subcategory` (optional): 'sauce', 'tool', 'sale', 'etc'
    - `page` (optional): 페이지 번호 (기본값: 1)
    - `limit` (optional): 페이지당 개수 (기본값: 10)
- `GET /api/tips/:id` - 정보 공유 상세 조회

## 문제 해결

### Docker 환경

#### 데이터베이스 연결 실패
1. MySQL 컨테이너가 실행 중인지 확인:
   ```bash
   docker-compose ps
   ```

2. MySQL 로그 확인:
   ```bash
   docker-compose logs mysql
   ```

3. 웹 애플리케이션 로그 확인:
   ```bash
   docker-compose logs web
   ```

#### 테이블이 생성되지 않은 경우
데이터베이스 볼륨을 삭제하고 다시 시작:
```bash
docker-compose down -v
docker-compose up -d
```

#### 샘플 데이터 추가
```bash
docker exec -i sandwich_mysql mysql -u root -prootpassword sandwich_db < database/sample-data.sql
```

### 로컬 환경

#### 데이터베이스 연결 실패
1. MySQL 서버가 실행 중인지 확인하세요:
   ```bash
   sudo systemctl status mysql
   # 또는
   sudo service mysql status
   ```

2. 데이터베이스와 테이블이 생성되었는지 확인하세요:
   ```bash
   mysql -u root -p -e "USE sandwich_db; SHOW TABLES;"
   ```

3. 사용자 권한을 확인하세요:
   ```bash
   mysql -u root -p -e "SHOW GRANTS FOR 'your_username'@'localhost';"
   ```

#### 테이블이 없는 경우
스키마 파일을 다시 실행하세요:
```bash
mysql -u root -p < database/schema.sql
```
