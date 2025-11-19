const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 게시물 검색 API
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    
    // 검색어 유효성 검증
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: '검색어를 입력해주세요.'
      });
    }
    
    let keyword = q.trim();
    let isTagSearch = false;
    
    // #로 시작하는 경우 태그 검색으로 처리
    if (keyword.startsWith('#')) {
      isTagSearch = true;
      keyword = keyword.substring(1).trim(); // # 제거
    }
    
    // 최소 2글자 검증
    if (keyword.length < 2) {
      return res.status(400).json({
        success: false,
        message: '검색어는 최소 2글자 이상이어야 합니다.'
      });
    }
    
    let recipeResults, tipResults, userResults = [];
    
    // 태그 검색이 아닌 경우에만 사용자 검색 수행
    if (!isTagSearch) {
      // 사용자 검색 (닉네임 부분일치)
      const userPattern = `%${keyword}%`;
      [userResults] = await pool.execute(
        `SELECT USER_ID, NICKNAME, PROFILE_IMAGE_URL
         FROM USER_TB
         WHERE NICKNAME LIKE ?
         ORDER BY 
           CASE WHEN NICKNAME = ? THEN 1 ELSE 2 END,
           NICKNAME ASC
         LIMIT 10`,
        [userPattern, keyword]
      );
    }
    
    if (isTagSearch) {
      // 태그 검색: 태그 필드에서 정확히 일치하는 태그 검색
      // 태그는 쉼표로 구분되어 있고, 대소문자 구분 없이 검색
      const tagPattern1 = `%${keyword}%`; // 태그 중간에 포함
      const tagPattern2 = `%,${keyword}%`; // 쉼표 뒤에 태그
      const tagPattern3 = `%${keyword},%`; // 태그 뒤에 쉼표
      
      // 레시피 게시글 태그 검색
      [recipeResults] = await pool.execute(
        `SELECT DISTINCT r.RECIPE_ID, r.TITLE, r.IMAGE_URL, r.AUTHOR_NAME, r.VIEWS, r.CREATED_AT
         FROM RECIPE_TB r
         INNER JOIN RECIPE_CONTENT_TB rc ON r.RECIPE_ID = rc.RECIPE_ID
         WHERE r.DELETED_YN = 'N'
           AND rc.TAGS IS NOT NULL
           AND rc.TAGS <> ''
           AND (
             LOWER(rc.TAGS) LIKE LOWER(?)
             OR LOWER(rc.TAGS) LIKE LOWER(?)
             OR LOWER(rc.TAGS) LIKE LOWER(?)
           )`,
        [tagPattern1, tagPattern2, tagPattern3]
      );
      
      // 정보 공유 게시글 태그 검색
      [tipResults] = await pool.execute(
        `SELECT DISTINCT t.TIP_ID, t.TITLE, NULL as IMAGE_URL, t.AUTHOR_NAME, t.VIEWS, t.CREATED_AT
         FROM TIP_TB t
         INNER JOIN TIP_CONTENT_TB tc ON t.TIP_ID = tc.TIP_ID
         WHERE t.DELETED_YN = 'N'
           AND tc.TAGS IS NOT NULL
           AND tc.TAGS <> ''
           AND (
             LOWER(tc.TAGS) LIKE LOWER(?)
             OR LOWER(tc.TAGS) LIKE LOWER(?)
             OR LOWER(tc.TAGS) LIKE LOWER(?)
           )`,
        [tagPattern1, tagPattern2, tagPattern3]
      );
    } else {
      // 일반 검색: 제목, 내용, 댓글 검색
      const searchPattern = `%${keyword}%`;
      
      // 레시피 게시글 검색 (제목, 내용, 댓글)
      [recipeResults] = await pool.execute(
        `SELECT DISTINCT r.RECIPE_ID, r.TITLE, r.IMAGE_URL, r.AUTHOR_NAME, r.VIEWS, r.CREATED_AT
         FROM RECIPE_TB r
         LEFT JOIN RECIPE_CONTENT_TB rc ON r.RECIPE_ID = rc.RECIPE_ID
         WHERE r.DELETED_YN = 'N'
           AND (
             r.TITLE LIKE ? 
             OR rc.CONTENT LIKE ?
             OR EXISTS (
               SELECT 1 FROM COMMENT_TB c 
               WHERE c.POST_TYPE = 1 
                 AND c.POST_ID = r.RECIPE_ID 
                 AND c.DELETED_YN = 'N'
                 AND c.CONTENT LIKE ?
             )
           )`,
        [searchPattern, searchPattern, searchPattern]
      );
      
      // 정보 공유 게시글 검색 (제목, 내용, 댓글)
      [tipResults] = await pool.execute(
        `SELECT DISTINCT t.TIP_ID, t.TITLE, NULL as IMAGE_URL, t.AUTHOR_NAME, t.VIEWS, t.CREATED_AT
         FROM TIP_TB t
         LEFT JOIN TIP_CONTENT_TB tc ON t.TIP_ID = tc.TIP_ID
         WHERE t.DELETED_YN = 'N'
           AND (
             t.TITLE LIKE ? 
             OR tc.CONTENT LIKE ?
             OR EXISTS (
               SELECT 1 FROM COMMENT_TB c 
               WHERE c.POST_TYPE = 2 
                 AND c.POST_ID = t.TIP_ID 
                 AND c.DELETED_YN = 'N'
                 AND c.CONTENT LIKE ?
             )
           )`,
        [searchPattern, searchPattern, searchPattern]
      );
    }
    
    // 결과 포맷팅
    const formatPost = (post, postType) => {
      const postId = post.RECIPE_ID || post.TIP_ID;
      return {
        id: postId,
        postType: postType,
        title: post.TITLE,
        imageUrl: post.IMAGE_URL || null,
        authorName: post.AUTHOR_NAME || '익명',
        views: post.VIEWS || 0,
        createdAt: post.CREATED_AT,
        href: `/post-detail.html?type=${postType}&id=${postId}`
      };
    };
    
    const formattedRecipes = recipeResults.map(post => formatPost(post, 1));
    const formattedTips = tipResults.map(post => formatPost(post, 2));
    
    // 날짜 기준 내림차순 정렬
    const allResults = [...formattedRecipes, ...formattedTips].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // 사용자 결과 포맷팅
    const formattedUsers = userResults.map(user => ({
      id: user.USER_ID,
      nickname: user.NICKNAME,
      profileImageUrl: user.PROFILE_IMAGE_URL || null,
      href: `/my-activity.html?userId=${user.USER_ID}`
    }));
    
    res.json({
      success: true,
      data: {
        keyword: keyword,
        users: formattedUsers,
        results: allResults,
        total: allResults.length,
        userTotal: formattedUsers.length
      }
    });
  } catch (error) {
    console.error('검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '검색 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;

