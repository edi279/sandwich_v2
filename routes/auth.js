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

// 만 나이 계산 함수
const calculateAge = (birthStr) => {
  if (!/^\d{8}$/.test(birthStr)) return null;
  
  const year = parseInt(birthStr.substring(0, 4));
  const month = parseInt(birthStr.substring(4, 6)) - 1; // 월은 0부터 시작
  const day = parseInt(birthStr.substring(6, 8));
  
  const birthDate = new Date(year, month, day);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

const formatUserResponse = (user) => ({
  userId: user.USER_ID || user.userId,
  email: user.EMAIL || user.email,
  nickname: user.NICKNAME || user.nickname,
  profileImageUrl: user.PROFILE_IMAGE_URL || user.profileImageUrl || null,
  eventOptIn: (user.EVENT_OPT_IN_YN || user.eventOptIn) === 'Y',
  googleLinked: (user.GOOGLE_LINKED_YN || user.googleLinked) === 'Y'
});

router.post('/register', async (req, res) => {
  const { email, password, nickname, birth, eventOptIn } = req.body;

  if (!email || !password || !nickname || !birth) {
    return res.status(400).json({ success: false, message: '이메일, 비밀번호, 닉네임, 생년월일은 필수 입력 항목입니다.' });
  }

  // 생년월일 형식 검증 (yyyyMMdd, 8자리 숫자)
  if (!/^\d{8}$/.test(birth)) {
    return res.status(400).json({ success: false, message: '생년월일은 8자리 숫자(yyyyMMdd) 형식으로 입력해 주세요.' });
  }

  // 만 14세 미만 검증
  const age = calculateAge(birth);
  if (age === null) {
    return res.status(400).json({ success: false, message: '올바른 생년월일을 입력해 주세요.' });
  }
  
  if (age < 14) {
    return res.status(400).json({ success: false, message: '만 14세 미만은 가입이 불가합니다.' });
  }

  try {
    const [existing] = await pool.query('SELECT USER_ID FROM USER_TB WHERE EMAIL = ?', [email]);

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: '이미 가입된 이메일입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const eventFlag = normalizeFlag(eventOptIn);

    const [result] = await pool.query(
      `INSERT INTO USER_TB (EMAIL, PASSWORD_HASH, NICKNAME, BIRTH, EVENT_OPT_IN_YN, GOOGLE_LINKED_YN)
       VALUES (?, ?, ?, ?, ?, 'N')`,
      [email, hashedPassword, nickname, birth, eventFlag]
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

    return res.status(200).json({
      success: true,
      message: '로그인에 성공했습니다.',
      data: formatUserResponse(user)
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

        return res.status(200).json({
          success: true,
          message: '구글 계정으로 로그인 되었습니다.',
          data: formatUserResponse({ ...user, EVENT_OPT_IN_YN: eventFlag })
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

        return res.status(200).json({
          success: true,
          message: '구글 계정 연동이 완료되었습니다.',
          data: {
            userId: user.USER_ID,
            email: user.EMAIL,
            nickname: user.NICKNAME,
            eventOptIn: eventFlag === 'Y',
            googleLinked: true
          }
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

// 임시 비밀번호 생성 함수
const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

router.post('/find-password', async (req, res) => {
  const { email, birth } = req.body;

  if (!email || !birth) {
    return res.status(400).json({ success: false, message: '이메일과 생년월일을 모두 입력해 주세요.' });
  }

  // 생년월일 형식 검증 (yyyyMMdd, 8자리 숫자)
  if (!/^\d{8}$/.test(birth)) {
    return res.status(400).json({ success: false, message: '생년월일은 8자리 숫자(yyyyMMdd) 형식으로 입력해 주세요.' });
  }

  try {
    // 이메일과 생년월일로 사용자 확인
    const [users] = await pool.query(
      'SELECT USER_ID, EMAIL, BIRTH, PASSWORD_HASH, GOOGLE_LINKED_YN FROM USER_TB WHERE EMAIL = ? AND BIRTH = ?',
      [email, birth]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '입력하신 이메일과 생년월일로 등록된 회원 정보를 찾을 수 없습니다.' 
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

    // 임시 비밀번호 생성
    const tempPassword = generateTempPassword();
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

    // DB에 임시 비밀번호 저장
    await pool.query(
      'UPDATE USER_TB SET PASSWORD_HASH = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = ?',
      [hashedTempPassword, user.USER_ID]
    );

    // 이메일 발송
    try {
      await sendPasswordResetEmail(email, tempPassword);
      console.log(`[비밀번호 찾기] 이메일 발송 성공: ${email}`);
    } catch (emailError) {
      console.error('[비밀번호 찾기] 이메일 발송 실패:', emailError);
      // 이메일 발송 실패해도 임시 비밀번호는 발급되었으므로 성공으로 처리
      // 단, 사용자에게는 이메일 발송 실패를 알림
      return res.status(200).json({
        success: true,
        message: '임시 비밀번호가 발급되었으나 이메일 발송에 실패했습니다. 관리자에게 문의해 주세요.'
      });
    }

    return res.status(200).json({
      success: true,
      message: '임시 비밀번호가 발급되었습니다. 이메일을 확인해 주세요.'
    });
  } catch (error) {
    console.error('비밀번호 찾기 오류:', error);
    return res.status(500).json({ success: false, message: '비밀번호 찾기 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;

