const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 레시피 목록 조회 (갤러리형)
router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offsetNum = (pageNum - 1) * limitNum;
    
    // SQL injection 방지를 위해 숫자인지 확인
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: '잘못된 페이지 또는 limit 값입니다.'
      });
    }
    
    let query = 'SELECT * FROM RECIPE_TB';
    const params = [];
    
    // 카테고리 필터링
    if (category && (category === 'picnic' || category === 'lunchbox')) {
      query += ' WHERE CATEGORY = ?';
      params.push(category);
    }
    
    // LIMIT와 OFFSET은 직접 값으로 삽입 (MySQL 8.0 호환성)
    query += ` ORDER BY CREATED_AT DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [rows] = await pool.execute(query, params);
    
    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) as total FROM RECIPE_TB';
    const countParams = [];
    if (category && (category === 'picnic' || category === 'lunchbox')) {
      countQuery += ' WHERE CATEGORY = ?';
      countParams.push(category);
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
    console.error('레시피 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '레시피 목록을 불러오는 중 오류가 발생했습니다.'
    });
  }
});

// 레시피 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM RECIPE_TB WHERE RECIPE_ID = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '게시글을 찾을 수 없습니다.'
      });
    }
    
    // 조회수 증가
    await pool.execute(
      'UPDATE RECIPE_TB SET VIEWS = VIEWS + 1 WHERE RECIPE_ID = ?',
      [id]
    );
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('레시피 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '게시글을 불러오는 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
