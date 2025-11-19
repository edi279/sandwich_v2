const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// 북마크 상태 확인
router.get('/status', async (req, res) => {
  const { postType, postId, userId } = req.query;

  if (!postType || !postId || !userId) {
    return res.status(400).json({
      success: false,
      message: 'postType, postId, userId가 필요합니다.'
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM BOOKMARK_TB WHERE POST_TYPE = ? AND POST_ID = ? AND USER_ID = ?',
      [parseInt(postType), parseInt(postId), parseInt(userId)]
    );

    return res.status(200).json({
      success: true,
      bookmarked: rows[0].count > 0
    });
  } catch (error) {
    console.error('북마크 상태 확인 오류:', error);
    return res.status(500).json({
      success: false,
      message: '북마크 상태 확인 중 오류가 발생했습니다.'
    });
  }
});

// 북마크 토글 (북마크 추가/삭제)
router.post('/toggle', async (req, res) => {
  const { userId, postType, postId } = req.body;

  if (!userId || !postType || !postId) {
    return res.status(400).json({
      success: false,
      message: 'userId, postType, postId가 필요합니다.'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 기존 북마크 확인
    const [existing] = await connection.query(
      'SELECT BOOKMARK_ID FROM BOOKMARK_TB WHERE USER_ID = ? AND POST_TYPE = ? AND POST_ID = ?',
      [parseInt(userId), parseInt(postType), parseInt(postId)]
    );

    let bookmarked = false;

    if (existing.length > 0) {
      // 북마크 삭제
      await connection.query(
        'DELETE FROM BOOKMARK_TB WHERE USER_ID = ? AND POST_TYPE = ? AND POST_ID = ?',
        [parseInt(userId), parseInt(postType), parseInt(postId)]
      );
      bookmarked = false;
    } else {
      // 북마크 추가
      await connection.query(
        'INSERT INTO BOOKMARK_TB (USER_ID, POST_TYPE, POST_ID) VALUES (?, ?, ?)',
        [parseInt(userId), parseInt(postType), parseInt(postId)]
      );
      bookmarked = true;
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      bookmarked
    });
  } catch (error) {
    await connection.rollback();
    console.error('북마크 토글 오류:', error);
    return res.status(500).json({
      success: false,
      message: '북마크 처리 중 오류가 발생했습니다.'
    });
  } finally {
    connection.release();
  }
});

module.exports = router;


