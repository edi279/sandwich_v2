const nodemailer = require('nodemailer');

// 이메일 전송을 위한 transporter 생성
const createTransporter = () => {
  // 환경 변수에서 이메일 설정 가져오기 (없으면 기본값 사용)
  const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const emailPort = process.env.EMAIL_PORT || 587;
  const emailUser = process.env.EMAIL_USER || '';
  const emailPassword = process.env.EMAIL_PASSWORD || '';
  const emailFrom = process.env.EMAIL_FROM || emailUser;

  // 이메일 설정이 없으면 null 반환 (이메일 발송 불가)
  if (!emailUser || !emailPassword) {
    console.warn('⚠️  이메일 설정이 없습니다. EMAIL_USER와 EMAIL_PASSWORD 환경 변수를 설정해 주세요.');
    return null;
  }

  const transporterConfig = {
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465, // 465 포트는 SSL 사용
    auth: {
      user: emailUser,
      pass: emailPassword
    }
  };

  // Gmail의 경우 추가 설정
  if (emailHost === 'smtp.gmail.com') {
    transporterConfig.requireTLS = true;
    transporterConfig.tls = {
      rejectUnauthorized: false // 개발 환경에서만 사용 권장
    };
  }

  return nodemailer.createTransport(transporterConfig);
};

// 비밀번호 재설정 이메일 발송
const sendPasswordResetEmail = async (toEmail, resetLink) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    throw new Error('이메일 설정이 완료되지 않았습니다.');
  }

  const mailOptions = {
    from: `"샌냠" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '[샌냠] 비밀번호 재설정 링크',
    html: `
      <div style="font-family: 'Pretendard', 'Noto Sans KR', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff6b9d, #ff85b8); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">샌냠</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #ffe0e6; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #333; margin-top: 0;">비밀번호 재설정</h2>
          <p style="color: #666; line-height: 1.6;">
            안녕하세요,<br>
            비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해 주세요.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #ff6b9d, #ff85b8); color: #fff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 16px;">
              비밀번호 재설정하기
            </a>
          </div>
          <div style="background: #fff7fa; border-left: 4px solid #ff6b9d; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #d6336c; font-size: 14px; font-weight: 600;">
              ⚠️ 이 링크는 1시간 동안만 유효합니다.
            </p>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f3f5;">
            버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
            <span style="word-break: break-all; color: #666;">${resetLink}</span>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f3f5;">
            본인이 요청하지 않았다면, 이 이메일을 무시하시기 바랍니다.
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('이메일 발송 성공:', info.messageId);
    console.log('수신자:', toEmail);
    return info;
  } catch (error) {
    console.error('이메일 발송 실패:');
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
    console.error('에러 응답:', error.response);
    console.error('전체 에러:', error);
    throw error;
  }
};

module.exports = {
  sendPasswordResetEmail
};

