const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 댓글 목록 조회
router.get('/', async (req, res) => {
  try {
    const { postType, postId } = req.query;
    
    // 필수 파라미터 확인
    if (!postType || !postId) {
      return res.status(400).json({
        success: false,
        message: 'postType과 postId는 필수 파라미터입니다.'
      });
    }
    
    // postType 유효성 검증 (MENU_ID: 1 = 레시피, 2 = 정보 공유)
    const postTypeId = parseInt(postType);
    if (isNaN(postTypeId) || (postTypeId !== 1 && postTypeId !== 2)) {
      return res.status(400).json({
        success: false,
        message: 'postType은 MENU_ID 값(1 또는 2)이어야 합니다.'
      });
    }
    
    // 댓글 조회 (삭제된 댓글 포함, 작성일 오름차순 정렬)
    const [rows] = await pool.execute(
      `SELECT COMMENT_ID, POST_TYPE, POST_ID, CONTENT, AUTHOR_ID, AUTHOR_NAME, 
              DELETED_YN, CREATED_AT, UPDATED_AT
       FROM COMMENT_TB 
       WHERE POST_TYPE = ? AND POST_ID = ?
       ORDER BY CREATED_AT ASC`,
      [postTypeId, postId]
    );
    
    // 날짜 포맷팅 및 댓글 순번 (삭제 여부와 관계없이 전체 순번)
    const formattedRows = rows.map((row, index) => ({
      ...row,
      COMMENT_INDEX: index + 1, // 댓글 순번 (삭제된 것도 포함한 순번)
      CREATED_AT_FORMATTED: new Date(row.CREATED_AT).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, ''),
      UPDATED_AT_FORMATTED: new Date(row.UPDATED_AT).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, '')
    }));
    
    res.json({
      success: true,
      data: formattedRows,
      count: formattedRows.length
    });
  } catch (error) {
    console.error('댓글 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '댓글 목록을 불러오는 중 오류가 발생했습니다.'
    });
  }
});

// 댓글 작성 (로그인 필수)
router.post('/', async (req, res) => {
  try {
    const { postType, postId, content, userId, authorName } = req.body;
    
    // 필수 입력값 검증
    if (!postType || !postId || !content || !userId) {
      return res.status(400).json({
        success: false,
        message: '게시글 타입, 게시글 ID, 댓글 내용, 사용자 ID는 필수 항목입니다.'
      });
    }
    
    // postType 유효성 검증 (MENU_ID: 1 = 레시피, 2 = 정보 공유)
    const postTypeId = parseInt(postType);
    if (isNaN(postTypeId) || (postTypeId !== 1 && postTypeId !== 2)) {
      return res.status(400).json({
        success: false,
        message: 'postType은 MENU_ID 값(1 또는 2)이어야 합니다.'
      });
    }
    
    // 댓글 내용 길이 검증 (최대 1000자)
    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: '댓글은 최대 1000자까지 작성할 수 있습니다.'
      });
    }
    
    // 사용자 존재 여부 확인
    const [userRows] = await pool.execute(
      'SELECT USER_ID, NICKNAME FROM USER_TB WHERE USER_ID = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    // 댓글 삽입 (트리거가 게시글 존재 여부를 자동으로 검증)
    const [result] = await pool.execute(
      `INSERT INTO COMMENT_TB (POST_TYPE, POST_ID, CONTENT, AUTHOR_ID, AUTHOR_NAME) 
       VALUES (?, ?, ?, ?, ?)`,
      [postTypeId, postId, content, userId, authorName || userRows[0].NICKNAME]
    );
    
    // 생성된 댓글 조회
    const [newComment] = await pool.execute(
      `SELECT COMMENT_ID, POST_TYPE, POST_ID, CONTENT, AUTHOR_ID, AUTHOR_NAME, 
              DELETED_YN, CREATED_AT, UPDATED_AT
       FROM COMMENT_TB 
       WHERE COMMENT_ID = ?`,
      [result.insertId]
    );
    
    const comment = newComment[0];
    const formattedComment = {
      ...comment,
      CREATED_AT_FORMATTED: new Date(comment.CREATED_AT).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, '')
    };
    
    res.json({
      success: true,
      message: '댓글이 작성되었습니다.',
      data: formattedComment
    });
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    
    // 트리거에서 발생한 에러 메시지 처리
    if (error.sqlState === '45000') {
      return res.status(400).json({
        success: false,
        message: error.sqlMessage || '댓글 작성 중 오류가 발생했습니다.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '댓글 작성 중 오류가 발생했습니다.'
    });
  }
});

// 댓글 수정 (로그인 필수)
router.put('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content, userId } = req.body;
    
    // 필수 입력값 검증
    if (!content || !userId) {
      return res.status(400).json({
        success: false,
        message: '댓글 내용과 사용자 ID는 필수 항목입니다.'
      });
    }
    
    // 댓글 내용 길이 검증
    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: '댓글은 최대 1000자까지 작성할 수 있습니다.'
      });
    }
    
    // 댓글 존재 여부 및 작성자 확인
    const [commentRows] = await pool.execute(
      'SELECT AUTHOR_ID, DELETED_YN FROM COMMENT_TB WHERE COMMENT_ID = ?',
      [commentId]
    );
    
    if (commentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '댓글을 찾을 수 없습니다.'
      });
    }
    
    // 삭제된 댓글인지 확인
    if (commentRows[0].DELETED_YN === 'Y') {
      return res.status(400).json({
        success: false,
        message: '삭제된 댓글은 수정할 수 없습니다.'
      });
    }
    
    // 작성자 확인
    if (commentRows[0].AUTHOR_ID !== userId) {
      return res.status(403).json({
        success: false,
        message: '본인이 작성한 댓글만 수정할 수 있습니다.'
      });
    }
    
    // 댓글 수정
    await pool.execute(
      'UPDATE COMMENT_TB SET CONTENT = ? WHERE COMMENT_ID = ?',
      [content, commentId]
    );
    
    // 수정된 댓글 조회
    const [updatedComment] = await pool.execute(
      `SELECT COMMENT_ID, POST_TYPE, POST_ID, CONTENT, AUTHOR_ID, AUTHOR_NAME, 
              DELETED_YN, CREATED_AT, UPDATED_AT
       FROM COMMENT_TB 
       WHERE COMMENT_ID = ?`,
      [commentId]
    );
    
    const comment = updatedComment[0];
    const formattedComment = {
      ...comment,
      CREATED_AT_FORMATTED: new Date(comment.CREATED_AT).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, ''),
      UPDATED_AT_FORMATTED: new Date(comment.UPDATED_AT).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, '')
    };
    
    res.json({
      success: true,
      message: '댓글이 수정되었습니다.',
      data: formattedComment
    });
  } catch (error) {
    console.error('댓글 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '댓글 수정 중 오류가 발생했습니다.'
    });
  }
});

// 댓글 삭제 (Soft Delete - DELETED_YN을 'Y'로 변경, 로그인 필수)
router.delete('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;
    
    // 필수 입력값 검증
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '사용자 ID는 필수 항목입니다.'
      });
    }
    
    // 댓글 존재 여부 및 작성자 확인
    const [commentRows] = await pool.execute(
      'SELECT AUTHOR_ID, DELETED_YN FROM COMMENT_TB WHERE COMMENT_ID = ?',
      [commentId]
    );
    
    if (commentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '댓글을 찾을 수 없습니다.'
      });
    }
    
    // 이미 삭제된 댓글인지 확인
    if (commentRows[0].DELETED_YN === 'Y') {
      return res.status(400).json({
        success: false,
        message: '이미 삭제된 댓글입니다.'
      });
    }
    
    // 작성자 확인
    if (commentRows[0].AUTHOR_ID !== userId) {
      return res.status(403).json({
        success: false,
        message: '본인이 작성한 댓글만 삭제할 수 있습니다.'
      });
    }
    
    // 댓글 소프트 삭제 (DELETED_YN을 'Y'로 변경)
    await pool.execute(
      'UPDATE COMMENT_TB SET DELETED_YN = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE COMMENT_ID = ?',
      ['Y', commentId]
    );
    
    res.json({
      success: true,
      message: '댓글이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '댓글 삭제 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;

