(function (global) {
  function getUserInfo() {
    try {
      const userStr = localStorage.getItem('sandwichUser');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  function createProfileMenu(user) {
    if (!user) return '';
    
    const email = user.email || '';
    const nickname = user.nickname || '';
    const displayName = nickname || email.split('@')[0] || '사용자';
    
    return `
      <div class="profile-menu" id="profileMenu">
        <div class="profile-menu-header">${email}</div>
        <button class="profile-menu-item" data-action="my-info">
          <span class="profile-menu-item-icon">👤</span>
          <span class="profile-menu-item-text">내 정보</span>
          <span class="profile-menu-item-arrow">›</span>
        </button>
        <button class="profile-menu-item" data-action="my-activity">
          <span class="profile-menu-item-icon">📊</span>
          <span class="profile-menu-item-text">나의 활동</span>
          <span class="profile-menu-item-arrow">›</span>
        </button>
        <div class="profile-menu-divider"></div>
        <button class="profile-menu-item logout" data-action="logout">
          <span class="profile-menu-item-icon">🚪</span>
          <span class="profile-menu-item-text">로그아웃</span>
        </button>
      </div>
    `;
  }

  function createTemplate() {
    const user = getUserInfo();
    const showProfile = !!user;
    
    // 프로필 이미지 또는 아이콘 생성 (로그인하지 않은 경우에도 기본 아이콘 표시)
    let profileContent = '';
    const defaultIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-person-fill" viewBox="0 0 16 16" style="color: #ffffff;"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/></svg>`;
    
    if (showProfile) {
      const profileImageUrl = user.profileImageUrl || null;
      const displayName = user.nickname || user.email || '사용자';
      
      if (profileImageUrl) {
        profileContent = `<img src="${profileImageUrl}" alt="${displayName}" class="lnb-profile-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span class="lnb-profile-icon" style="display:none;">${defaultIcon}</span>`;
      } else {
        profileContent = `<span class="lnb-profile-icon">${defaultIcon}</span>`;
      }
    } else {
      // 로그인하지 않은 경우 기본 아이콘 표시
      profileContent = `<span class="lnb-profile-icon">${defaultIcon}</span>`;
    }
    
    return `
      <nav class="lnb" id="globalGnbNav" aria-label="글로벌 내비게이션">
        <div class="lnb-top">
          <a class="lnb-logo" href="/home.html" title="홈으로 이동">
            <img src="/uploads/icon_logo/gnb_home.svg" class="lnb-logo" alt="홈 아이콘" title="홈 Home">
          </a>
          <button class="lnb-button" id="recipeBtn" data-menu="recipe" title="이렇게 만들어요">
            <img src="/uploads/icon_logo/gnb_recipe.svg" alt="레시피 아이콘" title="이렇게 만들어요">
          </button>
          <button class="lnb-button" id="tipBtn" data-menu="tip" title="정보 공유해요">
            <img src="/uploads/icon_logo/gnb_tip.svg" alt="정보 공유 아이콘" title="정보 공유해요">
          </button>
        </div>
        <div class="lnb-bottom">
          <div class="lnb-profile-wrapper">
            <button class="lnb-button lnb-profile-button" id="myInfoBtn" data-menu="my-info" data-logged-in="${showProfile}" title="${showProfile ? '내 프로필' : '로그인'}">${profileContent}</button>
            ${showProfile ? createProfileMenu(user) : ''}
          </div>
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

  function setupProfileMenu(navElement) {
    const profileBtn = navElement.querySelector('#myInfoBtn');
    const profileMenu = navElement.querySelector('#profileMenu');
    const isLoggedIn = profileBtn?.dataset.loggedIn === 'true';
    
    if (!profileBtn) return;

    // 프로필 버튼 클릭 처리
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // 로그인하지 않은 경우 로그인 페이지로 이동
      if (!isLoggedIn) {
        window.location.href = '/login.html';
        return;
      }
      
      // 로그인한 경우에만 메뉴 토글
      if (!profileMenu) return;
      
      const isShowing = profileMenu.classList.contains('show');
      
      // 다른 메뉴 닫기
      document.querySelectorAll('.profile-menu.show').forEach(menu => {
        if (menu !== profileMenu) {
          menu.classList.remove('show');
        }
      });
      
      profileMenu.classList.toggle('show', !isShowing);
    });

    // 메뉴가 있는 경우에만 메뉴 항목 클릭 처리
    if (profileMenu) {
      profileMenu.querySelectorAll('[data-action]').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = item.dataset.action;
          
          if (action === 'logout') {
            localStorage.removeItem('sandwichUser');
            window.location.href = '/home.html';
          } else if (action === 'my-info') {
            window.location.href = '/my-info.html';
            profileMenu.classList.remove('show');
          } else if (action === 'my-activity') {
            window.location.href = '/my-activity.html';
            profileMenu.classList.remove('show');
          }
        });
      });

      // 외부 클릭 시 메뉴 닫기
      document.addEventListener('click', (e) => {
        if (!navElement.contains(e.target)) {
          profileMenu.classList.remove('show');
        }
      });
    }
  }

  function updateProfileImage() {
    const user = getUserInfo();
    if (!user) return;
    
    const profileBtn = document.getElementById('myInfoBtn');
    if (!profileBtn) return;
    
    const profileImageUrl = user.profileImageUrl || null;
    const displayName = user.nickname || user.email || '사용자';
    const defaultIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-person-fill" viewBox="0 0 16 16" style="color: #ffffff;"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/></svg>`;
    
    if (profileImageUrl) {
      profileBtn.innerHTML = `<img src="${profileImageUrl}" alt="${displayName}" class="lnb-profile-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span class="lnb-profile-icon" style="display:none;">${defaultIcon}</span>`;
    } else {
      profileBtn.innerHTML = `<span class="lnb-profile-icon">${defaultIcon}</span>`;
    }
  }

  function renderGnb(options = {}) {
    const {
      containerId = 'gnb-root',
      activeMenu = null,
      showMyInfo = true,
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

    // 프로필 메뉴가 있으면 설정
    setupProfileMenu(navElement);

    if (!showMyInfo) {
      const profileWrapper = navElement.querySelector('.lnb-profile-wrapper');
      if (profileWrapper) {
        profileWrapper.style.display = 'none';
      }
    }

    // localStorage 변경 감지하여 프로필 이미지 업데이트
    window.addEventListener('storage', () => {
      updateProfileImage();
    });

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
    updateProfileImage: updateProfileImage,
  };
})(window);
