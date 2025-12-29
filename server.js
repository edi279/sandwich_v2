const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { testConnection } = require('./config/database');
const { runCrawler } = require('./utils/crawler');
const recipeRoutes = require('./routes/recipes');
const tipRoutes = require('./routes/tips');
const menuRoutes = require('./routes/menus');
const commentRoutes = require('./routes/comments');
const uploadRoutes = require('./routes/upload');
const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const searchRoutes = require('./routes/search');
const likeRoutes = require('./routes/likes');
const bookmarkRoutes = require('./routes/bookmarks');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON 파싱 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서빙 (frontend 폴더) - 개발 모드에서 캐시 비활성화
app.use(express.static(path.join(__dirname, 'frontend'), {
  etag: false, // ETag 비활성화
  lastModified: false, // Last-Modified 헤더 비활성화
  setHeaders: (res, path) => {
    // HTML 파일에 대해 캐시 방지 헤더 추가
    if (path.endsWith('.html')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

// 정적 파일 서빙 (public 폴더) - JS, CSS 등
app.use(express.static(path.join(__dirname, 'public')));

// 업로드된 파일 서빙
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 관리자 페이지 접근 제한 미들웨어
// nimda-site.html 요청을 가로채서 관리자가 아니면 404 페이지로 리디렉션
app.get('/nimda-site.html', async (req, res) => {
  try {
    // 쿠키나 세션에서 이메일 확인 (현재는 프론트엔드에서 localStorage 사용)
    // 서버 측에서는 nimda-site.html을 정적 파일로 서빙하되,
    // 프론트엔드에서 페이지 로드 시 관리자 확인 후 리디렉션하도록 함
    
    // 여기서는 항상 파일을 제공하고, 프론트엔드에서 관리자 확인
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'frontend', 'nimda-site.html'));
  } catch (error) {
    console.error('관리자 페이지 접근 오류:', error);
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="0;url=/home.html">
        <title>페이지를 찾을 수 없습니다</title>
        <script>
          window.location.href = '/home.html';
        </script>
      </head>
      <body>
        <h1>페이지를 찾을 수 없습니다</h1>
        <p>홈으로 이동 중...</p>
      </body>
      </html>
    `);
  }
});

// API 라우트
app.use('/api/recipes', recipeRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/admin', adminRoutes);

// 디버깅용 요청 로거 (프로필 수정 API)
app.use('/api/user/profile', (req, res, next) => {
  console.log('[프로필 수정 요청 로거]', {
    method: req.method,
    url: req.url,
    contentType: req.headers['content-type'],
    body: req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  next();
});

app.use('/api/user', userRoutes);

// 루트 경로는 home.html로 이동
app.get('/', (req, res) => {
  // 캐시 방지 헤더 추가
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.redirect('/home.html');
});

// 모든 라우트에서 HTML 파일 제공
app.get('*', (req, res) => {
  // API 경로는 제외
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API를 찾을 수 없습니다.' });
  }
  
  // HTML 파일인 경우 캐시 방지 헤더 추가
  if (req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  
  const filePath = path.join(__dirname, 'frontend', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send('페이지를 찾을 수 없습니다.');
    }
  });
});

// 크롤링 스케줄러 설정 (매주 목요일 오후 2시)
function setupCrawlerScheduler() {
  // 매주 목요일 오후 2시 (0 14 * * 4)
  // cron 표현식: 분 시 일 월 요일
  // 4 = 목요일 (0=일요일, 1=월요일, ..., 6=토요일)
  cron.schedule('0 14 * * 4', async () => {
    console.log('크롤링 스케줄 실행:', new Date().toISOString());
    try {
      await runCrawler();
      console.log('크롤링 스케줄 완료');
    } catch (error) {
      console.error('크롤링 스케줄 오류:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul'
  });
  
  console.log('크롤링 스케줄러 설정 완료: 매주 목요일 오후 2시');
}

// 서버 시작 및 DB 연결 테스트
async function startServer() {
  // 데이터베이스 연결 테스트
  await testConnection();
  
  // 크롤링 스케줄러 설정
  setupCrawlerScheduler();
  
  app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`게시글 작성 페이지: http://localhost:${PORT}/post-editor.html`);
    console.log(`API 엔드포인트:`);
    console.log(`  - 레시피 목록: GET http://localhost:${PORT}/api/recipes`);
    console.log(`  - 정보 공유 목록: GET http://localhost:${PORT}/api/tips`);
    console.log(`  - 메뉴 목록: GET http://localhost:${PORT}/api/menus`);
    console.log(`  - 홈 데이터: GET http://localhost:${PORT}/api/home`);
  });
}

startServer();

