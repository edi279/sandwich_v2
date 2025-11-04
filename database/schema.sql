-- 샌드위치냠냠 데이터베이스 스키마
-- 데이터베이스 생성 (이미 존재하는 경우 무시)
CREATE DATABASE IF NOT EXISTS sandwich_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sandwich_db;

-- "이렇게 만들어요" 게시판 테이블 (RECIPE_TB)
CREATE TABLE IF NOT EXISTS RECIPE_TB (
    RECIPE_ID INT AUTO_INCREMENT PRIMARY KEY COMMENT '레시피 게시글 ID',
    TITLE VARCHAR(200) NOT NULL COMMENT '제목',
    IMAGE_URL VARCHAR(500) COMMENT '이미지 URL',
    AUTHOR_ID INT COMMENT '작성자 ID',
    AUTHOR_NAME VARCHAR(50) COMMENT '작성자 이름',
    CATEGORY VARCHAR(20) NOT NULL DEFAULT 'picnic' COMMENT '카테고리 (picnic: 피크닉/홈카페, lunchbox: 데일리 도시락)',
    CONTENT TEXT COMMENT '내용',
    VIEWS INT DEFAULT 0 COMMENT '조회수',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '작성일',
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
    INDEX idx_category (CATEGORY),
    INDEX idx_created_at (CREATED_AT),
    INDEX idx_views (VIEWS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='레시피 게시판 테이블';

-- "정보 공유해요" 게시판 테이블 (TIP_TB)
CREATE TABLE IF NOT EXISTS TIP_TB (
    TIP_ID INT AUTO_INCREMENT PRIMARY KEY COMMENT '정보 공유 게시글 ID',
    TITLE VARCHAR(200) NOT NULL COMMENT '제목',
    AUTHOR_ID INT COMMENT '작성자 ID',
    AUTHOR_NAME VARCHAR(50) COMMENT '작성자 이름',
    SUBCATEGORY VARCHAR(20) NOT NULL DEFAULT 'sauce' COMMENT '서브카테고리 (sauce: 소스 배합, tool: 조리 도구, sale: 할인 소식, etc: 기타)',
    CONTENT TEXT COMMENT '내용',
    VIEWS INT DEFAULT 0 COMMENT '조회수',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '작성일',
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
    INDEX idx_subcategory (SUBCATEGORY),
    INDEX idx_created_at (CREATED_AT),
    INDEX idx_views (VIEWS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='정보 공유 게시판 테이블';

-- 샘플 데이터는 database/sample-data.sql 파일을 사용하세요
-- 또는 아래 주석을 해제하여 여기에 포함시킬 수 있습니다

-- RECIPE_TB 샘플 데이터
INSERT INTO RECIPE_TB (TITLE, IMAGE_URL, AUTHOR_NAME, CATEGORY, CONTENT, VIEWS) VALUES
('샌드위치 레시피', 'https://cdn.pixabay.com/photo/2017/06/02/18/24/sandwich-2367010_1280.jpg', '홍길동', 'picnic', '피크닉용 샌드위치 레시피입니다.', 150),
('건강한 샌드위치', 'https://cdn.pixabay.com/photo/2015/04/10/00/41/sandwich-715541_1280.jpg', '김철수', 'picnic', '건강한 재료로 만든 샌드위치입니다.', 120),
('햄버거 샌드위치', 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg', '이영희', 'lunchbox', '도시락용 햄버거 샌드위치입니다.', 200),
('맛있는 샌드위치', 'https://cdn.pixabay.com/photo/2016/11/29/03/53/plate-1867705_1280.jpg', '박민수', 'picnic', '정말 맛있는 샌드위치 레시피입니다.', 180),
('브런치 샌드위치', 'https://cdn.pixabay.com/photo/2017/01/18/15/30/bread-1990993_1280.jpg', '최수진', 'picnic', '브런치 메뉴로 좋은 샌드위치입니다.', 90),
('버거 샌드위치', 'https://cdn.pixabay.com/photo/2019/03/24/21/26/burger-4079025_1280.jpg', '이종석', 'lunchbox', '간단하게 만들 수 있는 버거입니다.', 110),
('피크닉 샌드위치', 'https://cdn.pixabay.com/photo/2017/09/06/19/59/food-2722336_1280.jpg', '구본하', 'picnic', '피크닉에 딱 맞는 샌드위치입니다.', 95);

-- TIP_TB 샘플 데이터
INSERT INTO TIP_TB (TITLE, AUTHOR_NAME, SUBCATEGORY, CONTENT, VIEWS) VALUES
('맛있는 소스 레시피 공유합니다', '홍길동', 'sauce', '집에서 쉽게 만들 수 있는 소스 레시피입니다.', 1234),
('샌드위치 만들 때 추천하는 도구들', '김철수', 'tool', '유용한 조리 도구들을 소개합니다.', 987),
('오늘 할인 소식 알려드립니다!', '이영희', 'sale', '이번 주 할인 정보입니다.', 2456),
('샌드위치 냠냠 커뮤니티 가입 안내', '박민수', 'etc', '커뮤니티 가입 방법을 안내합니다.', 3789),
('샌드위치 재료 추천 받습니다', '최수진', 'sauce', '좋은 재료를 추천해주세요.', 654),
('집에서 쉽게 만드는 소스 레시피', '이종석', 'sauce', '간단한 소스 만드는 방법입니다.', 1567),
('조리 도구 구매 후기 공유', '구본하', 'tool', '최근 구매한 도구 후기입니다.', 890),
('이번 주 할인 정보 모음', '이우빈', 'sale', '주간 할인 정보를 모았습니다.', 2345),
('샌드위치 만들기 팁 모음', '강이준', 'etc', '유용한 팁들을 정리했습니다.', 1123),
('유용한 정보 공유합니다', '안정원', 'etc', '공유하고 싶은 정보가 있습니다.', 756);
