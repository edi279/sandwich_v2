const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 메뉴 목록 조회 (게시판 및 카테고리)
router.get('/', async (req, res) => {
  try {
    // USED_YN이 'Y'인 메뉴만 조회
    const [rows] = await pool.execute(
      `SELECT MENU_ID, MENU_TYPE, MENU_NAME, MENU_TOP 
       FROM MENU_TB 
       WHERE USED_YN = 'Y' 
       ORDER BY MENU_TYPE, MENU_ID`,
      []
    );
    
    // 게시판(B)과 카테고리(C)로 분류
    const boards = rows.filter(row => row.MENU_TYPE === 'B');
    const categories = rows.filter(row => row.MENU_TYPE === 'C');
    
    res.json({
      success: true,
      data: {
        boards,
        categories
      }
    });
  } catch (error) {
    console.error('메뉴 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '메뉴 목록을 불러오는 중 오류가 발생했습니다.'
    });
  }
});

// 특정 게시판의 카테고리 목록 조회
router.get('/categories/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    
    const [rows] = await pool.execute(
      `SELECT MENU_ID, MENU_NAME, MENU_TOP 
       FROM MENU_TB 
       WHERE MENU_TYPE = 'C' AND MENU_TOP = ? AND USED_YN = 'Y'
       ORDER BY MENU_ID`,
      [boardId]
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('카테고리 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '카테고리 목록을 불러오는 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;

