const { pool } = require('../config/database');

/**
 * 뱃지 획득 체크 및 부여
 * @param {Object} connection - DB 커넥션 (트랜잭션용)
 * @param {number} userId - 사용자 ID
 * @param {string} badgeCode - 뱃지 코드 (BA001, BR001, CW001, LG001, CG001, LW001)
 * @returns {Promise<Object|null>} 획득한 뱃지 정보 또는 null
 */
async function checkAndAwardBadge(connection, userId, badgeCode) {
  try {
    // userId를 정수로 확실히 변환
    const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(userIdInt) || userIdInt <= 0) {
      console.error(`[뱃지 체크 실패] 유효하지 않은 사용자 ID: ${userId} (타입: ${typeof userId})`);
      return null;
    }
    
    console.log(`[뱃지 체크 시작] ${badgeCode} - 사용자 ID: ${userIdInt} (원본: ${userId}, 타입: ${typeof userId})`);
    
    // 뱃지 타입 조회
    console.log(`[뱃지 타입 조회] BADGE_TYPE_TB에서 ${badgeCode} 조회 중...`);
    const [badgeTypes] = await connection.query(
      'SELECT BADGE_TYPE_ID, BADGE_NAME, BADGE_ICON, BADGE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE FROM BADGE_TYPE_TB WHERE CONDITION_TYPE = ?',
      [badgeCode]
    );

    console.log(`[뱃지 타입 조회 결과] ${badgeCode}: ${badgeTypes.length}개 발견`);

    if (badgeTypes.length === 0) {
      console.error(`[뱃지 체크 실패] 뱃지 타입을 찾을 수 없습니다: ${badgeCode}`);
      console.error(`[뱃지 체크] BADGE_TYPE_TB에 ${badgeCode} 뱃지가 등록되어 있는지 확인하세요.`);
      // BADGE_TYPE_TB에 데이터가 있는지 확인
      const [allBadges] = await connection.query('SELECT CONDITION_TYPE, BADGE_NAME FROM BADGE_TYPE_TB LIMIT 10');
      console.error(`[뱃지 체크] BADGE_TYPE_TB에 등록된 뱃지 목록 (최대 10개):`, allBadges);
      
      // 뱃지 타입이 없으면 자동으로 삽입 시도
      console.log(`[뱃지 타입 자동 삽입 시도] ${badgeCode} 뱃지 타입을 삽입합니다.`);
      try {
        await initializeBadgeType(connection, badgeCode);
        // 다시 조회
        const [retryBadges] = await connection.query(
          'SELECT BADGE_TYPE_ID, BADGE_NAME, BADGE_ICON, BADGE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE FROM BADGE_TYPE_TB WHERE CONDITION_TYPE = ?',
          [badgeCode]
        );
        if (retryBadges.length > 0) {
          console.log(`[뱃지 타입 자동 삽입 성공] ${badgeCode} 뱃지 타입이 삽입되었습니다.`);
          badgeTypes.push(retryBadges[0]);
        } else {
          console.error(`[뱃지 타입 자동 삽입 실패] ${badgeCode} 뱃지 타입 삽입 후에도 조회되지 않습니다.`);
          return null;
        }
      } catch (initError) {
        console.error(`[뱃지 타입 자동 삽입 오류] ${badgeCode}:`, initError);
        console.error(`[뱃지 타입 자동 삽입 오류] 스택:`, initError.stack);
        return null;
      }
    }

    // badgeTypes 배열이 비어있으면 오류
    if (!badgeTypes || badgeTypes.length === 0) {
      console.error(`[뱃지 체크 실패] 뱃지 타입 배열이 비어있습니다: ${badgeCode}`);
      return null;
    }

    const badgeType = badgeTypes[0];
    console.log(`[뱃지 체크] 뱃지 타입 찾음: ${badgeType.BADGE_NAME} (ID: ${badgeType.BADGE_TYPE_ID})`);

    // 이미 획득한 뱃지인지 확인
    // 뱃지는 한번 획득하면 영구적으로 유지되므로, 이미 획득한 경우 다시 체크하지 않음
    const [existing] = await connection.query(
      'SELECT USER_BADGE_ID, EARNED_AT FROM USER_BADGE_TB WHERE USER_ID = ? AND BADGE_TYPE_ID = ?',
      [userIdInt, badgeType.BADGE_TYPE_ID]
    );

    if (existing.length > 0) {
      console.log(`[뱃지 체크] 이미 획득한 뱃지입니다: ${badgeCode} (사용자 ID: ${userIdInt}, 획득일: ${existing[0].EARNED_AT})`);
      return null; // 이미 획득한 뱃지 - 영구적으로 유지됨
    }

    console.log(`[뱃지 체크] 뱃지 획득 조건 확인 중: ${badgeCode} (사용자 ID: ${userIdInt})`);

    // 뱃지 획득 조건 체크
    // 서버 오류로 이전에 뱃지가 생성되지 않았더라도, 조건을 만족하면 뱃지 부여
    let shouldAward = false;

    switch (badgeCode) {
      case 'BA001': // 환영해요 - 회원 가입 후 최초 게시글 작성
        // 사용자의 전체 게시글 수 확인 (레시피 + 정보공유)
        // DELETED_YN이 NULL이거나 'N'인 경우만 카운트
        // 삭제된 게시글은 카운트하지 않지만, 뱃지는 이미 획득했다면 영구적으로 유지됨
        const [ba001Posts] = await connection.query(
          `SELECT COUNT(*) as count FROM (
            SELECT RECIPE_ID FROM RECIPE_TB WHERE AUTHOR_ID = ? AND (DELETED_YN IS NULL OR DELETED_YN = 'N')
            UNION ALL
            SELECT TIP_ID FROM TIP_TB WHERE AUTHOR_ID = ? AND (DELETED_YN IS NULL OR DELETED_YN = 'N')
          ) AS total_posts`,
          [userIdInt, userIdInt]
        );
        const postCount = ba001Posts[0].count;
        console.log(`[BA001 체크] 사용자 ${userIdInt}의 게시글 수: ${postCount}, 필요: 1`);
        shouldAward = postCount >= 1; // 1개 이상이면 부여 (최초 1회)
        console.log(`[BA001 체크] 뱃지 부여 여부: ${shouldAward}`);
        break;

      case 'BR001': // 맛의 시작 - "이렇게 만들어요" 게시판 게시글 최초 1회 작성
        // 레시피 게시판(게시판 ID = 1) 게시글 수 확인
        // DELETED_YN이 NULL이거나 'N'인 경우만 카운트
        // 삭제된 게시글은 카운트하지 않지만, 뱃지는 이미 획득했다면 영구적으로 유지됨
        // 서버 오류로 이전에 뱃지가 생성되지 않았더라도, 누적된 글이 1개 이상이면 뱃지 부여
        const [br001Posts] = await connection.query(
          'SELECT COUNT(*) as count FROM RECIPE_TB WHERE AUTHOR_ID = ? AND (DELETED_YN IS NULL OR DELETED_YN = ?)',
          [userIdInt, 'N']
        );
        const recipeCount = br001Posts[0].count;
        console.log(`[BR001 체크] 사용자 ${userIdInt}의 레시피 게시글 수: ${recipeCount}, 필요: 1`);
        shouldAward = recipeCount >= 1; // 1개 이상이면 부여 (최초 1회)
        console.log(`[BR001 체크] 뱃지 부여 여부: ${shouldAward}`);
        if (shouldAward) {
          console.log(`[BR001 체크] 조건 만족 - 뱃지 부여 가능 (이전에 서버 오류로 생성되지 않았더라도 이번에 생성됨)`);
        }
        break;

      case 'CW001': // 교류의 시작 - 댓글 최초 5개 작성
        const [cw001Comments] = await connection.query(
          'SELECT COUNT(*) as count FROM COMMENT_TB WHERE AUTHOR_ID = ? AND DELETED_YN = ?',
          [userIdInt, 'N']
        );
        const commentCount = cw001Comments[0].count;
        console.log(`[CW001 체크] 사용자 ${userIdInt}의 댓글 수: ${commentCount}, 필요: ${badgeType.CONDITION_VALUE}`);
        shouldAward = commentCount >= badgeType.CONDITION_VALUE;
        break;

      case 'LG001': // 소문의 시작 - 내가 작성한 게시글이 최초로 추천 5회를 받음
        // 사용자의 게시글 중 하나라도 추천 5회 이상 받았는지 확인
        const [lg001Likes] = await connection.query(
          `SELECT COUNT(*) as count FROM LIKE_TB l
           INNER JOIN (
             SELECT RECIPE_ID as POST_ID, 1 as POST_TYPE FROM RECIPE_TB WHERE AUTHOR_ID = ? AND DELETED_YN = 'N'
             UNION ALL
             SELECT TIP_ID as POST_ID, 2 as POST_TYPE FROM TIP_TB WHERE AUTHOR_ID = ? AND DELETED_YN = 'N'
           ) p ON l.POST_ID = p.POST_ID AND l.POST_TYPE = p.POST_TYPE
           GROUP BY l.POST_ID, l.POST_TYPE
           HAVING count >= ?`,
          [userIdInt, userIdInt, badgeType.CONDITION_VALUE]
        );
        shouldAward = lg001Likes.length > 0;
        break;

      case 'CG001': // 이슈의 시작 - 내가 작성한 게시글에 댓글이 최초로 10개 이상 달림
        // 사용자의 게시글 중 하나라도 댓글 10개 이상 받았는지 확인
        const [cg001Comments] = await connection.query(
          `SELECT COUNT(*) as count FROM COMMENT_TB c
           INNER JOIN (
             SELECT RECIPE_ID as POST_ID, 1 as POST_TYPE FROM RECIPE_TB WHERE AUTHOR_ID = ? AND DELETED_YN = 'N'
             UNION ALL
             SELECT TIP_ID as POST_ID, 2 as POST_TYPE FROM TIP_TB WHERE AUTHOR_ID = ? AND DELETED_YN = 'N'
           ) p ON c.POST_ID = p.POST_ID AND c.POST_TYPE = p.POST_TYPE
           WHERE c.DELETED_YN = 'N'
           GROUP BY c.POST_ID, c.POST_TYPE
           HAVING count >= ?`,
          [userIdInt, userIdInt, badgeType.CONDITION_VALUE]
        );
        shouldAward = cg001Comments.length > 0;
        break;

      case 'LW001': // 따스한 추천자 - 내가 추천한 게시글이 누적 30개
        const [lw001Likes] = await connection.query(
          'SELECT COUNT(*) as count FROM LIKE_TB WHERE USER_ID = ?',
          [userIdInt]
        );
        shouldAward = lw001Likes[0].count >= badgeType.CONDITION_VALUE;
        break;

      default:
        return null;
    }

    if (!shouldAward) {
      console.log(`[뱃지 체크] 조건 미달성: ${badgeCode} (사용자 ID: ${userIdInt})`);
      return null;
    }

    // 뱃지 부여
    try {
      console.log(`[뱃지 부여 시도] ${badgeCode} - USER_ID: ${userIdInt}, BADGE_TYPE_ID: ${badgeType.BADGE_TYPE_ID}`);
      console.log(`[뱃지 부여 시도] INSERT 쿼리 실행: INSERT INTO USER_BADGE_TB (USER_ID, BADGE_TYPE_ID) VALUES (${userIdInt}, ${badgeType.BADGE_TYPE_ID})`);
      
      const [insertResult] = await connection.query(
        'INSERT INTO USER_BADGE_TB (USER_ID, BADGE_TYPE_ID) VALUES (?, ?)',
        [userIdInt, badgeType.BADGE_TYPE_ID]
      );
      
      console.log(`[뱃지 획득] ✅ ${badgeType.BADGE_NAME} (${badgeCode}) - 사용자 ID: ${userIdInt}, INSERT ID: ${insertResult.insertId}`);
      console.log(`[뱃지 획득] INSERT 결과:`, insertResult);
      
      // INSERT가 성공했는지 확인
      if (!insertResult || !insertResult.insertId) {
        console.error(`[뱃지 부여 실패] INSERT 결과가 비정상적입니다:`, insertResult);
        return null;
      }
    } catch (insertError) {
      console.error(`[뱃지 부여 실패] ${badgeCode} (사용자 ID: ${userIdInt}):`, insertError);
      console.error(`[뱃지 부여 실패] 오류 코드: ${insertError.code}, 메시지: ${insertError.message}`);
      console.error(`[뱃지 부여 실패] 오류 스택:`, insertError.stack);
      // UNIQUE 제약조건 위반인 경우 (이미 획득한 뱃지)는 무시
      if (insertError.code === 'ER_DUP_ENTRY') {
        console.log(`[뱃지 체크] 이미 획득한 뱃지 (UNIQUE 제약조건): ${badgeCode}`);
        return null;
      }
      throw insertError; // 다른 오류는 다시 throw
    }

    const badgeResult = {
      badgeId: badgeType.BADGE_TYPE_ID,
      badgeName: badgeType.BADGE_NAME,
      badgeIcon: badgeType.BADGE_ICON,
      badgeDescription: badgeType.BADGE_DESCRIPTION
    };
    
    console.log(`[뱃지 체크 완료] ${badgeCode} - 반환할 뱃지 정보:`, badgeResult);
    return badgeResult;
  } catch (error) {
    console.error(`[뱃지 체크 오류] ${badgeCode} (사용자 ID: ${userId}):`, error);
    console.error(`[뱃지 체크 오류] 오류 메시지:`, error.message);
    console.error(`[뱃지 체크 오류] 오류 스택:`, error.stack);
    return null; // 오류 발생 시 뱃지 부여 실패 (트랜잭션 롤백 방지)
  }
}

/**
 * 게시글 작성 후 뱃지 체크
 * @param {Object} connection - DB 커넥션
 * @param {number} userId - 사용자 ID
 * @param {number} postType - 게시글 타입 (1: 레시피, 2: 정보공유)
 * @returns {Promise<Array>} 획득한 뱃지 목록
 */
async function checkPostBadges(connection, userId, postType) {
  console.log(`[checkPostBadges 시작] userId: ${userId}, postType: ${postType}`);
  const earnedBadges = [];

  // BA001: 환영해요 - 최초 게시글 작성
  console.log(`[checkPostBadges] BA001 뱃지 체크 시작`);
  const ba001 = await checkAndAwardBadge(connection, userId, 'BA001');
  console.log(`[checkPostBadges] BA001 뱃지 체크 결과:`, ba001);
  if (ba001) {
    earnedBadges.push(ba001);
    console.log(`[checkPostBadges] BA001 뱃지 추가됨`);
  }

  // BR001: 맛의 시작 - 레시피 게시판 최초 게시글 작성
  if (postType === 1) {
    console.log(`[checkPostBadges] BR001 뱃지 체크 시작 (레시피 게시판)`);
    const br001 = await checkAndAwardBadge(connection, userId, 'BR001');
    console.log(`[checkPostBadges] BR001 뱃지 체크 결과:`, br001);
    if (br001) {
      earnedBadges.push(br001);
      console.log(`[checkPostBadges] BR001 뱃지 추가됨`);
    }
  } else {
    console.log(`[checkPostBadges] BR001 뱃지 체크 스킵 (postType: ${postType}, 레시피가 아님)`);
  }

  console.log(`[checkPostBadges 완료] 획득한 뱃지 개수: ${earnedBadges.length}`, earnedBadges);
  return earnedBadges;
}

/**
 * 댓글 작성 후 뱃지 체크
 * @param {Object} connection - DB 커넥션
 * @param {number} userId - 사용자 ID
 * @returns {Promise<Array>} 획득한 뱃지 목록
 */
async function checkCommentWriteBadges(connection, userId) {
  const earnedBadges = [];

  // CW001: 교류의 시작 - 댓글 5개 작성
  const cw001 = await checkAndAwardBadge(connection, userId, 'CW001');
  if (cw001) earnedBadges.push(cw001);

  return earnedBadges;
}

/**
 * 추천 받을 때 뱃지 체크
 * @param {Object} connection - DB 커넥션
 * @param {number} postAuthorId - 게시글 작성자 ID
 * @param {number} postType - 게시글 타입
 * @param {number} postId - 게시글 ID
 * @returns {Promise<Array>} 획득한 뱃지 목록
 */
async function checkLikeGetBadges(connection, postAuthorId, postType, postId) {
  const earnedBadges = [];

  // LG001: 소문의 시작 - 게시글이 추천 5회 받음
  const lg001 = await checkAndAwardBadge(connection, postAuthorId, 'LG001');
  if (lg001) earnedBadges.push(lg001);

  return earnedBadges;
}

/**
 * 댓글 받을 때 뱃지 체크
 * @param {Object} connection - DB 커넥션
 * @param {number} postAuthorId - 게시글 작성자 ID
 * @param {number} postType - 게시글 타입
 * @param {number} postId - 게시글 ID
 * @returns {Promise<Array>} 획득한 뱃지 목록
 */
async function checkCommentGetBadges(connection, postAuthorId, postType, postId) {
  const earnedBadges = [];

  // CG001: 이슈의 시작 - 게시글에 댓글 10개 이상 달림
  const cg001 = await checkAndAwardBadge(connection, postAuthorId, 'CG001');
  if (cg001) earnedBadges.push(cg001);

  return earnedBadges;
}

/**
 * 추천 누적 시 뱃지 체크
 * @param {Object} connection - DB 커넥션
 * @param {number} userId - 추천한 사용자 ID
 * @returns {Promise<Array>} 획득한 뱃지 목록
 */
async function checkLikeWriteBadges(connection, userId) {
  const earnedBadges = [];

  // LW001: 따스한 추천자 - 추천 누적 30개
  const lw001 = await checkAndAwardBadge(connection, userId, 'LW001');
  if (lw001) earnedBadges.push(lw001);

  return earnedBadges;
}

/**
 * 뱃지 타입 초기화 (BADGE_TYPE_TB에 데이터가 없을 때 자동 삽입)
 */
async function initializeBadgeType(connection, badgeCode) {
  const badgeData = {
    'BA001': {
      name: '환영해요',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#0D5423" class="bi bi-emoji-smile" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M4.285 9.567a.5.5 0 0 1 .683.183A3.5 3.5 0 0 0 8 11.5a3.5 3.5 0 0 0 3.032-1.75.5.5 0 1 1 .866.5A4.5 4.5 0 0 1 8 12.5a4.5 4.5 0 0 1-3.898-2.25.5.5 0 0 1 .183-.683M7 6.5C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5m4 0c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5"/></svg>',
      description: '회원 가입 후 최초 게시글 작성',
      value: 1
    },
    'BR001': {
      name: '맛의 시작',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#9D9EA8" class="bi bi-fork-knife" viewBox="0 0 16 16"><path d="M13 .5c0-.276-.226-.506-.498-.465-1.703.257-2.94 2.012-3 8.462a.5.5 0 0 0 .498.5c.56.01 1 .13 1 1.003v5.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5zM4.25 0a.25.25 0 0 1 .25.25v5.122a.128.128 0 0 0 .256.006l.233-5.14A.25.25 0 0 1 5.24 0h.522a.25.25 0 0 1 .25.238l.233 5.14a.128.128 0 0 0 .256-.006V.25A.25.25 0 0 1 6.75 0h.29a.5.5 0 0 1 .498.458l.423 5.07a1.69 1.69 0 0 1-1.059 1.711l-.053.022a.92.92 0 0 0-.58.884L6.47 15a.971.971 0 1 1-1.942 0l.202-6.855a.92.92 0 0 0-.58-.884l-.053-.022a1.69 1.69 0 0 1-1.059-1.712L3.462.458A.5.5 0 0 1 3.96 0z"/></svg>',
      description: '"이렇게 만들어요" 게시판 게시글 최초 1회 작성',
      value: 1
    },
    'CW001': {
      name: '교류의 시작',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#0E7C49" class="bi bi-chat-quote" viewBox="0 0 16 16"><path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105"/><path d="M7.066 6.76A1.665 1.665 0 0 0 4 7.668a1.667 1.667 0 0 0 2.561 1.406c-.131.389-.375.804-.777 1.22a.417.417 0 0 0 .6.58c1.486-1.54 1.293-3.214.682-4.112zm4 0A1.665 1.665 0 0 0 8 7.668a1.667 1.667 0 0 0 2.561 1.406c-.131.389-.375.804-.777 1.22a.417.417 0 0 0 .6.58c1.486-1.54 1.293-3.214.682-4.112z"/></svg>',
      description: '댓글 최초 5개 작성',
      value: 5
    },
    'LG001': {
      name: '소문의 시작',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#0D6EFD" class="bi bi-hand-thumbs-up" viewBox="0 0 16 16"><path d="M8.864.046C7.908-.193 7.02.53 6.956 1.466c-.072 1.051-.23 2.016-.428 2.59-.125.36-.479 1.013-1.04 1.639-.557.623-1.282 1.178-2.131 1.41C2.685 7.288 2 7.87 2 8.72v4.001c0 .845.682 1.464 1.448 1.545 1.07.114 1.564.415 2.068.723l.048.03c.272.165.578.348.97.484.397.136.861.217 1.466.217h3.5c.937 0 1.599-.477 1.934-1.064a1.86 1.86 0 0 0 .254-.912c0-.152-.023-.312-.077-.464.201-.263.38-.578.488-.901.11-.33.172-.762.004-1.149.069-.13.12-.269.159-.403.077-.27.113-.568.113-.857 0-.288-.036-.585-.113-.856a2 2 0 0 0-.138-.362 1.9 1.9 0 0 0 .234-1.734c-.206-.592-.682-1.1-1.2-1.272-.847-.282-1.803-.276-2.516-.211a10 10 0 0 0-.443.05 9.4 9.4 0 0 0-.062-4.509A1.38 1.38 0 0 0 9.125.111zM11.5 14.721H8c-.51 0-.863-.069-1.14-.164-.281-.097-.506-.228-.776-.393l-.04-.024c-.555-.339-1.198-.731-2.49-.868-.333-.036-.554-.29-.554-.55V8.72c0-.254.226-.543.62-.65 1.095-.3 1.977-.996 2.614-1.708.635-.71 1.064-1.475 1.238-1.978.243-.7.407-1.768.482-2.85.025-.362.36-.594.667-.518l.262.066c.16.04.258.143.288.255a8.34 8.34 0 0 1-.145 4.725.5.5 0 0 0 .595.644l.003-.001.014-.003.058-.014a9 9 0 0 1 1.036-.157c.663-.06 1.457-.054 2.11.164.175.058.45.3.57.65.107.308.087.67-.266 1.022l-.353.353.353.354c.043.043.105.141.154.315.048.167.075.37.075.581 0 .212-.027.414-.075.582-.05.174-.111.272-.154.315l-.353.353.353.354c.047.047.109.177.005.488a2.2 2.2 0 0 1-.505.805l-.353.353.353.354c.006.005.041.05.041.17a.9.9 0 0 1-.121.416c-.165.288-.503.56-1.066.56z"/></svg>',
      description: '내가 작성한 게시글이 최초로 추천 5회를 받음',
      value: 5
    },
    'CG001': {
      name: '이슈의 시작',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#FCEF00" class="bi bi-lightning" viewBox="0 0 16 16"><path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641zM6.374 1 4.168 8.5H7.5a.5.5 0 0 1 .478.647L6.78 13.04 11.478 7H8a.5.5 0 0 1-.474-.658L9.306 1z"/></svg>',
      description: '내가 작성한 게시글에 댓글이 최초로 10개 이상 달림',
      value: 10
    },
    'LW001': {
      name: '따스한 추천자',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#DEA49A" class="bi bi-search-heart" viewBox="0 0 16 16"><path d="M6.5 4.482c1.664-1.673 5.825 1.254 0 5.018-5.825-3.764-1.664-6.69 0-5.018"/><path d="M13 6.5a6.47 6.47 0 0 1-1.258 3.844q.06.044.115.098l3.85 3.85a1 1 0 0 1-1.414 1.415l-3.85-3.85a1 1 0 0 1-.1-.115h.002A6.5 6.5 0 1 1 13 6.5M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11"/></svg>',
      description: '내가 추천한 게시글이 누적 30개',
      value: 30
    }
  };

  const badge = badgeData[badgeCode];
  if (!badge) {
    throw new Error(`알 수 없는 뱃지 코드: ${badgeCode}`);
  }

  await connection.query(
    'INSERT IGNORE INTO BADGE_TYPE_TB (BADGE_NAME, BADGE_ICON, BADGE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE) VALUES (?, ?, ?, ?, ?)',
    [badge.name, badge.icon, badge.description, badgeCode, badge.value]
  );
}

module.exports = {
  checkPostBadges,
  checkCommentWriteBadges,
  checkLikeGetBadges,
  checkCommentGetBadges,
  checkLikeWriteBadges,
  initializeBadgeType
};

