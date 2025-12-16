const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { sendPasswordResetEmail } = require('../config/email');

const router = express.Router();

const normalizeFlag = (value) => {
  if (typeof value === 'string') {
    return value.trim().toUpperCase() === 'Y' ? 'Y' : 'N';
  }
  return value ? 'Y' : 'N';
};


const formatUserResponse = (user) => ({
  userId: user.USER_ID || user.userId,
  email: user.EMAIL || user.email,
  nickname: user.NICKNAME || user.nickname,
  profileImageUrl: user.PROFILE_IMAGE_URL || user.profileImageUrl || null,
  eventOptIn: (user.EVENT_OPT_IN_YN || user.eventOptIn) === 'Y',
  googleLinked: (user.GOOGLE_LINKED_YN || user.googleLinked) === 'Y',
  blocked: (user.BLOCKED_YN || user.blocked || 'N') === 'Y'
});

router.post('/register', async (req, res) => {
  const { email, password, nickname, eventOptIn } = req.body;

  if (!email || !password || !nickname) {
    return res.status(400).json({ success: false, message: '이메일, 비밀번호, 닉네임은 필수 입력 항목입니다.' });
  }

  try {
    const [existing] = await pool.query('SELECT USER_ID FROM USER_TB WHERE EMAIL = ?', [email]);

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: '이미 가입된 이메일입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const eventFlag = normalizeFlag(eventOptIn);

    const [result] = await pool.query(
      `INSERT INTO USER_TB (EMAIL, PASSWORD_HASH, NICKNAME, EVENT_OPT_IN_YN, GOOGLE_LINKED_YN)
       VALUES (?, ?, ?, ?, 'N')`,
      [email, hashedPassword, nickname, eventFlag]
    );

    return res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        userId: result.insertId,
        email,
        nickname,
        eventOptIn: eventFlag === 'Y',
        googleLinked: false
      }
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    return res.status(500).json({ success: false, message: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해 주세요.' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM USER_TB WHERE EMAIL = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '등록되지 않은 이메일입니다.' });
    }

    const user = users[0];

    if (user.GOOGLE_LINKED_YN === 'Y' && !user.PASSWORD_HASH) {
      return res.status(400).json({
        success: false,
        message: '구글 계정으로 가입된 회원입니다. 연동된 계정으로 로그인 해 주세요.'
      });
    }

    if (!user.PASSWORD_HASH) {
      return res.status(400).json({
        success: false,
        message: '이메일 로그인 정보가 설정되어 있지 않습니다.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }

    // 차단 여부 확인 (차단된 사용자도 로그인은 가능하지만, blocked 플래그를 반환)
    const isBlocked = (user.BLOCKED_YN || 'N') === 'Y';

    return res.status(200).json({
      success: true,
      message: '로그인에 성공했습니다.',
      data: formatUserResponse(user),
      blocked: isBlocked
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    return res.status(500).json({ success: false, message: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

router.post('/google', async (req, res) => {
  const { email, googleId, nickname, eventOptIn } = req.body;

  if (!email || !googleId) {
    return res.status(400).json({ success: false, message: '구글 계정 연동을 위한 이메일과 Google ID가 필요합니다.' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM USER_TB WHERE EMAIL = ?', [email]);
    const eventFlag = normalizeFlag(eventOptIn);

    if (users.length > 0) {
      const user = users[0];

      // 이미 동일한 구글 계정으로 연동된 경우
      if (user.GOOGLE_LINKED_YN === 'Y' && user.GOOGLE_ID === googleId) {
        await pool.query(
          `UPDATE USER_TB SET EVENT_OPT_IN_YN = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = ?`,
          [eventFlag, user.USER_ID]
        );

        const isBlocked = (user.BLOCKED_YN || 'N') === 'Y';
        return res.status(200).json({
          success: true,
          message: '구글 계정으로 로그인 되었습니다.',
          data: formatUserResponse({ ...user, EVENT_OPT_IN_YN: eventFlag }),
          blocked: isBlocked
        });
      }

      // 이메일 회원이 구글 계정 연동 시도
      if (user.GOOGLE_LINKED_YN !== 'Y') {
        await pool.query(
          `UPDATE USER_TB
           SET GOOGLE_ID = ?, GOOGLE_LINKED_YN = 'Y', EVENT_OPT_IN_YN = ?, UPDATED_AT = CURRENT_TIMESTAMP
           WHERE USER_ID = ?`,
          [googleId, eventFlag, user.USER_ID]
        );

        const isBlocked = (user.BLOCKED_YN || 'N') === 'Y';
        return res.status(200).json({
          success: true,
          message: '구글 계정 연동이 완료되었습니다.',
          data: {
            userId: user.USER_ID,
            email: user.EMAIL,
            nickname: user.NICKNAME,
            eventOptIn: eventFlag === 'Y',
            googleLinked: true,
            blocked: isBlocked
          },
          blocked: isBlocked
        });
      }

      // 다른 구글 계정이 이미 연동된 경우
      return res.status(409).json({
        success: false,
        message: '다른 구글 계정으로 이미 연동되어 있습니다. 기존 연동을 해제한 후 다시 시도해 주세요.'
      });
    }

    // 구글 계정으로 신규 가입
    const [result] = await pool.query(
      `INSERT INTO USER_TB (EMAIL, PASSWORD_HASH, NICKNAME, EVENT_OPT_IN_YN, GOOGLE_ID, GOOGLE_LINKED_YN)
       VALUES (?, NULL, ?, ?, ?, 'Y')`,
      [
        email,
        nickname || email.split('@')[0],
        eventFlag,
        googleId
      ]
    );

    return res.status(201).json({
      success: true,
      message: '구글 계정으로 회원가입이 완료되었습니다.',
      data: {
        userId: result.insertId,
        email,
        nickname: nickname || email.split('@')[0],
        eventOptIn: eventFlag === 'Y',
        googleLinked: true
      }
    });
  } catch (error) {
    console.error('구글 연동 오류:', error);
    return res.status(500).json({ success: false, message: '구글 계정 연동 처리 중 오류가 발생했습니다.' });
  }
});

// 비밀번호 재설정 토큰 생성 함수
const generateResetToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

router.post('/find-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: '이메일을 입력해 주세요.' });
  }

  try {
    // 이메일로 사용자 확인
    const [users] = await pool.query(
      'SELECT USER_ID, EMAIL, PASSWORD_HASH, GOOGLE_LINKED_YN FROM USER_TB WHERE EMAIL = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '입력하신 이메일로 등록된 회원 정보를 찾을 수 없습니다.' 
      });
    }

    const user = users[0];

    // 구글 계정으로만 가입한 경우 비밀번호 찾기 불가
    if (user.GOOGLE_LINKED_YN === 'Y' && !user.PASSWORD_HASH) {
      return res.status(400).json({
        success: false,
        message: '구글 계정으로 가입된 회원입니다. 구글 계정으로 로그인해 주세요.'
      });
    }

    // 비밀번호 재설정 토큰 생성
    const resetToken = generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1시간 후 만료

    // DB에 토큰 저장
    await pool.query(
      'UPDATE USER_TB SET PASSWORD_RESET_TOKEN = ?, PASSWORD_RESET_EXPIRES = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = ?',
      [resetToken, expiresAt, user.USER_ID]
    );

    // 비밀번호 변경 링크 생성
    const resetLink = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;

    // 이메일 발송
    try {
      await sendPasswordResetEmail(email, resetLink);
      console.log(`[비밀번호 찾기] 이메일 발송 성공: ${email}`);
    } catch (emailError) {
      console.error('[비밀번호 찾기] 이메일 발송 실패:', emailError);
      return res.status(500).json({
        success: false,
        message: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'
      });
    }

    return res.status(200).json({
      success: true,
      message: '비밀번호 재설정 링크가 발송되었습니다. 이메일을 확인해 주세요.'
    });
  } catch (error) {
    console.error('비밀번호 찾기 오류:', error);
    return res.status(500).json({ success: false, message: '비밀번호 찾기 처리 중 오류가 발생했습니다.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: '토큰과 비밀번호를 입력해 주세요.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: '비밀번호는 8자리 이상이어야 합니다.' });
  }

  try {
    // 토큰으로 사용자 확인
    const [users] = await pool.query(
      'SELECT USER_ID, PASSWORD_RESET_TOKEN, PASSWORD_RESET_EXPIRES FROM USER_TB WHERE PASSWORD_RESET_TOKEN = ?',
      [token]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '유효하지 않은 토큰입니다.' 
      });
    }

    const user = users[0];

    // 토큰 만료 확인
    const now = new Date();
    const expiresAt = new Date(user.PASSWORD_RESET_EXPIRES);
    
    if (now > expiresAt) {
      return res.status(400).json({ 
        success: false, 
        message: '비밀번호 재설정 링크가 만료되었습니다. 다시 요청해 주세요.' 
      });
    }

    // 새 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 비밀번호 업데이트 및 토큰 제거
    await pool.query(
      'UPDATE USER_TB SET PASSWORD_HASH = ?, PASSWORD_RESET_TOKEN = NULL, PASSWORD_RESET_EXPIRES = NULL, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = ?',
      [hashedPassword, user.USER_ID]
    );

    console.log(`[비밀번호 재설정] 성공: USER_ID=${user.USER_ID}`);

    return res.status(200).json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    return res.status(500).json({ success: false, message: '비밀번호 재설정 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;

