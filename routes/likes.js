const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// 추천 수 조회
router.get('/count', async (req, res) => {
  const { postType, postId } = req.query;

  if (!postType || !postId) {
    return res.status(400).json({
      success: false,
      message: 'postType과 postId가 필요합니다.'
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM LIKE_TB WHERE POST_TYPE = ? AND POST_ID = ?',
      [parseInt(postType), parseInt(postId)]
    );

    return res.status(200).json({
      success: true,
      count: rows[0].count || 0
    });
  } catch (error) {
    console.error('추천 수 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '추천 수 조회 중 오류가 발생했습니다.'
    });
  }
});

// 추천 상태 확인
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
      'SELECT COUNT(*) as count FROM LIKE_TB WHERE POST_TYPE = ? AND POST_ID = ? AND USER_ID = ?',
      [parseInt(postType), parseInt(postId), parseInt(userId)]
    );

    return res.status(200).json({
      success: true,
      liked: rows[0].count > 0
    });
  } catch (error) {
    console.error('추천 상태 확인 오류:', error);
    return res.status(500).json({
      success: false,
      message: '추천 상태 확인 중 오류가 발생했습니다.'
    });
  }
});

// 추천 토글 (추천 추가/삭제)
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

    // 기존 추천 확인
    const [existing] = await connection.query(
      'SELECT LIKE_ID FROM LIKE_TB WHERE USER_ID = ? AND POST_TYPE = ? AND POST_ID = ?',
      [parseInt(userId), parseInt(postType), parseInt(postId)]
    );

    let liked = false;
    let count = 0;

    if (existing.length > 0) {
      // 추천 삭제
      await connection.query(
        'DELETE FROM LIKE_TB WHERE USER_ID = ? AND POST_TYPE = ? AND POST_ID = ?',
        [parseInt(userId), parseInt(postType), parseInt(postId)]
      );
      liked = false;
    } else {
      // 추천 추가
      await connection.query(
        'INSERT INTO LIKE_TB (USER_ID, POST_TYPE, POST_ID) VALUES (?, ?, ?)',
        [parseInt(userId), parseInt(postType), parseInt(postId)]
      );
      liked = true;
    }

    // 추천 수 조회
    const [countRows] = await connection.query(
      'SELECT COUNT(*) as count FROM LIKE_TB WHERE POST_TYPE = ? AND POST_ID = ?',
      [parseInt(postType), parseInt(postId)]
    );
    count = countRows[0].count || 0;

    await connection.commit();

    return res.status(200).json({
      success: true,
      liked,
      count
    });
  } catch (error) {
    await connection.rollback();
    console.error('추천 토글 오류:', error);
    return res.status(500).json({
      success: false,
      message: '추천 처리 중 오류가 발생했습니다.'
    });
  } finally {
    connection.release();
  }
});

module.exports = router;


