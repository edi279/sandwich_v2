const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 정보 공유 목록 조회 (리스트형)
router.get('/', async (req, res) => {
  try {
    const { subcategory, category, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offsetNum = (pageNum - 1) * limitNum;
    
    // SQL injection 방지를 위해 숫자인지 확인
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: '잘못된 페이지 또는 limit 값입니다.'
      });
    }
    
    let query = 'SELECT * FROM TIP_TB';
    const params = [];
    let whereConditions = [];
    
    // 삭제되지 않은 게시글만 조회
    whereConditions.push('DELETED_YN = ?');
    params.push('N');
    
    // 카테고리 필터링 (MENU_ID 기반)
    const filterCategory = category || subcategory;
    if (filterCategory) {
      const categoryId = parseInt(filterCategory);
      if (!isNaN(categoryId)) {
        whereConditions.push('CATEGORY = ?');
        params.push(categoryId);
      }
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // LIMIT와 OFFSET은 직접 값으로 삽입 (MySQL 8.0 호환성)
    query += ` ORDER BY CREATED_AT DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [rows] = await pool.execute(query, params);
    
    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) as total FROM TIP_TB';
    const countParams = [];
    const countWhereConditions = [];
    
    // 삭제되지 않은 게시글만 조회
    countWhereConditions.push('DELETED_YN = ?');
    countParams.push('N');
    
    if (filterCategory) {
      const categoryId = parseInt(filterCategory);
      if (!isNaN(categoryId)) {
        countWhereConditions.push('CATEGORY = ?');
        countParams.push(categoryId);
      }
    }
    
    if (countWhereConditions.length > 0) {
      countQuery += ' WHERE ' + countWhereConditions.join(' AND ');
    }
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = countRows[0].total;
    
    // 날짜 포맷팅 (YY.MM.DD)
    const formattedRows = rows.map(row => ({
      ...row,
      CREATED_AT_FORMATTED: new Date(row.CREATED_AT).toLocaleDateString('ko-KR', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, '')
    }));
    
    res.json({
      success: true,
      data: formattedRows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('정보 공유 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '정보 공유 목록을 불러오는 중 오류가 발생했습니다.'
    });
  }
});

// 정보 공유 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 정보 공유 상세 조회 시작 - ID:', id);
    
    // 조회수 증가 (먼저 증가시킴)
    await pool.execute(
      'UPDATE TIP_TB SET VIEWS = VIEWS + 1 WHERE TIP_ID = ?',
      [id]
    );
    
    // View에서 명시적으로 컬럼을 선택하여 데이터 조회 (삭제되지 않은 게시글만)
    const query = `SELECT 
      TIP_ID, TITLE, AUTHOR_ID, AUTHOR_NAME, CATEGORY, CATEGORY_NAME,
      VIEWS, CREATED_AT, UPDATED_AT, TIP_CONTENT_ID, CONTENT, TAGS, DELETED_YN
     FROM V_TIP_WITH_CONTENT WHERE TIP_ID = ? AND (DELETED_YN = 'N' OR DELETED_YN IS NULL)`;
    
    console.log('🔍 실행할 쿼리:', query);
    console.log('🔍 파라미터:', [id]);
    
    const [updatedRows] = await pool.execute(query, [id]);
    
    console.log('🔍 조회된 행 수:', updatedRows.length);
    
    if (updatedRows.length === 0) {
      console.error('❌ 게시글을 찾을 수 없습니다. ID:', id);
      return res.status(404).json({
        success: false,
        message: '게시글을 찾을 수 없습니다.'
      });
    }
    
    const row = updatedRows[0];
    console.log('🔍 조회된 데이터 키:', Object.keys(row));
    console.log('🔍 조회된 row (전체):', JSON.stringify(row, null, 2));
    console.log('🔍 CONTENT 값:', row.CONTENT);
    console.log('🔍 CONTENT 타입:', typeof row.CONTENT);
    console.log('🔍 CONTENT 존재 여부:', row.CONTENT !== null && row.CONTENT !== undefined);
    
    // CONTENT가 null이거나 undefined인 경우 명시적으로 확인
    if (row.CONTENT === null || row.CONTENT === undefined) {
      console.warn('⚠️ CONTENT가 null 또는 undefined입니다. View에서 CONTENT 컬럼이 제대로 조인되었는지 확인하세요.');
      console.warn('⚠️ TIP_CONTENT_ID:', row.TIP_CONTENT_ID);
    }
    
    // 날짜 포맷팅
    const formattedData = {
      ...row,
      CREATED_AT_FORMATTED: new Date(row.CREATED_AT).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, '')
    };
    
    // CONTENT가 제대로 전달되는지 확인
    console.log('✅ formattedData.CONTENT:', formattedData.CONTENT ? '있음' : '없음');
    console.log('✅ 최종 응답 데이터 키:', Object.keys(formattedData));
    
    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('정보 공유 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '게시글을 불러오는 중 오류가 발생했습니다.'
    });
  }
});

// 정보 공유 게시글 작성
router.post('/', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { title, content, subcategory, tags, authorName, userId } = req.body;
    
    // 로그인 체크
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.'
      });
    }
    
    // userId를 정수로 변환
    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 사용자 ID입니다.'
      });
    }
    
    // 사용자 존재 여부 및 차단 여부 확인
    const [userRows] = await connection.execute(
      'SELECT USER_ID, BLOCKED_YN FROM USER_TB WHERE USER_ID = ?',
      [userIdInt]
    );
    
    if (userRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 사용자입니다.'
      });
    }

    // 차단된 사용자 확인
    if (userRows[0].BLOCKED_YN === 'Y') {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: '차단된 사용자는 게시글을 작성할 수 없습니다.'
      });
    }
    
    // 입력값 검증
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '제목과 본문은 필수 항목입니다.'
      });
    }
    
    if (!subcategory) {
      return res.status(400).json({
        success: false,
        message: '카테고리를 선택해주세요.'
      });
    }
    
    // MENU_ID를 직접 CATEGORY로 사용 (정수형)
    const categoryId = parseInt(subcategory);
    
    // TIP_TB에 게시글 삽입 (AUTHOR_ID 포함)
    const [result] = await connection.execute(
      'INSERT INTO TIP_TB (TITLE, AUTHOR_ID, AUTHOR_NAME, CATEGORY) VALUES (?, ?, ?, ?)',
      [title, userIdInt, authorName || '익명', categoryId]
    );
    
    const tipId = result.insertId;
    
    // TIP_CONTENT_TB에 본문 삽입
    await connection.execute(
      'INSERT INTO TIP_CONTENT_TB (TIP_ID, CONTENT, TAGS) VALUES (?, ?, ?)',
      [tipId, content, tags || '']
    );
    
    // 뱃지 체크 (게시글 작성) - 오류가 발생해도 게시글 작성은 성공하도록 처리
    let earnedBadges = [];
    try {
      const badgeUtils = require('../utils/badges');
      earnedBadges = await badgeUtils.checkPostBadges(connection, userIdInt, 2) || []; // 2 = 정보공유
    } catch (badgeError) {
      console.error('뱃지 체크 오류 (게시글 작성은 계속 진행):', badgeError);
      // 뱃지 체크 오류는 무시하고 게시글 작성은 계속 진행
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: '게시글이 작성되었습니다.',
      data: {
        tipId,
        categoryId,
        earnedBadges: earnedBadges || []
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('정보 공유 작성 오류:', error);
    console.error('오류 상세:', error.stack);
    res.status(500).json({
      success: false,
      message: '게시글 작성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

// 정보 공유 게시글 수정
router.put('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { title, content, subcategory, tags, authorName, userId } = req.body;
    
    // 로그인 체크
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.'
      });
    }
    
    // userId를 정수로 변환
    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 사용자 ID입니다.'
      });
    }
    
    // 사용자 존재 여부 확인
    const [userRows] = await connection.execute(
      'SELECT USER_ID FROM USER_TB WHERE USER_ID = ?',
      [userIdInt]
    );
    
    if (userRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 사용자입니다.'
      });
    }
    
    // 입력값 검증
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '제목과 본문은 필수 항목입니다.'
      });
    }
    
    if (!subcategory) {
      return res.status(400).json({
        success: false,
        message: '카테고리를 선택해주세요.'
      });
    }
    
    // 게시글 존재 및 삭제 여부 확인
    const [existingRows] = await connection.execute(
      'SELECT * FROM TIP_TB WHERE TIP_ID = ? AND (DELETED_YN = "N" OR DELETED_YN IS NULL)',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '게시글을 찾을 수 없습니다.'
      });
    }
    
    // 작성자 본인 확인 (AUTHOR_ID가 있는 경우)
    if (existingRows[0].AUTHOR_ID && existingRows[0].AUTHOR_ID !== userIdInt) {
      return res.status(403).json({
        success: false,
        message: '본인이 작성한 게시글만 수정할 수 있습니다.'
      });
    }
    
    const categoryId = parseInt(subcategory);
    
    // TIP_TB 업데이트 (AUTHOR_ID도 업데이트, 기존에 없었던 경우를 위해)
    await connection.execute(
      'UPDATE TIP_TB SET TITLE = ?, AUTHOR_ID = ?, AUTHOR_NAME = ?, CATEGORY = ? WHERE TIP_ID = ?',
      [title, userIdInt, authorName || '익명', categoryId, id]
    );
    
    // TIP_CONTENT_TB 업데이트 (존재하면 업데이트, 없으면 INSERT)
    const [contentRows] = await connection.execute(
      'SELECT * FROM TIP_CONTENT_TB WHERE TIP_ID = ?',
      [id]
    );
    
    if (contentRows.length > 0) {
      await connection.execute(
        'UPDATE TIP_CONTENT_TB SET CONTENT = ?, TAGS = ? WHERE TIP_ID = ?',
        [content, tags || '', id]
      );
    } else {
      await connection.execute(
        'INSERT INTO TIP_CONTENT_TB (TIP_ID, CONTENT, TAGS) VALUES (?, ?, ?)',
        [id, content, tags || '']
      );
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: '게시글이 수정되었습니다.',
      data: {
        tipId: id,
        categoryId
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('정보 공유 수정 오류:', error);
    console.error('오류 상세:', error.stack);
    res.status(500).json({
      success: false,
      message: '게시글 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

// 정보 공유 게시글 삭제 (Soft Delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { authorName } = req.body;
    
    // 게시글 존재 및 삭제 여부 확인
    const [rows] = await pool.execute(
      'SELECT * FROM TIP_TB WHERE TIP_ID = ? AND (DELETED_YN = "N" OR DELETED_YN IS NULL)',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '게시글을 찾을 수 없습니다.'
      });
    }
    
    // 작성자 확인 (선택사항, 필요시 추가)
    // if (authorName && rows[0].AUTHOR_NAME !== authorName) {
    //   return res.status(403).json({
    //     success: false,
    //     message: '작성자만 삭제할 수 있습니다.'
    //   });
    // }
    
    // Soft Delete (DELETED_YN을 'Y'로 변경)
    await pool.execute(
      'UPDATE TIP_TB SET DELETED_YN = "Y" WHERE TIP_ID = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: '게시글이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('정보 공유 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '게시글 삭제 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
