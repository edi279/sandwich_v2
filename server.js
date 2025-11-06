const express = require('express');
const path = require('path');
const { testConnection } = require('./config/database');
const recipeRoutes = require('./routes/recipes');
const tipRoutes = require('./routes/tips');
const menuRoutes = require('./routes/menus');
const commentRoutes = require('./routes/comments');

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

// API 라우트
app.use('/api/recipes', recipeRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/comments', commentRoutes);

// 루트 경로는 terms.html로 리다이렉트
app.get('/', (req, res) => {
  // 캐시 방지 헤더 추가
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'frontend', 'terms.html'));
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

// 서버 시작 및 DB 연결 테스트
async function startServer() {
  // 데이터베이스 연결 테스트
  await testConnection();
  
  app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`게시글 작성 페이지: http://localhost:${PORT}/post-editor.html`);
    console.log(`API 엔드포인트:`);
    console.log(`  - 레시피 목록: GET http://localhost:${PORT}/api/recipes`);
    console.log(`  - 정보 공유 목록: GET http://localhost:${PORT}/api/tips`);
    console.log(`  - 메뉴 목록: GET http://localhost:${PORT}/api/menus`);
  });
}

startServer();

