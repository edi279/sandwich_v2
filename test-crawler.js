// 크롤링 테스트 스크립트
// 사용법: node test-crawler.js

const { runCrawler } = require('./utils/crawler');

async function testCrawler() {
  console.log('크롤링 테스트 시작...');
  console.log('='.repeat(50));
  
  try {
    const result = await runCrawler();
    console.log('='.repeat(50));
    console.log('크롤링 테스트 완료!');
    console.log('결과:', result);
    process.exit(0);
  } catch (error) {
    console.error('크롤링 테스트 오류:', error);
    process.exit(1);
  }
}

testCrawler();


