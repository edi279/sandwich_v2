-- 댓글 관련 트리거 설정 스크립트
-- 게시글 삭제 시 CASCADE 삭제 및 데이터 무결성 검증
USE sandwich_db;

-- ============================================================
-- 트리거 1: 댓글 삽입 시 게시글 존재 여부 확인
-- ============================================================
DELIMITER $$

DROP TRIGGER IF EXISTS trg_comment_insert_validate$$
CREATE TRIGGER trg_comment_insert_validate
BEFORE INSERT ON COMMENT_TB
FOR EACH ROW
BEGIN
    DECLARE post_exists INT DEFAULT 0;
    
    -- POST_TYPE에 따라 해당 게시글이 존재하는지 확인
    IF NEW.POST_TYPE = 1 THEN
        -- 레시피 게시글 확인
        SELECT COUNT(*) INTO post_exists 
        FROM RECIPE_TB 
        WHERE RECIPE_ID = NEW.POST_ID;
        
        IF post_exists = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '해당 레시피 게시글이 존재하지 않습니다.';
        END IF;
    ELSEIF NEW.POST_TYPE = 2 THEN
        -- 정보공유 게시글 확인
        SELECT COUNT(*) INTO post_exists 
        FROM TIP_TB 
        WHERE TIP_ID = NEW.POST_ID;
        
        IF post_exists = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '해당 정보공유 게시글이 존재하지 않습니다.';
        END IF;
    ELSE
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'POST_TYPE은 1(레시피) 또는 2(정보공유)만 가능합니다.';
    END IF;
END$$

-- ============================================================
-- 트리거 2: 댓글 수정 시 게시글 존재 여부 확인
-- ============================================================
DROP TRIGGER IF EXISTS trg_comment_update_validate$$
CREATE TRIGGER trg_comment_update_validate
BEFORE UPDATE ON COMMENT_TB
FOR EACH ROW
BEGIN
    DECLARE post_exists INT DEFAULT 0;
    
    -- POST_TYPE이나 POST_ID가 변경되는 경우에만 확인
    IF NEW.POST_TYPE != OLD.POST_TYPE OR NEW.POST_ID != OLD.POST_ID THEN
        IF NEW.POST_TYPE = 1 THEN
            SELECT COUNT(*) INTO post_exists 
            FROM RECIPE_TB 
            WHERE RECIPE_ID = NEW.POST_ID;
            
            IF post_exists = 0 THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = '해당 레시피 게시글이 존재하지 않습니다.';
            END IF;
        ELSEIF NEW.POST_TYPE = 2 THEN
            SELECT COUNT(*) INTO post_exists 
            FROM TIP_TB 
            WHERE TIP_ID = NEW.POST_ID;
            
            IF post_exists = 0 THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = '해당 정보공유 게시글이 존재하지 않습니다.';
            END IF;
        ELSE
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'POST_TYPE은 1(레시피) 또는 2(정보공유)만 가능합니다.';
        END IF;
    END IF;
END$$

-- ============================================================
-- 트리거 3: 레시피 게시글 삭제 시 해당 댓글 소프트 삭제 (Soft DELETE)
-- ============================================================
DROP TRIGGER IF EXISTS trg_recipe_delete_cascade$$
CREATE TRIGGER trg_recipe_delete_cascade
AFTER DELETE ON RECIPE_TB
FOR EACH ROW
BEGIN
    -- 삭제된 레시피 게시글의 모든 댓글을 소프트 삭제 (DELETED_YN = 'Y')
    UPDATE COMMENT_TB 
    SET DELETED_YN = 'Y', UPDATED_AT = CURRENT_TIMESTAMP
    WHERE POST_TYPE = 1 AND POST_ID = OLD.RECIPE_ID AND DELETED_YN = 'N';
END$$

-- ============================================================
-- 트리거 4: 정보공유 게시글 삭제 시 해당 댓글 소프트 삭제 (Soft DELETE)
-- ============================================================
DROP TRIGGER IF EXISTS trg_tip_delete_cascade$$
CREATE TRIGGER trg_tip_delete_cascade
AFTER DELETE ON TIP_TB
FOR EACH ROW
BEGIN
    -- 삭제된 정보공유 게시글의 모든 댓글을 소프트 삭제 (DELETED_YN = 'Y')
    UPDATE COMMENT_TB 
    SET DELETED_YN = 'Y', UPDATED_AT = CURRENT_TIMESTAMP
    WHERE POST_TYPE = 2 AND POST_ID = OLD.TIP_ID AND DELETED_YN = 'N';
END$$

DELIMITER ;

-- 트리거 생성 완료 메시지
SELECT '댓글 관련 트리거가 성공적으로 생성되었습니다.' AS Status;

