const express = require('express');
const path = require('path');
const { testConnection } = require('./config/database');
const recipeRoutes = require('./routes/recipes');
const tipRoutes = require('./routes/tips');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON 파싱 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서빙 (frontend 폴더)
app.use(express.static(path.join(__dirname, 'frontend')));

// API 라우트
app.use('/api/recipes', recipeRoutes);
app.use('/api/tips', tipRoutes);

// 루트 경로는 terms.html로 리다이렉트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'terms.html'));
});

// 모든 라우트에서 HTML 파일 제공
app.get('*', (req, res) => {
  // API 경로는 제외
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API를 찾을 수 없습니다.' });
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
  });
}

startServer();

