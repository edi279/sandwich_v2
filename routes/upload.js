const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 업로드 디렉토리 생성 (프로필 이미지용)
const uploadDir = path.join(__dirname, '../uploads/profile');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 파일 필터
const imageFileFilter = function (req, file, cb) {
  // 이미지 파일만 허용
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
  }
};

// Multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 파일명: timestamp-원본파일명
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  },
  fileFilter: imageFileFilter
});

// 이미지 업로드 엔드포인트
router.post('/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '파일이 업로드되지 않았습니다.'
      });
    }
    
    // 업로드된 파일의 URL 반환
    const fileUrl = `/uploads/profile/${req.file.filename}`;
    
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드 중 오류가 발생했습니다.'
    });
  }
});

// 에러 핸들러
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '파일 크기는 5MB 이하여야 합니다.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: error.message || '파일 업로드 중 오류가 발생했습니다.'
  });
});

module.exports = router;

