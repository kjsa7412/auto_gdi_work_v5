/**
 * FERP 프레임워크 Playwright 헬퍼
 *
 * FERP의 탭 기반 SPA 구조에서 화면 진입, 폼 조작, 그리드 조작을 지원
 */

/**
 * 로그인 후 메인 페이지 진입
 */
async function login(page, { userId = 'admin', password = 'admin' } = {}) {
  await page.goto('/');

  // 이미 로그인 상태면 스킵
  const currentUrl = page.url();
  if (!currentUrl.includes('login')) {
    return;
  }

  await page.fill('input[name="user_id"], input[name="userId"], #userId', userId);
  await page.fill('input[name="password"], input[name="passwd"], #passwd', password);
  await page.click('button[type="submit"], .login-btn, #loginBtn');
  await page.waitForLoadState('networkidle');
}

/**
 * 메뉴를 통해 화면 진입 (FERP 탭 기반)
 */
async function openScreen(page, screenId) {
  // FERP는 URL hash 기반 탭 전환
  // 직접 메뉴 클릭 또는 hash 변경으로 화면 진입
  const menuSelector = `[data-pgm_id="${screenId}"], [onclick*="${screenId}"], a[href*="${screenId}"]`;

  const menuExists = await page.$(menuSelector);
  if (menuExists) {
    await menuExists.click();
  } else {
    // 메뉴가 안 보이면 직접 hash 변경 시도
    await page.evaluate((sid) => {
      if (typeof APP_PGM !== 'undefined' && APP_PGM.openPgm) {
        // moduleId 추출 (첫 2글자)
        const moduleId = sid.substring(0, 2).toUpperCase();
        APP_PGM.openPgm(moduleId, sid, {});
      }
    }, screenId);
  }

  // 화면 로드 대기
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');
}

/**
 * 현재 화면의 JS 에러 수집
 */
function collectJsErrors(page) {
  const errors = [];

  page.on('pageerror', (error) => {
    errors.push({
      type: 'pageerror',
      message: error.message,
      stack: error.stack,
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({
        type: 'console_error',
        message: msg.text(),
      });
    }
  });

  return errors;
}

/**
 * FERP 탭에서 특정 화면이 활성화되어 있는지 확인
 */
async function isScreenActive(page, screenId) {
  return page.evaluate((sid) => {
    const tab = document.querySelector(`#pgmTabArea > [data-pgm_id="${sid}"]`);
    return tab !== null;
  }, screenId);
}

/**
 * FERP 폼 필드 값 확인
 */
async function getFormFieldValue(page, screenId, fieldName) {
  return page.evaluate(({ sid, name }) => {
    const listener = platform.listener[sid];
    if (!listener || !listener.form || !listener.form.postForm) return null;
    const data = listener.form.postForm.getData();
    return data[name] || null;
  }, { sid: screenId, name: fieldName });
}

/**
 * FERP 그리드 데이터 개수 확인
 */
async function getGridRowCount(page, screenId, gridName = 'grid1') {
  return page.evaluate(({ sid, gname }) => {
    const listener = platform.listener[sid];
    if (!listener || !listener.grid || !listener.grid[gname]) return -1;
    return listener.grid[gname].count();
  }, { sid: screenId, gname: gridName });
}

/**
 * FERP 그리드 더블클릭 (첫 번째 행)
 */
async function doubleClickFirstRow(page, screenId) {
  await page.evaluate((sid) => {
    const listener = platform.listener[sid];
    if (!listener || !listener.grid || !listener.grid.grid1) return;
    const grid = listener.grid.grid1;
    const firstId = grid.getFirstId();
    if (firstId) {
      grid.callEvent('onItemDblClick', [firstId, {}, {}]);
    }
  }, screenId);
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');
}

/**
 * FERP 버튼 클릭
 */
async function clickButton(page, screenId, buttonSlot) {
  await page.evaluate(({ sid, slot }) => {
    const listener = platform.listener[sid];
    if (listener && listener.button && listener.button[slot] && listener.button[slot].click) {
      listener.button[slot].click();
    }
  }, { sid: screenId, slot: buttonSlot });
  await page.waitForTimeout(1000);
}

/**
 * FERP 검색폼 필드 설정
 */
async function setSearchField(page, screenId, fieldName, value) {
  await page.evaluate(({ sid, name, val }) => {
    const listener = platform.listener[sid];
    if (!listener || !listener.form || !listener.form.searchForm) return;
    listener.form.searchForm.setValues({ [name]: val });
  }, { sid: screenId, name: fieldName, val: value });
}

/**
 * 네트워크 요청 대기 (API 호출 완료 확인)
 */
async function waitForApi(page, urlPattern, timeout = 10000) {
  try {
    const response = await page.waitForResponse(
      (resp) => resp.url().includes(urlPattern),
      { timeout }
    );
    return {
      status: response.status(),
      ok: response.ok(),
    };
  } catch {
    return { status: 0, ok: false, timeout: true };
  }
}

module.exports = {
  login,
  openScreen,
  collectJsErrors,
  isScreenActive,
  getFormFieldValue,
  getGridRowCount,
  doubleClickFirstRow,
  clickButton,
  setSearchField,
  waitForApi,
};
