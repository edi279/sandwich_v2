const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const router = express.Router();

// 프로필 수정 API
router.put('/profile', async (req, res) => {
  console.log('[프로필 수정 요청 전체 본문]', JSON.stringify(req.body, null, 2));
  
  const { userId, nickname, password, profileImageUrl } = req.body;

  console.log('[프로필 수정 요청 파싱된 값]', { 
    userId, 
    nickname, 
    hasPassword: !!password, 
    profileImageUrl,
    profileImageUrlType: typeof profileImageUrl,
    reqBodyKeys: Object.keys(req.body)
  });

  if (!userId) {
    return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다.' });
  }

  try {
    // 사용자 존재 확인
    const [users] = await pool.query('SELECT * FROM USER_TB WHERE USER_ID = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const user = users[0];
    const updates = [];
    const params = [];

    // 닉네임 업데이트
    if (nickname !== undefined && nickname !== null && nickname !== '') {
      const trimmedNickname = String(nickname).trim();
      if (trimmedNickname.length === 0) {
        return res.status(400).json({ success: false, message: '닉네임을 입력해 주세요.' });
      }
      updates.push('NICKNAME = ?');
      params.push(trimmedNickname);
    }

    // 비밀번호 업데이트
    if (password !== undefined && password !== null && password !== '') {
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: '비밀번호는 8자리 이상이어야 합니다.' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('PASSWORD_HASH = ?');
      params.push(hashedPassword);
    }

    // 프로필 이미지 URL 업데이트
    console.log('[프로필 이미지 체크 시작]', { 
      profileImageUrl, 
      type: typeof profileImageUrl, 
      isUndefined: profileImageUrl === undefined,
      isNull: profileImageUrl === null,
      isString: typeof profileImageUrl === 'string',
      value: profileImageUrl,
      trimmedLength: typeof profileImageUrl === 'string' ? profileImageUrl.trim().length : 'N/A',
      hasValue: !!profileImageUrl
    });

    // profileImageUrl이 전달되었는지 확인
    // undefined가 아니고, null이 아니고, 빈 문자열이 아닌 경우 업데이트
    if (profileImageUrl !== undefined) {
      // null인 경우도 명시적으로 처리 (프로필 이미지 제거)
      if (profileImageUrl === null) {
        updates.push('PROFILE_IMAGE_URL = ?');
        params.push(null);
        console.log('[프로필 이미지] ✅ null로 설정 (이미지 제거)');
      } 
      // 문자열인 경우
      else if (typeof profileImageUrl === 'string') {
        const trimmedUrl = profileImageUrl.trim();
        if (trimmedUrl.length > 0) {
          updates.push('PROFILE_IMAGE_URL = ?');
          params.push(trimmedUrl);
          console.log('[프로필 이미지] ✅ 업데이트 배열에 추가됨:', trimmedUrl);
        } else {
          console.log('[프로필 이미지] ❌ 빈 문자열 - 업데이트하지 않음');
        }
      }
      // 다른 타입인 경우 문자열로 변환 시도
      else {
        const stringUrl = String(profileImageUrl).trim();
        if (stringUrl.length > 0 && stringUrl !== 'null' && stringUrl !== 'undefined') {
          updates.push('PROFILE_IMAGE_URL = ?');
          params.push(stringUrl);
          console.log('[프로필 이미지] ✅ 타입 변환 후 업데이트 배열에 추가됨:', stringUrl);
        } else {
          console.log('[프로필 이미지] ❌ 유효하지 않은 값:', profileImageUrl);
        }
      }
    } else {
      console.log('[프로필 이미지] ❌ undefined - 업데이트하지 않음');
    }

    console.log('[업데이트 배열]', { updates, params, length: updates.length });

    if (updates.length === 0) {
      console.error('[프로필 업데이트 실패] 업데이트할 항목이 없음', {
        hasNickname: nickname !== undefined,
        hasPassword: password !== undefined,
        hasProfileImageUrl: profileImageUrl !== undefined,
        profileImageUrlValue: profileImageUrl,
        profileImageUrlType: typeof profileImageUrl,
        reqBody: req.body
      });
      return res.status(400).json({ 
        success: false, 
        message: '수정할 정보가 없습니다.',
        debug: {
          receivedFields: {
            userId: !!userId,
            nickname: nickname !== undefined,
            password: password !== undefined,
            profileImageUrl: profileImageUrl !== undefined
          },
          profileImageUrlValue: profileImageUrl,
          profileImageUrlType: typeof profileImageUrl,
          reqBodyKeys: Object.keys(req.body || {}),
          fullReqBody: req.body
        }
      });
    }

    params.push(userId);

    const updateQuery = `UPDATE USER_TB SET ${updates.join(', ')}, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = ?`;
    console.log('[프로필 업데이트 쿼리]', updateQuery);
    console.log('[프로필 업데이트 파라미터]', params);

    await pool.query(updateQuery, params);

    // 업데이트된 사용자 정보 조회
    const [updatedUsers] = await pool.query('SELECT * FROM USER_TB WHERE USER_ID = ?', [userId]);
    const updatedUser = updatedUsers[0];

    return res.status(200).json({
      success: true,
      message: '프로필이 업데이트되었습니다.',
      data: {
        userId: updatedUser.USER_ID,
        email: updatedUser.EMAIL,
        nickname: updatedUser.NICKNAME,
        profileImageUrl: updatedUser.PROFILE_IMAGE_URL || null,
        eventOptIn: updatedUser.EVENT_OPT_IN_YN === 'Y',
        googleLinked: updatedUser.GOOGLE_LINKED_YN === 'Y'
      }
    });
  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    console.error('오류 상세:', error.message);
    console.error('오류 스택:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '프로필 업데이트 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 뱃지 목록 조회 API
router.get('/badges', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다.' });
  }

  try {
    // 모든 뱃지 종류 조회
    const [badgeTypes] = await pool.query('SELECT * FROM BADGE_TYPE_TB ORDER BY BADGE_TYPE_ID');

    // 사용자가 획득한 뱃지 조회
    const [userBadges] = await pool.query(
      'SELECT BADGE_TYPE_ID FROM USER_BADGE_TB WHERE USER_ID = ?',
      [userId]
    );

    const earnedBadgeIds = new Set(userBadges.map(ub => ub.BADGE_TYPE_ID));

    // 뱃지 목록에 획득 여부 추가
    const badges = badgeTypes.map(badge => ({
      badgeId: badge.BADGE_TYPE_ID,
      name: badge.BADGE_NAME,
      icon: badge.BADGE_ICON || '🏅',
      description: badge.BADGE_DESCRIPTION || '',
      earned: earnedBadgeIds.has(badge.BADGE_TYPE_ID),
      conditionType: badge.CONDITION_TYPE,
      conditionValue: badge.CONDITION_VALUE
    }));

    return res.status(200).json({
      success: true,
      data: badges
    });
  } catch (error) {
    console.error('뱃지 조회 오류:', error);
    return res.status(500).json({ success: false, message: '뱃지 조회 중 오류가 발생했습니다.' });
  }
});

// 북마크 목록 조회 API
router.get('/bookmarks', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다.' });
  }

  try {
    // 북마크 목록 조회 (레시피와 정보공유 게시글 모두)
    const [bookmarks] = await pool.query(
      `SELECT 
        b.BOOKMARK_ID,
        b.POST_TYPE,
        b.POST_ID,
        b.CREATED_AT,
        CASE 
          WHEN b.POST_TYPE = 1 THEN r.TITLE
          WHEN b.POST_TYPE = 2 THEN t.TITLE
        END AS TITLE,
        CASE 
          WHEN b.POST_TYPE = 1 THEN r.IMAGE_URL
          WHEN b.POST_TYPE = 2 THEN NULL
        END AS IMAGE_URL
      FROM BOOKMARK_TB b
      LEFT JOIN RECIPE_TB r ON b.POST_TYPE = 1 AND b.POST_ID = r.RECIPE_ID AND r.DELETED_YN = 'N'
      LEFT JOIN TIP_TB t ON b.POST_TYPE = 2 AND b.POST_ID = t.TIP_ID AND t.DELETED_YN = 'N'
      WHERE b.USER_ID = ?
      ORDER BY b.CREATED_AT DESC`,
      [userId]
    );

    const bookmarkList = bookmarks
      .filter(b => b.TITLE) // 삭제된 게시글 제외
      .map(bookmark => ({
        bookmarkId: bookmark.BOOKMARK_ID,
        postType: bookmark.POST_TYPE,
        postId: bookmark.POST_ID,
        title: bookmark.TITLE,
        thumbnail: bookmark.IMAGE_URL || null,
        date: bookmark.CREATED_AT ? new Date(bookmark.CREATED_AT).toLocaleDateString('ko-KR') : '',
        href: `/post-detail.html?type=${bookmark.POST_TYPE}&id=${bookmark.POST_ID}`
      }));

    return res.status(200).json({
      success: true,
      data: bookmarkList
    });
  } catch (error) {
    console.error('북마크 조회 오류:', error);
    return res.status(500).json({ success: false, message: '북마크 조회 중 오류가 발생했습니다.' });
  }
});

// 내가 작성한 글 목록 조회 API
router.get('/posts', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다.' });
  }

  try {
    // 레시피 게시글 목록
    const [recipes] = await pool.query(
      `SELECT r.RECIPE_ID, r.TITLE, r.VIEWS, r.CREATED_AT, m.MENU_NAME AS BOARD_NAME
       FROM RECIPE_TB r
       LEFT JOIN MENU_TB m ON r.CATEGORY = m.MENU_ID
       WHERE r.AUTHOR_ID = ? AND r.DELETED_YN = 'N'
       ORDER BY r.CREATED_AT DESC`,
      [userId]
    );

    // 정보공유 게시글 목록
    const [tips] = await pool.query(
      `SELECT t.TIP_ID, t.TITLE, t.VIEWS, t.CREATED_AT, m.MENU_NAME AS BOARD_NAME
       FROM TIP_TB t
       LEFT JOIN MENU_TB m ON t.CATEGORY = m.MENU_ID
       WHERE t.AUTHOR_ID = ? AND t.DELETED_YN = 'N'
       ORDER BY t.CREATED_AT DESC`,
      [userId]
    );

    const posts = [
      ...recipes.map(recipe => ({
        postId: recipe.RECIPE_ID,
        postType: 1,
        title: recipe.TITLE,
        boardName: recipe.BOARD_NAME || '이렇게 만들어요',
        views: recipe.VIEWS || 0,
        date: recipe.CREATED_AT ? new Date(recipe.CREATED_AT).toLocaleDateString('ko-KR') : '',
        href: `/post-detail.html?type=1&id=${recipe.RECIPE_ID}`
      })),
      ...tips.map(tip => ({
        postId: tip.TIP_ID,
        postType: 2,
        title: tip.TITLE,
        boardName: tip.BOARD_NAME || '정보 공유해요',
        views: tip.VIEWS || 0,
        date: tip.CREATED_AT ? new Date(tip.CREATED_AT).toLocaleDateString('ko-KR') : '',
        href: `/post-detail.html?type=2&id=${tip.TIP_ID}`
      }))
    ].sort((a, b) => {
      // 날짜 기준 내림차순 정렬
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    return res.status(200).json({
      success: true,
      data: posts
    });
  } catch (error) {
    console.error('작성한 글 조회 오류:', error);
    return res.status(500).json({ success: false, message: '작성한 글 조회 중 오류가 발생했습니다.' });
  }
});

// 내가 작성한 댓글 목록 조회 API
router.get('/comments', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다.' });
  }

  try {
    // 작성한 댓글 목록 조회
    const [comments] = await pool.query(
      `SELECT 
        c.COMMENT_ID,
        c.POST_TYPE,
        c.POST_ID,
        c.CONTENT,
        c.CREATED_AT,
        CASE 
          WHEN c.POST_TYPE = 1 THEN r.TITLE
          WHEN c.POST_TYPE = 2 THEN t.TITLE
        END AS POST_TITLE
      FROM COMMENT_TB c
      LEFT JOIN RECIPE_TB r ON c.POST_TYPE = 1 AND c.POST_ID = r.RECIPE_ID AND r.DELETED_YN = 'N'
      LEFT JOIN TIP_TB t ON c.POST_TYPE = 2 AND c.POST_ID = t.TIP_ID AND t.DELETED_YN = 'N'
      WHERE c.AUTHOR_ID = ? AND c.DELETED_YN = 'N'
      ORDER BY c.CREATED_AT DESC`,
      [userId]
    );

    const commentList = comments
      .filter(c => c.POST_TITLE) // 삭제된 게시글의 댓글 제외
      .map(comment => ({
        commentId: comment.COMMENT_ID,
        postType: comment.POST_TYPE,
        postId: comment.POST_ID,
        content: comment.CONTENT,
        postTitle: comment.POST_TITLE || '',
        date: comment.CREATED_AT ? new Date(comment.CREATED_AT).toLocaleDateString('ko-KR') : '',
        postHref: `/post-detail.html?type=${comment.POST_TYPE}&id=${comment.POST_ID}`
      }));

    return res.status(200).json({
      success: true,
      data: commentList
    });
  } catch (error) {
    console.error('작성한 댓글 조회 오류:', error);
    return res.status(500).json({ success: false, message: '작성한 댓글 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;

