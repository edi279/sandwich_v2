const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const TAG_LIMIT = 13;
const FEATURE_LIMIT = 12;

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

function aggregateTags(rows, key, accumulator) {
  if (!rows || rows.length === 0) return;

  rows.forEach(row => {
    const raw = row[key];
    if (!raw) return;

    raw.split(',').forEach(item => {
      const trimmed = item.trim();
      if (!trimmed) return;

      const normalized = trimmed.replace(/^#+/, '').trim();
      if (!normalized) return;

      const lowerKey = normalized.toLowerCase();
      if (!accumulator.has(lowerKey)) {
        accumulator.set(lowerKey, { tag: normalized, count: 0 });
      }
      accumulator.get(lowerKey).count += 1;
    });
  });
}

router.get('/', async (req, res) => {
  try {
    const tagCounts = new Map();

    const [recipeTags] = await pool.execute(
      `SELECT TAGS FROM RECIPE_CONTENT_TB WHERE TAGS IS NOT NULL AND TRIM(TAGS) <> ''`
    );
    aggregateTags(recipeTags, 'TAGS', tagCounts);

    try {
      const [tipTags] = await pool.execute(
        `SELECT TAGS FROM TIP_CONTENT_TB WHERE TAGS IS NOT NULL AND TRIM(TAGS) <> ''`
      );
      aggregateTags(tipTags, 'TAGS', tagCounts);
    } catch (error) {
      console.warn('TIP_CONTENT_TB 태그 조회 중 오류:', error.message);
    }

    const sortedTags = Array.from(tagCounts.values())
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.tag.localeCompare(b.tag, 'ko');
      })
      .slice(0, TAG_LIMIT);

    const deletedColumnExists = await columnExists('RECIPE_TB', 'DELETED_YN');
    const whereClauses = [];
    const params = [];

    if (deletedColumnExists) {
      whereClauses.push('DELETED_YN = ?');
      params.push('N');
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limitClause = `LIMIT ${FEATURE_LIMIT}`;

    const query = `
      SELECT RECIPE_ID, TITLE, IMAGE_URL, VIEWS
      FROM RECIPE_TB
      ${whereSql}
      ORDER BY VIEWS DESC, CREATED_AT DESC
      ${limitClause}
    `;

    const [postRows] = await pool.execute(query, params);

    const formattedPosts = postRows.map(post => ({
      id: post.RECIPE_ID,
      title: post.TITLE,
      imageUrl: post.IMAGE_URL || '',
      views: post.VIEWS || 0,
      href: `/post-detail.html?type=1&id=${post.RECIPE_ID}`
    }));

    res.json({
      success: true,
      data: {
        tags: sortedTags,
        featuredPosts: formattedPosts
      }
    });
  } catch (error) {
    console.error('홈 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '홈 데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;

