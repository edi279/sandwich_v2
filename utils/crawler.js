const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { pool } = require('../config/database');

// 크롤링할 키워드 목록
const KEYWORDS = [
  '잼', '크림', '치즈', '버터', '요거트', '케첩', '머스타드',
  '오일', '올리브유', '솔트', '소금', '모짜렐라', '까망베르',
  '마스카르포네', '마스카포네', '체다', "올리브", "피클"
];

// 최소 할인율 기준 (이 값 이상인 제품만 크롤링)
const MIN_DISCOUNT_RATE = 30;

// 할인 소식 카테고리 ID (동적으로 찾기)
let discountCategoryId = null;

/**
 * 할인 소식 카테고리 ID 찾기
 * TIP_TB 테이블에서 CATEGORY=7이 '할인 소식' 카테고리입니다.
 */
async function findDiscountCategoryId() {
  try {
    // CATEGORY=7이 '할인 소식' 카테고리
    const discountCategoryId = 7;

    // 검증: MENU_TB에서 MENU_ID=7이 존재하고 사용 중인지 확인
    const [rows] = await pool.execute(
      `SELECT MENU_ID FROM MENU_TB 
       WHERE MENU_ID = ? 
       AND USED_YN = 'Y'
       LIMIT 1`,
      [discountCategoryId]
    );

    if (rows.length > 0) {
      return discountCategoryId;
    }

    // 검증 실패 시에도 7 반환 (사용자 요구사항에 따라)
    console.warn(`할인 소식 카테고리(MENU_ID=${discountCategoryId})를 MENU_TB에서 찾을 수 없습니다. 하지만 CATEGORY=7로 사용합니다.`);
    return discountCategoryId;
  } catch (error) {
    console.error('할인 소식 카테고리 찾기 오류:', error);
    // 오류 발생 시에도 7 반환
    return 7;
  }
}

/**
 * 제품명에 키워드가 포함되어 있는지 확인
 */
function containsKeyword(productName) {
  const name = productName.toLowerCase();
  return KEYWORDS.some(keyword => name.includes(keyword.toLowerCase()));
}

/**
 * 할인율 계산 (예: "10%" -> 10)
 */
function parseDiscountRate(discountText) {
  if (!discountText) return 0;

  // "10%" 형식에서 숫자 추출
  const match = discountText.match(/(\d+)%/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // "10% 할인" 형식
  const match2 = discountText.match(/(\d+)\s*%?\s*할인/);
  if (match2) {
    return parseInt(match2[1], 10);
  }

  return 0;
}

/**
 * 품절 여부 확인
 */
function isSoldOut($, element) {
  if (!element) return false;
  const $el = $(element);
  const text = $el.text().toLowerCase();
  const html = $el.html().toLowerCase();

  // 품절 관련 키워드 확인 (더 정확하게)
  const soldOutKeywords = ['품절', 'sold out', 'out of stock', '재고없음', '매진'];

  // 제품명이나 설명에 "품절"이 포함되어 있으면 품절로 간주
  // 하지만 "품절"이 제품명의 일부일 수도 있으므로 주의
  const hasSoldOutKeyword = soldOutKeywords.some(keyword => {
    // 버튼이나 특정 요소에만 있는 경우만 품절로 간주
    const buttonText = $el.find('button, a[class*="buy"], a[class*="cart"], .btn').text().toLowerCase();
    if (buttonText.includes(keyword)) {
      return true;
    }
    // 클래스명에 품절 관련 키워드가 있는 경우
    if ($el.hasClass('sold-out') || $el.hasClass('out-of-stock') ||
      $el.find('.sold-out, .out-of-stock, [class*="sold"], [class*="out"]').length > 0) {
      return true;
    }
    return false;
  });

  return hasSoldOutKeyword;
}

/**
 * 단일 페이지 크롤링
 */
async function crawlPage(page, url) {
  try {
    console.log(`크롤링 중: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 페이지 로딩 대기
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 페이지가 완전히 로드될 때까지 대기
    try {
      await page.waitForSelector('body', { timeout: 10000 });
      // 추가 대기 시간 (JavaScript 렌더링 대기)
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (e) {
      console.log('페이지 로딩 대기 중 타임아웃:', e.message);
    }

    const content = await page.content();
    const $ = cheerio.load(content);

    // 디버깅: 페이지 구조 확인
    const bodyText = $('body').text().substring(0, 1000);
    const bodyHtml = $('body').html() ? $('body').html().substring(0, 1000) : 'HTML 없음';
    console.log('페이지 본문 텍스트 일부:', bodyText.substring(0, 200));
    console.log('페이지 HTML 일부:', bodyHtml.substring(0, 200));

    // 링크 개수 확인 및 샘플 출력
    const allLinks = $('a[href*="goods"]');
    console.log(`상품 링크 개수: ${allLinks.length}`);

    // 샘플 링크 출력 (처음 10개)
    if (allLinks.length > 0) {
      console.log('샘플 링크 (처음 10개):');
      let count = 0;
      allLinks.each((i, el) => {
        if (count >= 10) return false; // break
        const $link = $(el);
        const href = $link.attr('href') || '';
        const text = $link.text().trim().substring(0, 50) || '(텍스트 없음)';
        console.log(`  ${count + 1}. ${href} - "${text}"`);
        count++;
      });
    }

    const products = [];

    // 그리드형 상품 목록에서 상품 찾기
    // /goods/view?no= 형식의 링크 찾기
    const productLinks = $('a[href*="/goods/view"]');
    console.log(`상품 상세 링크 개수: ${productLinks.length}`);

    const foundProducts = new Set();

    // 각 상품 링크에서 정보 추출
    productLinks.each((index, element) => {
      try {
        const $link = $(element);
        let link = $link.attr('href') || '';

        // 상품 상세 페이지 링크인지 확인 (no 파라미터 포함)
        if (!link.includes('/goods/view') || !link.includes('no=')) {
          return;
        }

        // 중복 체크
        if (foundProducts.has(link)) return;
        foundProducts.add(link);

        // 제품명 추출 - div.gname 또는 span.goods_name에서 찾기
        let name = '';

        // 1. 리스트 페이지: div.gname 찾기
        const $container = $link.closest('li, div, td, .item, .product, [class*="item"], [class*="product"]');
        if ($container.length > 0) {
          name = $container.find('div.gname').first().text().trim();
        }

        // 2. 상세 페이지: span.goods_name 찾기 (현재는 리스트 페이지이므로 이건 나중에 필요시)
        if (!name || name.length < 2) {
          name = $container.find('span.goods_name').first().text().trim();
        }

        // 3. 대체 방법: 링크 주변에서 제품명 찾기
        if (!name || name.length < 2) {
          const $parent = $link.parent();
          name = $parent.find('.gname, .goods_name, .name, .title, .product-name, [class*="name"], [class*="title"]').first().text().trim();
        }

        // 4. 최후의 수단: 링크의 title 속성
        if (!name || name.length < 2) {
          name = $link.attr('title') || '';
        }

        // 제품명 정리
        if (name) {
          name = name.replace(/\s+/g, ' ').trim();
          // 첫 100자만 사용
          if (name.length > 100) {
            name = name.substring(0, 100).trim();
          }
        }

        if (!name || name.length < 2) {
          console.log(`제품명을 찾을 수 없음: ${link}`);
          return;
        }

        console.log(`제품명 추출: "${name}" (링크: ${link})`);

        // 키워드 확인
        if (!containsKeyword(name)) {
          console.log(`키워드 불일치: "${name}"`);
          return;
        }

        console.log(`키워드 일치: "${name}"`);

        // 할인율 추출 - 리스트 페이지와 상세 페이지 구분
        let discountRate = 0;
        const containerText = $container.length > 0 ? $container.text() : '';

        // 가격 정보 추출 (할인율 계산 및 표시용)
        const priceMatches = containerText.match(/([\d,]+)\s*원/g);

        // 1. 리스트 페이지: div.goods_sale 값 추출 (우선순위 1)
        const $goodsSale = $container.find('div.goods_sale').first();
        if ($goodsSale.length > 0) {
          const saleText = $goodsSale.text().trim();
          const saleMatch = saleText.match(/(\d+)%/);
          if (saleMatch) {
            discountRate = parseInt(saleMatch[1], 10);
            console.log(`리스트 페이지 할인율 (div.goods_sale): ${discountRate}%`);
          }
        }

        // 2. 상세 페이지: 특정 스타일을 가진 div에서 할인율 추출
        if (discountRate === 0) {
          const $detailDiscount = $('div[style*="position:absolute"][style*="left:-70px"][style*="text-align:center"]');
          if ($detailDiscount.length > 0) {
            const detailText = $detailDiscount.text().trim();
            const detailMatch = detailText.match(/(\d+)%/);
            if (detailMatch) {
              discountRate = parseInt(detailMatch[1], 10);
              console.log(`상세 페이지 할인율 (스타일 div): ${discountRate}%`);
            }
          }
        }

        // 3. 대체 방법: 텍스트에서 할인율 패턴 찾기
        if (discountRate === 0) {
          const discountMatches = [
            containerText.match(/\[(\d+)%\]/),
            containerText.match(/(\d+)%\s*할인/),
            containerText.match(/(\d+)%/),
            $container.find('[class*="discount"], [class*="sale"]').text().match(/(\d+)%/)
          ].filter(m => m);

          if (discountMatches.length > 0) {
            discountRate = parseInt(discountMatches[0][1], 10);
            console.log(`텍스트 매칭 할인율: ${discountRate}%`);
          }
        }

        // 4. 최후의 수단: 원가와 할인가로 할인율 계산
        if (discountRate === 0 && priceMatches && priceMatches.length >= 2) {
          const prices = priceMatches.map(m => parseInt(m.replace(/[^0-9]/g, ''), 10)).filter(p => p > 0);
          if (prices.length >= 2) {
            const originalPrice = Math.max(...prices);
            const salePrice = Math.min(...prices);
            if (originalPrice > salePrice) {
              discountRate = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
              console.log(`가격 계산 할인율: ${discountRate}%`);
            }
          }
        }

        console.log(`최종 할인율: ${discountRate}% (제품: ${name})`);

        // 할인율 기준 확인 (MIN_DISCOUNT_RATE 이상인 제품만 크롤링)
        if (discountRate < MIN_DISCOUNT_RATE) {
          console.log(`할인율 부족: ${discountRate}% < ${MIN_DISCOUNT_RATE}% (제품: ${name})`);
          return;
        }

        // 품절 여부 확인 (일단 주석 처리하여 테스트)
        // const soldOut = isSoldOut($, $container.length > 0 ? $container[0] : element);
        // if (soldOut) {
        //   console.log(`품절 제품: ${name}`);
        //   return;
        // }

        // 제품 링크 생성 (절대 URL로 변환)
        const fullLink = link.startsWith('http') ? link : `https://cheesequeen.co.kr${link}`;

        // 가격 텍스트 추출 (표시용) - 할인가만 추출
        // 리스트 페이지와 상세 페이지 구분
        let priceText = '';

        // 현재 페이지가 리스트 페이지인지 확인
        const isListPage = url.includes('/goods/catalog');

        if (isListPage) {
          // 리스트 페이지: div.goods_price 값 사용
          const $goodsPrice = $container.find('div.goods_price').first();
          if ($goodsPrice.length > 0) {
            priceText = $goodsPrice.text().trim();
            // 숫자와 "원"만 추출
            const priceMatch = priceText.match(/([\d,]+)\s*원/);
            if (priceMatch) {
              priceText = priceMatch[0].trim();
            }
          }
        } else {
          // 상세 페이지: b.price 값 사용
          const $bPrice = $('b.price').first();
          if ($bPrice.length > 0) {
            priceText = $bPrice.text().trim();
            // 숫자와 "원"만 추출
            const priceMatch = priceText.match(/([\d,]+)\s*원/);
            if (priceMatch) {
              priceText = priceMatch[0].trim();
            }
          }
        }

        // 가격이 없으면 대체 방법 시도
        if (!priceText) {
          if (priceMatches && priceMatches.length > 0) {
            // 마지막 가격이 할인가 (일반적으로 더 낮은 가격)
            priceText = priceMatches[priceMatches.length - 1].trim();
          }
        }

        // "원"이 포함되지 않으면 추가
        if (priceText && !priceText.includes('원')) {
          priceText = priceText + '원';
        }

        const originalPriceText = priceMatches && priceMatches.length >= 2 ? priceMatches[0] : '';

        products.push({
          name: name.trim(),
          price: priceText.trim(),
          originalPrice: originalPriceText.trim(),
          discountRate,
          link: fullLink,
          imageUrl: '' // 이미지는 사용하지 않음
        });

        console.log(`✅ 제품 발견: ${name} (${discountRate}% 할인) - ${fullLink}`);
      } catch (err) {
        console.error('제품 파싱 오류:', err);
      }
    });

    console.log(`페이지에서 ${products.length}개 제품 발견`);
    return products;
  } catch (error) {
    console.error(`페이지 크롤링 오류 (${url}):`, error);
    return [];
  }
}

/**
 * 전체 페이지 크롤링
 */
async function crawlAllPages() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  const allProducts = [];
  let currentPage = 1;
  let consecutiveEmptyPages = 0;
  const maxEmptyPages = 2; // 연속으로 2페이지가 비어있으면 종료

  try {
    while (currentPage <= 50) { // 최대 50페이지까지
      const url = `https://cheesequeen.co.kr/goods/catalog?page=${currentPage}&code=0052&popup=&iframe=`;
      const products = await crawlPage(page, url);

      if (products.length === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= maxEmptyPages) {
          console.log(`연속 ${maxEmptyPages}페이지가 비어있어 크롤링 종료`);
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
        allProducts.push(...products);
      }

      // 다음 페이지 확인
      const content = await page.content();
      const $ = cheerio.load(content);
      const nextPageLink = $('a[href*="page="]').filter((i, el) => {
        const href = $(el).attr('href') || '';
        const pageMatch = href.match(/page=(\d+)/);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          return pageNum === currentPage + 1;
        }
        return false;
      }).first();

      if (nextPageLink.length === 0) {
        // 페이지 번호 링크로 확인
        const pageNumbers = $('a[href*="page="]').map((i, el) => {
          const href = $(el).attr('href') || '';
          const pageMatch = href.match(/page=(\d+)/);
          return pageMatch ? parseInt(pageMatch[1], 10) : 0;
        }).get();

        const maxPage = Math.max(...pageNumbers, currentPage);
        if (currentPage >= maxPage) {
          console.log('마지막 페이지 도달');
          break;
        }
      }

      currentPage++;

      // 페이지 간 대기 (서버 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error('크롤링 중 오류:', error);
  } finally {
    await browser.close();
  }

  return allProducts;
}

/**
 * 크롤링 결과를 한 게시글에 모아서 등록
 */
async function createSummaryPost(products) {
  if (!products || products.length === 0) {
    console.log('등록할 제품이 없습니다.');
    return false;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 할인 소식 카테고리 ID 가져오기
    if (!discountCategoryId) {
      discountCategoryId = await findDiscountCategoryId();
    }

    // 크롤링한 날짜 형식 (yy.mm.dd)
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}.${month}.${day}`;

    // 게시글 제목 생성: "치즈퀀 할인제품(30% 이상) - yy.mm.dd 기준"
    const title = `치즈퀀 할인제품(${MIN_DISCOUNT_RATE}% 이상) - ${dateStr} 기준`;

    // 중복 게시글 확인 (오늘 날짜로 이미 등록된 게시글이 있는지)
    const [existing] = await connection.execute(
      `SELECT TIP_ID FROM TIP_TB 
       WHERE TITLE LIKE ? AND DELETED_YN = "N" 
       AND DATE(CREATED_AT) = CURDATE()`,
      [`치즈퀀 할인제품(% 이상) - % 기준`]
    );

    if (existing.length > 0) {
      console.log(`오늘 날짜로 이미 등록된 게시글이 있습니다: ${title} (TIP_ID: ${existing[0].TIP_ID})`);
      // 기존 게시글 삭제하고 새로 작성
      await connection.execute(
        'UPDATE TIP_TB SET DELETED_YN = "Y" WHERE TIP_ID = ?',
        [existing[0].TIP_ID]
      );
      console.log(`기존 게시글 삭제 후 새로 작성합니다.`);
    }

    // 게시글 본문 생성 - 제품 목록 (제목 | 할인가 형식)
    let productListHtml = '';

    products.forEach((product, index) => {
      // 제품명에 하이퍼링크 추가 (인라인 스타일 제거하여 기본 CSS 적용)
      const productNameHtml = product.link
        ? `<a href="${product.link}" target="_blank">${product.name}</a>`
        : product.name;

      // 할인가만 표시 (원가 제외)
      const priceText = product.price ? product.price.trim() : '';

      // 제목 | 할인가 형식
      if (priceText) {
        productListHtml += `<div style="margin-bottom: 8px;">${productNameHtml} | ${priceText}</div>`;
      } else {
        productListHtml += `<div style="margin-bottom: 8px;">${productNameHtml}</div>`;
      }
    });

    // 게시글 앞부분 문구 및 구분선 추가
    const introText = `<div style="color: var(--text-dark);">잼, 소스, 치즈 등의 재료 할인 내역입니다.<br>${MIN_DISCOUNT_RATE}% 이상 할인 제품을 모았습니다.</div><div style="border-top: 1px solid var(--border-gray); margin: 16px 0;"></div>`;

    // 앞뒤 공백 없이 한 줄로 생성
    const content = `<div style="padding: 20px;">${introText}${productListHtml}</div>`;

    // 관리자 계정 ID 찾기 (또는 시스템 계정)
    const [adminRows] = await connection.execute(
      'SELECT USER_ID, NICKNAME FROM USER_TB WHERE EMAIL = ? LIMIT 1',
      ['admin@swnn.com']
    );

    const authorId = adminRows.length > 0 ? adminRows[0].USER_ID : null;
    const authorName = adminRows.length > 0 ? adminRows[0].NICKNAME : '시스템';

    // TIP_TB에 게시글 삽입
    const [result] = await connection.execute(
      'INSERT INTO TIP_TB (TITLE, AUTHOR_ID, AUTHOR_NAME, CATEGORY) VALUES (?, ?, ?, ?)',
      [title, authorId, authorName, discountCategoryId]
    );

    const tipId = result.insertId;

    // TIP_CONTENT_TB에 본문 삽입
    await connection.execute(
      'INSERT INTO TIP_CONTENT_TB (TIP_ID, CONTENT, TAGS) VALUES (?, ?, ?)',
      [tipId, content, '할인,세일']
    );

    await connection.commit();
    console.log(`게시글 등록 완료: ${title} (TIP_ID: ${tipId}, 제품 수: ${products.length}개)`);
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('게시글 등록 오류:', error);
    console.error('게시글 등록 오류 상세:', error.stack);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * 크롤링 및 게시글 등록 실행
 */
async function runCrawler() {
  console.log('크롤링 시작:', new Date().toISOString());

  try {
    // 할인 소식 카테고리 ID 찾기
    discountCategoryId = await findDiscountCategoryId();
    console.log(`할인 소식 카테고리 ID: ${discountCategoryId}`);

    // 전체 페이지 크롤링
    const products = await crawlAllPages();
    console.log(`총 ${products.length}개 제품 발견`);

    // 중복 제거 (제품명 기준)
    const uniqueProducts = [];
    const seenNames = new Set();

    for (const product of products) {
      if (!seenNames.has(product.name)) {
        seenNames.add(product.name);
        uniqueProducts.push(product);
      }
    }

    console.log(`중복 제거 후 ${uniqueProducts.length}개 제품`);

    // 모든 제품을 한 게시글에 등록
    if (uniqueProducts.length > 0) {
      const success = await createSummaryPost(uniqueProducts);
      if (success) {
        console.log(`크롤링 완료: 게시글 1개 등록 (제품 ${uniqueProducts.length}개 포함)`);
        return { success: 1, fail: 0, total: uniqueProducts.length };
      } else {
        console.log(`크롤링 완료: 게시글 등록 실패`);
        return { success: 0, fail: 1, total: uniqueProducts.length };
      }
    } else {
      console.log(`크롤링 완료: 등록할 제품이 없습니다.`);
      return { success: 0, fail: 0, total: 0 };
    }
  } catch (error) {
    console.error('크롤링 실행 오류:', error);
    throw error;
  } finally {
    // 치즈퀸 크롤링 종료 후 떠리몰 크롤링 실행 (독립적으로 실행)
    try {
      console.log('--- 떠리몰 크롤링 시작 대기 ---');
      await runThirtyMallCrawler();
    } catch (tmError) {
      console.error('떠리몰 크롤링 실행 중 오류 (메인 프로세스 영향 없음):', tmError);
    }
  }
}

const { runThirtyMallCrawler } = require('./thirtymall');

module.exports = {
  runCrawler,
  findDiscountCategoryId,
  runThirtyMallCrawler
};

