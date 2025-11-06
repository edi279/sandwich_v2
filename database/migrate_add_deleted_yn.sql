-- 게시글 삭제 플래그 컬럼 추가 마이그레이션
-- RECIPE_TB와 TIP_TB에 DELETED_YN 컬럼 추가

USE sandwich_db;

-- RECIPE_TB에 DELETED_YN 컬럼 추가 (컬럼이 없을 경우만)
SET @dbname = DATABASE();
SET @tablename = 'RECIPE_TB';
SET @columnname = 'DELETED_YN';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' CHAR(1) NOT NULL DEFAULT ''N'' COMMENT ''삭제 여부 (Y: 삭제됨, N: 정상)'';')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- TIP_TB에 DELETED_YN 컬럼 추가 (컬럼이 없을 경우만)
SET @tablename = 'TIP_TB';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' CHAR(1) NOT NULL DEFAULT ''N'' COMMENT ''삭제 여부 (Y: 삭제됨, N: 정상)'';')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 인덱스 추가 (삭제되지 않은 게시글 조회 최적화)
-- 인덱스가 이미 존재하는지 확인 후 추가
SET @indexname = 'idx_recipe_deleted_yn';
SET @tablename = 'RECIPE_TB';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, '(DELETED_YN);')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @indexname = 'idx_tip_deleted_yn';
SET @tablename = 'TIP_TB';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, '(DELETED_YN);')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

