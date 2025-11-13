(function (global) {
  function createTemplate() {
    return `
      <nav class="lnb" id="globalGnbNav" aria-label="글로벌 내비게이션">
        <div class="lnb-top">
          <a class="lnb-logo" href="/home.html" title="홈으로 이동">🏠</a>
          <button class="lnb-button" id="recipeBtn" data-menu="recipe" title="이렇게 만들어요">🥪</button>
          <button class="lnb-button" id="tipBtn" data-menu="tip" title="정보 공유해요">💡</button>
        </div>
        <div class="lnb-bottom">
          <div class="lnb-divider" aria-hidden="true"></div>
          <button class="lnb-button" id="myInfoBtn" data-menu="my-info" title="My info (준비 중)">🙂</button>
        </div>
      </nav>
    `;
  }

  function setActive(navElement, activeMenu) {
    if (!navElement || !activeMenu) return;
    const target = navElement.querySelector(`[data-menu="${activeMenu}"]`);
    if (!target) return;
    navElement.querySelectorAll('.lnb-button').forEach((btn) => btn.classList.remove('active'));
    target.classList.add('active');
  }

  function renderGnb(options = {}) {
    const {
      containerId = 'gnb-root',
      activeMenu = null,
      onReady = null,
    } = options;

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[GNB] 컨테이너(#${containerId})를 찾을 수 없습니다.`);
      return Promise.resolve(null);
    }

    container.innerHTML = createTemplate();

    const navElement = container.querySelector('#globalGnbNav');
    setActive(navElement, activeMenu);

    if (typeof onReady === 'function') {
      onReady({
        navElement,
        recipeBtn: navElement.querySelector('#recipeBtn'),
        tipBtn: navElement.querySelector('#tipBtn'),
        myInfoBtn: navElement.querySelector('#myInfoBtn'),
      });
    }

    return Promise.resolve(navElement);
  }

  global.Gnb = {
    render: renderGnb,
  };
})(window);

