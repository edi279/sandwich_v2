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

-- RECIPE_TB 샘플 데이터 (7개)
INSERT INTO RECIPE_TB (TITLE, IMAGE_URL, AUTHOR_NAME, CATEGORY, CONTENT, VIEWS) VALUES
('에그마요 샌드위치 만들기', 'https://cdn.pixabay.com/photo/2017/06/02/18/24/sandwich-2367010_1280.jpg', '김민수', 'picnic', '부드러운 스크램블 에그와 마요네즈의 조화가 일품인 샌드위치입니다. 신선한 양상추와 토마토를 추가하면 더욱 맛있어요. 피크닉이나 브런치 메뉴로 추천합니다!', 324),
('단백질 듬뿍 치킨 샌드위치', 'https://cdn.pixabay.com/photo/2015/04/10/00/41/sandwich-715541_1280.jpg', '이지은', 'lunchbox', '그릴에 구운 닭가슴살에 아보카도와 로메인 양상추를 넣은 건강한 샌드위치입니다. 도시락으로 가져가도 맛이 변하지 않아요. 올리브오일과 레몬 주스로 간단하게 마리네이드 해주세요.', 456),
('햄치즈 클래식 샌드위치', 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg', '박서연', 'picnic', '전통적인 햄과 치즈의 조합에 버터를 바른 빵이 포인트입니다. 피클과 양파를 추가하면 더욱 풍부한 맛을 느낄 수 있어요. 간단하지만 절대 실패하지 않는 레시피입니다.', 278),
('베지테리언 샌드위치', 'https://cdn.pixabay.com/photo/2016/11/29/03/53/plate-1867705_1280.jpg', '최동현', 'picnic', '호박, 가지, 버섯을 구워서 만든 채식 샌드위치입니다. 허머스와 레몬 밤을 넣으면 중동 스타일의 맛이 납니다. 건강하고 맛있어서 가족 모두 좋아하는 레시피예요.', 189),
('참치 샌드위치 고급화 버전', 'https://cdn.pixabay.com/photo/2017/01/18/15/30/bread-1990993_1280.jpg', '정수진', 'lunchbox', '참치캔에 마요네즈 대신 그릭 요거트와 레몬즙을 넣어 더 가볍고 상큼하게 만든 샌드위치입니다. 셀러리와 양파를 넣어서 식감을 더했어요. 도시락으로 가져가기 좋습니다.', 567),
('블랙 포레스트 햄 샌드위치', 'https://cdn.pixabay.com/photo/2019/03/24/21/26/burger-4079025_1280.jpg', '강민호', 'picnic', '독일식 블랙 포레스트 햄에 크림치즈와 딸기잼을 넣은 달콤하고 짭조름한 조합의 샌드위치입니다. 호밀빵을 사용하면 더욱 고급스러운 맛이 납니다. 특별한 날 만들기 좋아요.', 412),
('한식 샌드위치 - 불고기 샌드위치', 'https://cdn.pixabay.com/photo/2017/09/06/19/59/food-2722336_1280.jpg', '윤서진', 'lunchbox', '불고기 양념에 재운 소고기를 구워서 양배추와 깻잎을 넣은 한식 샌드위치입니다. 고추장과 마요네즈를 섞은 소스를 발라주면 완벽해요. 아이들도 좋아하는 맛입니다.', 398);

-- TIP_TB 샘플 데이터 (15개)
INSERT INTO TIP_TB (TITLE, AUTHOR_NAME, SUBCATEGORY, CONTENT, VIEWS) VALUES
('집에서 만드는 허니 머스타드 소스 레시피', '김민수', 'sauce', '꿀 2큰술, 다진 양파 1큰술, 머스타드 1큰술, 레몬즙 반 큰술, 올리브오일 1큰술을 섞어주세요. 30분 냉장고에 두면 맛이 더욱 깊어집니다. 치킨 샌드위치에 최고예요!', 1234),
('샌드위치 만들 때 필수 도구 추천', '이지은', 'tool', '샌드위치 나이프, 푸드 프로세서, 그릴 팬, 샌드위치 프레스가 있으면 편리합니다. 특히 샌드위치 프레스는 빵을 골고루 눌러주어 식감이 훨씬 좋아집니다.', 987),
('이번 주 대형마트 할인 정보 - 샌드위치 재료', '박서연', 'sale', 'OO마트에서 햄 30% 할인, 치즈 2+1 행사, 신선 야채 세트 50% 할인 중입니다. 이번 주말까지 진행되니 놓치지 마세요!', 2456),
('샌드위치 재료 보관법 완벽 가이드', '최동현', 'etc', '양상추는 물에 젖은 키친타월에 싸서 밀폐용기에 보관하면 오래 신선합니다. 토마토는 냉장고보다 실온에서 보관하는 게 좋아요. 빵은 냉동실에 보관하면 오래 갑니다.', 1567),
('크림치즈 베이스 소스 3가지 변주', '정수진', 'sauce', '1) 딸기잼과 섞어서 단맛 2) 파프리카 파우더와 섞어서 스모키한 맛 3) 다진 양파와 마늘, 허브와 섞어서 허브향. 각각 다른 샌드위치에 어울려요!', 1890),
('샌드위치용 빵 선택 가이드', '강민호', 'tool', '도시락용은 식감이 오래 유지되는 베이글이나 호밀빵 추천. 피크닉용은 부드러운 브리오슈나 화이트 브레드가 좋습니다. 통밀빵은 건강하지만 습기 때문에 주의가 필요해요.', 1123),
('대형마트 주말 할인 - 치즈류 2+1', '윤서진', 'sale', 'XX마트에서 체다치즈, 모짜렐라치즈, 크림치즈 2+1 이벤트 중! 샌드위치용 치즈를 미리 사두면 좋겠네요. 일요일까지 진행됩니다.', 2345),
('샌드위치가 물컹해지는 것을 방지하는 팁', '김민수', 'etc', '토마토는 씨를 제거하고 사용하세요. 양상추는 물기를 완전히 제거한 후 사용하고, 빵은 토스터에 살짝 구워주면 수분 흡수가 줄어듭니다. 도시락용으로 만들 때는 특히 중요해요!', 2789),
('아보카도 소스 만드는 방법', '이지은', 'sauce', '익은 아보카도 1개에 레몬즙 반 개, 마늘 1쪽 다진 것, 소금, 후추를 넣고 으깨어주세요. 올리브오일 조금 넣으면 더 부드러워집니다. 베이컨 샌드위치에 최고예요!', 1456),
('샌드위치 포장 용품 추천', '박서연', 'tool', '도시락용은 밀폐 용기나 파라핀지로 포장하는 게 좋고, 피크닉용은 비닐랩보다는 종이 포장지가 더 예쁘고 환경 친화적입니다. 샌드위치 포장지 전용 용품도 나와있어요.', 890),
('온라인 몰 특가 - 샌드위치 세트 할인', '최동현', 'sale', 'OO몰에서 샌드위치 재료 세트 50% 할인 중입니다. 햄, 치즈, 야채, 빵이 모두 포함되어 있어요. 초보자에게 추천합니다!', 1678),
('샌드위치 만들 때 레이어링 순서 팁', '정수진', 'etc', '빵 > 소스 > 단단한 재료(치즈, 고기) > 야채(양상추, 토마토) > 소스 > 빵 순서가 가장 좋습니다. 이렇게 하면 재료가 골고루 분산되고 맛이 좋아요.', 2034),
('타르타르 소스 홈메이드 레시피', '강민호', 'sauce', '마요네즈 5큰술, 피클 1큰술 다진 것, 양파 1큰술 다진 것, 레몬즙 1큰술, 소금 후추를 섞어주세요. 생선 샌드위치나 치킨 샌드위치에 어울립니다.', 1345),
('샌드위치용 채소 씻기와 준비 팁', '윤서진', 'tool', '양상추는 찬물에 10분 담가둔 후 물기를 완전히 제거하세요. 토마토는 얇게 썰되 씨는 제거하는 게 좋습니다. 오이는 소금을 뿌려서 물기를 빼면 더욱 아삭해요.', 987),
('샌드위치 커뮤니티 이벤트 안내', '김민수', 'etc', '이번 달 샌드위치 레시피 대회를 개최합니다! 참가자 중 추첨을 통해 샌드위치 세트를 증정합니다. 자세한 내용은 공지사항을 확인해주세요. 많은 참여 부탁드려요!', 3789);
