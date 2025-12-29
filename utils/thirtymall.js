const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { pool } = require('../config/database');

// 크롤링할 카테고리 목록
const TARGET_CATEGORIES = [
    { name: '치즈', url: 'https://thirtymall.com/category/796223' },
    { name: '버터/생크림/연유', url: 'https://thirtymall.com/category/796224' },
    { name: '빵/생지/믹스', url: 'https://thirtymall.com/category/796235' },
    { name: '잼/시럽/꿀', url: 'https://thirtymall.com/category/796236' },
    { name: '참치/햄/통조림', url: 'https://thirtymall.com/category/796239' },
    { name: '소스/드레싱/식초', url: 'https://thirtymall.com/category/795957' }
];

// 선택자 상수 (사용자 제공)
const SELECTORS = {
    PRODUCT_CARD: 'div.MuiBox-root.mui-ssp1rr',
    PRODUCT_NAME: 'p.MuiTypography-root.MuiTypography-body1.twoLineEllipsis.mui-l1goj5',
    PRODUCT_PRICE: 'p.MuiTypography-root.MuiTypography-body1.mui-19ap8mx'
};

// 할인 소식 카테고리 ID (utils/crawler.js와 동일하게 7 사용 예상이지만, DB에서 확인 로직 포함)
async function findDiscountCategoryId() {
    try {
        const discountCategoryId = 7;
        const [rows] = await pool.execute(
            `SELECT MENU_ID FROM MENU_TB WHERE MENU_ID = ? AND USED_YN = 'Y' LIMIT 1`,
            [discountCategoryId]
        );
        return rows.length > 0 ? discountCategoryId : 7;
    } catch (error) {
        console.error('카테고리 ID 찾기 오류:', error);
        return 7;
    }
}

/**
 * 단일 카테고리 페이지 크롤링
 */
async function crawlCategory(page, category) {
    try {
        console.log(`[떠리몰] 크롤링 시작: ${category.name} (${category.url})`);
        await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 30000 });

        // 페이지 로딩 대기
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 제품 카드 선택자가 나타날 때까지 대기 (최대 10초)
        try {
            await page.waitForSelector(SELECTORS.PRODUCT_CARD, { timeout: 10000 });
        } catch (e) {
            console.log(`[떠리몰] 제품 카드를 찾을 수 없음 (${category.name}):`, e.message);
        }

        const content = await page.content();
        const $ = cheerio.load(content);

        const products = [];

        // 제품명 요소와 가격 요소를 각각 모두 찾습니다.
        // DOM 순서대로 1:1 매칭된다고 가정합니다.
        const $names = $(SELECTORS.PRODUCT_CARD + ' ' + SELECTORS.PRODUCT_NAME);
        const $prices = $(SELECTORS.PRODUCT_CARD + ' ' + SELECTORS.PRODUCT_PRICE);

        console.log(`[떠리몰] 발견된 제품명 개수: ${$names.length}, 가격 개수: ${$prices.length}`);

        // 최대 4개 또는 발견된 개수 중 작은 값만큼 반복
        const count = Math.min(4, $names.length);

        for (let i = 0; i < count; i++) {
            const $nameEl = $names.eq(i);
            const name = $nameEl.text().trim();

            let price = '';
            if (i < $prices.length) {
                price = $prices.eq(i).text().trim();
            }

            // 링크 찾기: 이름 요소의 상위 a 태그
            let link = '';
            const $linkEl = $nameEl.closest('a');
            if ($linkEl.length > 0) {
                link = $linkEl.attr('href');
            } else {
                // 이름 요소 근처의 a 태그 찾기 (부모의 자식 등)
                link = $nameEl.parent().find('a').attr('href');
                // 그래도 없으면 카드 전체 컨테이너에서 a 태그 찾기 (인덱스 매칭은 위험할 수 있으나 시도)
                // 여기서는 이름 요소가 보통 링크 안에 있거나 링크와 형제일 가능성이 높음
            }

            // 절대 경로로 변환
            const fullLink = link ? (link.startsWith('http') ? link : `https://thirtymall.com${link}`) : category.url;

            if (name && price) {
                products.push({
                    category: category.name,
                    name,
                    price,
                    link: fullLink
                });
                console.log(`  - 수집: [${category.name}] ${name} | ${price}`);
            }
        }

        return products;
    } catch (error) {
        console.error(`[떠리몰] 카테고리 크롤링 오류 (${category.name}):`, error);
        return [];
    }
}

/**
 * 게시글 생성
 */
async function createThirtyMallPost(allProducts) {
    if (!allProducts || allProducts.length === 0) {
        console.log('[떠리몰] 등록할 제품이 없습니다.');
        return false;
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const discountCategoryId = await findDiscountCategoryId();

        // 날짜 포맷
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}.${month}.${day}`;

        const title = `떠리몰 인기상품(카테고리별 TOP 4) - ${dateStr} 기준`;

        // 중복 게시글 처리 (오늘 날짜로 이미 등록된 게시글 삭제)
        const [existing] = await connection.execute(
            `SELECT TIP_ID FROM TIP_TB 
       WHERE TITLE LIKE ? AND DELETED_YN = "N" 
       AND DATE(CREATED_AT) = CURDATE()`,
            [`떠리몰 인기상품(%) - % 기준`]
        );

        if (existing.length > 0) {
            console.log(`[떠리몰] 기존 게시글 삭제 후 업데이트: ${existing[0].TIP_ID}`);
            await connection.execute(
                'UPDATE TIP_TB SET DELETED_YN = "Y" WHERE TIP_ID = ?',
                [existing[0].TIP_ID]
            );
        }

        // 본문 생성
        let contentHtml = `<div style="color: var(--text-dark);">떠리몰 카테고리별 인기상품 TOP 4 입니다.<br>알뜰한 쇼핑 되세요!</div><div style="border-top: 1px solid var(--border-gray); margin: 16px 0;"></div>`;

        // 카테고리별로 그룹화
        const productsByCategory = {};
        for (const p of allProducts) {
            if (!productsByCategory[p.category]) {
                productsByCategory[p.category] = [];
            }
            productsByCategory[p.category].push(p);
        }

        // HTML 조립
        for (const [categoryName, items] of Object.entries(productsByCategory)) {
            contentHtml += `<h3 style="margin-top: 20px; margin-bottom: 10px; font-weight: bold;">[${categoryName}]</h3>`;

            items.forEach(item => {
                const linkHtml = `<a href="${item.link}" target="_blank" style="text-decoration: underline; color: inherit;">${item.name}</a>`;
                contentHtml += `<div style="margin-bottom: 8px;">${linkHtml} | ${item.price}</div>`;
            });
        }

        // 전체 감싸기
        const finalContent = `<div style="padding: 20px;">${contentHtml}</div>`;

        // 관리자 작성자 정보 가져오기
        const [adminRows] = await connection.execute(
            'SELECT USER_ID, NICKNAME FROM USER_TB WHERE EMAIL = ? LIMIT 1',
            ['admin@swnn.com']
        );

        const authorId = adminRows.length > 0 ? adminRows[0].USER_ID : null;
        const authorName = adminRows.length > 0 ? adminRows[0].NICKNAME : '시스템';

        // 게시글 저장
        const [result] = await connection.execute(
            'INSERT INTO TIP_TB (TITLE, AUTHOR_ID, AUTHOR_NAME, CATEGORY) VALUES (?, ?, ?, ?)',
            [title, authorId, authorName, discountCategoryId]
        );

        const tipId = result.insertId;

        await connection.execute(
            'INSERT INTO TIP_CONTENT_TB (TIP_ID, CONTENT, TAGS) VALUES (?, ?, ?)',
            [tipId, finalContent, '떠리몰,할인,인기상품']
        );

        await connection.commit();
        console.log(`[떠리몰] 게시글 등록 완료: ${title} (TIP_ID: ${tipId})`);
        return true;

    } catch (error) {
        await connection.rollback();
        console.error('[떠리몰] 게시글 등록 실패:', error);
        return false;
    } finally {
        connection.release();
    }
}

/**
 * 떠리몰 크롤링 실행 메인 함수
 */
async function runThirtyMallCrawler() {
    console.log('[떠리몰] 크롤링 시작:', new Date().toISOString());

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        const allProducts = [];

        for (const category of TARGET_CATEGORIES) {
            const products = await crawlCategory(page, category);
            allProducts.push(...products);
            // 서버 부하 방지 대기
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        await browser.close();

        if (allProducts.length > 0) {
            await createThirtyMallPost(allProducts);
        } else {
            console.log('[떠리몰] 수집된 제품이 없어 게시글을 작성하지 않습니다.');
        }

        return { success: true, count: allProducts.length };

    } catch (error) {
        console.error('[떠리몰] 크롤링 전체 오류:', error);
        await browser.close();
        return { success: false, error: error.message };
    }
}

module.exports = { runThirtyMallCrawler };
