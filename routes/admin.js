const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// 관리자 인증 미들웨어
const checkAdmin = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: '이메일이 필요합니다.' });
    }

    // ADMIN_TB 테이블 존재 여부 확인
    try {
      const [admins] = await pool.query('SELECT ADMIN_ID, EMAIL FROM ADMIN_TB WHERE EMAIL = ?', [email]);
      
      if (admins.length === 0) {
        return res.status(403).json({ success: false, message: '관리자 권한이 없습니다.' });
      }

      req.admin = admins[0];
      next();
    } catch (tableError) {
      // 테이블이 없는 경우 에러 처리
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.error('ADMIN_TB 테이블이 존재하지 않습니다. 데이터베이스 마이그레이션을 실행해주세요.');
        return res.status(500).json({ 
          success: false, 
          message: '관리자 테이블이 존재하지 않습니다. 데이터베이스 마이그레이션을 실행해주세요.' 
        });
      }
      throw tableError;
    }
  } catch (error) {
    console.error('관리자 인증 오류:', error);
    return res.status(500).json({ success: false, message: '관리자 인증 중 오류가 발생했습니다.' });
  }
};

// 사용자 검색 (닉네임, 이메일)
router.post('/users/search', checkAdmin, async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({ success: false, message: '검색어를 입력해주세요.' });
    }

    const searchKeyword = `%${keyword.trim()}%`;

    // 필드 존재 여부 확인 후 쿼리 실행
    try {
      const [users] = await pool.query(
        `SELECT 
          USER_ID,
          EMAIL,
          NICKNAME,
          EVENT_OPT_IN_YN,
          COALESCE(DELETED_YN, 'N') as DELETED_YN,
          COALESCE(BLOCKED_YN, 'N') as BLOCKED_YN,
          CREATED_AT
        FROM USER_TB
        WHERE (NICKNAME LIKE ? OR EMAIL LIKE ?)
        ORDER BY CREATED_AT DESC
        LIMIT 100`,
        [searchKeyword, searchKeyword]
      );

      const userList = users.map(user => ({
        userId: user.USER_ID,
        email: user.EMAIL,
        nickname: user.NICKNAME,
        eventOptIn: user.EVENT_OPT_IN_YN === 'Y',
        withdrawn: user.DELETED_YN === 'Y',
        blocked: user.BLOCKED_YN === 'Y',
        createdAt: user.CREATED_AT
      }));

      return res.status(200).json({
        success: true,
        data: userList
      });
    } catch (queryError) {
      // 필드가 없는 경우를 대비한 대체 쿼리
      if (queryError.code === 'ER_BAD_FIELD_ERROR') {
        const [users] = await pool.query(
          `SELECT 
            USER_ID,
            EMAIL,
            NICKNAME,
            EVENT_OPT_IN_YN,
            'N' as DELETED_YN,
            'N' as BLOCKED_YN,
            CREATED_AT
          FROM USER_TB
          WHERE (NICKNAME LIKE ? OR EMAIL LIKE ?)
          ORDER BY CREATED_AT DESC
          LIMIT 100`,
          [searchKeyword, searchKeyword]
        );

        const userList = users.map(user => ({
          userId: user.USER_ID,
          email: user.EMAIL,
          nickname: user.NICKNAME,
          eventOptIn: user.EVENT_OPT_IN_YN === 'Y',
          withdrawn: false,
          blocked: false,
          createdAt: user.CREATED_AT
        }));

        return res.status(200).json({
          success: true,
          data: userList
        });
      }
      throw queryError;
    }
  } catch (error) {
    console.error('사용자 검색 오류:', error);
    return res.status(500).json({ success: false, message: '사용자 검색 중 오류가 발생했습니다.' });
  }
});

// 사용자 정보 조회
router.post('/users/:userId', checkAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 사용자 ID입니다.' });
    }

    const [users] = await pool.query(
      `SELECT 
        USER_ID,
        EMAIL,
        NICKNAME,
        EVENT_OPT_IN_YN,
        DELETED_YN,
        BLOCKED_YN,
        CREATED_AT,
        UPDATED_AT
      FROM USER_TB
      WHERE USER_ID = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const user = users[0];

    return res.status(200).json({
      success: true,
      data: {
        userId: user.USER_ID,
        email: user.EMAIL,
        nickname: user.NICKNAME,
        eventOptIn: user.EVENT_OPT_IN_YN === 'Y',
        withdrawn: user.DELETED_YN === 'Y',
        blocked: user.BLOCKED_YN === 'Y',
        createdAt: user.CREATED_AT,
        updatedAt: user.UPDATED_AT
      }
    });
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return res.status(500).json({ success: false, message: '사용자 정보 조회 중 오류가 발생했습니다.' });
  }
});

// 사용자 차단/차단 해제
router.post('/users/:userId/block', checkAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { blocked } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 사용자 ID입니다.' });
    }

    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ success: false, message: '차단 상태를 올바르게 입력해주세요.' });
    }

    // 사용자 존재 확인
    const [users] = await pool.query('SELECT USER_ID FROM USER_TB WHERE USER_ID = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const blockedYn = blocked ? 'Y' : 'N';

    await pool.query(
      'UPDATE USER_TB SET BLOCKED_YN = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = ?',
      [blockedYn, userId]
    );

    return res.status(200).json({
      success: true,
      message: blocked ? '사용자가 차단되었습니다.' : '사용자 차단이 해제되었습니다.',
      data: {
        userId,
        blocked
      }
    });
  } catch (error) {
    console.error('사용자 차단 오류:', error);
    return res.status(500).json({ success: false, message: '사용자 차단 처리 중 오류가 발생했습니다.' });
  }
});

// 게시글 삭제 (레시피 또는 정보공유)
router.post('/posts/:postType/:postId/delete', checkAdmin, async (req, res) => {
  try {
    const postType = parseInt(req.params.postType, 10);
    const postId = parseInt(req.params.postId, 10);

    if (isNaN(postType) || (postType !== 1 && postType !== 2)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 게시글 타입입니다. (1: 레시피, 2: 정보공유)' });
    }

    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 게시글 ID입니다.' });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      if (postType === 1) {
        // 레시피 게시글 삭제
        const [recipes] = await connection.query(
          'SELECT RECIPE_ID, TITLE FROM RECIPE_TB WHERE RECIPE_ID = ? AND DELETED_YN = "N"',
          [postId]
        );

        if (recipes.length === 0) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        }

        await connection.query(
          'UPDATE RECIPE_TB SET DELETED_YN = "Y", UPDATED_AT = CURRENT_TIMESTAMP WHERE RECIPE_ID = ?',
          [postId]
        );
      } else {
        // 정보공유 게시글 삭제
        const [tips] = await connection.query(
          'SELECT TIP_ID, TITLE FROM TIP_TB WHERE TIP_ID = ? AND DELETED_YN = "N"',
          [postId]
        );

        if (tips.length === 0) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        }

        await connection.query(
          'UPDATE TIP_TB SET DELETED_YN = "Y", UPDATED_AT = CURRENT_TIMESTAMP WHERE TIP_ID = ?',
          [postId]
        );
      }

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: '게시글이 삭제되었습니다.'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('게시글 삭제 오류:', error);
    return res.status(500).json({ success: false, message: '게시글 삭제 중 오류가 발생했습니다.' });
  }
});

// 게시글 목록 조회 (관리자용) - 통합 리스트
router.post('/posts', checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '' } = req.body;

    const searchKeyword = keyword.trim() ? `%${keyword.trim()}%` : null;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // 전체 개수 조회
    let countQuery = `
      SELECT 
        (SELECT COUNT(*) FROM RECIPE_TB WHERE DELETED_YN = "N" ${searchKeyword ? 'AND (TITLE LIKE ? OR AUTHOR_NAME LIKE ?)' : ''}) +
        (SELECT COUNT(*) FROM TIP_TB WHERE DELETED_YN = "N" ${searchKeyword ? 'AND (TITLE LIKE ? OR AUTHOR_NAME LIKE ?)' : ''}) as total
    `;
    
    const countParams = searchKeyword 
      ? [searchKeyword, searchKeyword, searchKeyword, searchKeyword]
      : [];
    
    const [countResult] = await pool.query(countQuery, countParams);
    const totalCount = countResult[0].total || 0;

    // 통합 게시글 목록 조회 (레시피 + 정보공유) - UNION 사용
    let unionQuery = `
      SELECT 
        r.RECIPE_ID as POST_ID,
        1 as POST_TYPE,
        '레시피' as POST_TYPE_NAME,
        r.TITLE,
        r.AUTHOR_ID,
        r.AUTHOR_NAME,
        r.VIEWS,
        r.CREATED_AT,
        m.MENU_NAME AS CATEGORY_NAME
      FROM RECIPE_TB r
      LEFT JOIN MENU_TB m ON r.CATEGORY = m.MENU_ID
      WHERE r.DELETED_YN = "N"
      ${searchKeyword ? 'AND (r.TITLE LIKE ? OR r.AUTHOR_NAME LIKE ?)' : ''}
      
      UNION ALL
      
      SELECT 
        t.TIP_ID as POST_ID,
        2 as POST_TYPE,
        '정보공유' as POST_TYPE_NAME,
        t.TITLE,
        t.AUTHOR_ID,
        t.AUTHOR_NAME,
        t.VIEWS,
        t.CREATED_AT,
        m2.MENU_NAME AS CATEGORY_NAME
      FROM TIP_TB t
      LEFT JOIN MENU_TB m2 ON t.CATEGORY = m2.MENU_ID
      WHERE t.DELETED_YN = "N"
      ${searchKeyword ? 'AND (t.TITLE LIKE ? OR t.AUTHOR_NAME LIKE ?)' : ''}
      
      ORDER BY CREATED_AT DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [];
    if (searchKeyword) {
      queryParams.push(searchKeyword, searchKeyword, searchKeyword, searchKeyword);
    }
    queryParams.push(limitNum, (pageNum - 1) * limitNum);

    const [posts] = await pool.query(unionQuery, queryParams);

    const postList = posts.map(post => ({
      postId: post.POST_ID,
      postType: post.POST_TYPE,
      postTypeName: post.POST_TYPE_NAME,
      title: post.TITLE,
      authorId: post.AUTHOR_ID,
      authorName: post.AUTHOR_NAME,
      categoryName: post.CATEGORY_NAME,
      views: post.VIEWS || 0,
      createdAt: post.CREATED_AT
    }));

    return res.status(200).json({
      success: true,
      data: {
        posts: postList,
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('게시글 목록 조회 오류:', error);
    return res.status(500).json({ success: false, message: '게시글 목록 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;

