const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 업로드 디렉토리 생성
const profileUploadDir = path.join(__dirname, '../uploads/profile');
const postImageUploadDir = path.join(__dirname, '../uploads/images');

if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}
if (!fs.existsSync(postImageUploadDir)) {
  fs.mkdirSync(postImageUploadDir, { recursive: true });
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

// 프로필 이미지용 Multer 설정
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profileUploadDir);
  },
  filename: function (req, file, cb) {
    // 파일명: timestamp-원본파일명
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  },
  fileFilter: imageFileFilter
});

// 게시글 이미지용 Multer 설정
const postImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postImageUploadDir);
  },
  filename: function (req, file, cb) {
    // 파일명: timestamp-원본파일명
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

const postImageUpload = multer({
  storage: postImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  },
  fileFilter: imageFileFilter
});

// 프로필 이미지 업로드 엔드포인트
router.post('/image', profileUpload.single('image'), (req, res) => {
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
    console.error('프로필 이미지 업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드 중 오류가 발생했습니다.'
    });
  }
});

// 게시글 이미지 업로드 엔드포인트
router.post('/post-image', postImageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '파일이 업로드되지 않았습니다.'
      });
    }
    
    // 업로드된 파일의 URL 반환
    const fileUrl = `/uploads/images/${req.file.filename}`;
    
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('게시글 이미지 업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드 중 오류가 발생했습니다.'
    });
  }
});

// 여러 이미지 일괄 삭제 엔드포인트 (게시글 작성 중단 시 사용)
router.post('/images/delete', express.raw({ type: ['application/json', 'text/plain'] }), (req, res) => {
  try {
    // sendBeacon으로 전송된 경우 body가 Buffer일 수 있음
    let urls;
    try {
      const bodyStr = req.body.toString();
      const parsed = JSON.parse(bodyStr);
      urls = parsed.urls;
    } catch (e) {
      // 일반 JSON 요청인 경우
      if (req.body && typeof req.body === 'object' && req.body.urls) {
        urls = req.body.urls;
      } else {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 요청 데이터입니다.'
        });
      }
    }
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: '삭제할 이미지 URL 배열이 필요합니다.'
      });
    }
    
    const deleted = [];
    const notFound = [];
    
    urls.forEach(url => {
      if (!url || typeof url !== 'string') return;
      
      // 게시글 이미지만 삭제 (프로필 이미지는 삭제하지 않음)
      if (!url.startsWith('/uploads/images/')) {
        return;
      }
      
      const filename = url.replace('/uploads/images/', '');
      const filePath = path.join(postImageUploadDir, filename);
      
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          deleted.push(url);
        } catch (err) {
          console.error(`이미지 삭제 실패: ${url}`, err);
        }
      } else {
        notFound.push(url);
      }
    });
    
    res.json({
      success: true,
      deleted: deleted.length,
      notFound: notFound.length,
      deletedUrls: deleted,
      notFoundUrls: notFound
    });
  } catch (error) {
    console.error('이미지 일괄 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제 중 오류가 발생했습니다.'
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

