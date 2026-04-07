#!/usr/bin/env node
/**
 * FERP 스모크 테스트 러너
 *
 * 사용법: node smoke-test-runner.js <taskId> [screenId]
 *
 * 1. task manifest에서 화면 목록 로드
 * 2. Playwright로 로그인 → 화면 진입 → 버튼 동작 테스트
 * 3. 결과 리포트 생성
 * 4. 실패 시 fix.md 자동 생성
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RESULTS_DIR = path.join(__dirname, 'results');
const BASE_URL = process.env.FERP_BASE_URL || 'http://localhost:8080';
const LOGIN_ID = process.env.FERP_USER || 'kjsa';
const LOGIN_PW = process.env.FERP_PASS || '1';

const taskId = process.argv[2];
const filterScreenId = process.argv[3];

if (!taskId) {
  console.error('Usage: node smoke-test-runner.js <taskId> [screenId]');
  process.exit(1);
}

function loadManifest(taskId) {
  const p = path.join(PROJECT_ROOT, `system/runtime/tasks/${taskId}/manifest.yaml`);
  if (!fs.existsSync(p)) { console.error(`Manifest not found: ${p}`); process.exit(1); }
  return yaml.load(fs.readFileSync(p, 'utf8'));
}

function getScreenType(taskId, screenId) {
  const p = path.join(PROJECT_ROOT, `system/runtime/tasks/${taskId}/screens/${screenId}/analyze.manifest.yaml`);
  if (!fs.existsSync(p)) return 'unknown';
  return yaml.load(fs.readFileSync(p, 'utf8')).screen_type || 'unknown';
}

async function main() {
  const manifest = loadManifest(taskId);
  let screens = manifest.screens.map(s => s.screen_id);
  if (filterScreenId) screens = screens.filter(s => s === filterScreenId);

  console.log(`\n=== FERP Smoke Test — ${taskId} ===`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screens: ${screens.join(', ')}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // JS 에러 수집 (화면별)
  const jsErrors = {};
  screens.forEach(s => { jsErrors[s] = []; });
  let currentScreen = 'global';

  page.on('pageerror', (error) => {
    const target = jsErrors[currentScreen] || (jsErrors['global'] = jsErrors['global'] || []);
    target.push({ type: 'pageerror', message: error.message, stack: error.stack?.split('\n').slice(0, 3).join('\n') });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('installHook')) {
      const target = jsErrors[currentScreen] || (jsErrors['global'] = jsErrors['global'] || []);
      target.push({ type: 'console_error', message: msg.text() });
    }
  });

  // ── 로그인 ──
  console.log('[LOGIN]');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.fill('#lid', LOGIN_ID);
  await page.fill('#lpassWd', LOGIN_PW);
  await page.click('#lbtlogin');
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');

  if (page.url().includes('login')) {
    console.error('[LOGIN] FAILED — still on login page');
    await browser.close();
    process.exit(2);
  }
  console.log('[LOGIN] OK → ' + page.url());

  // ── 화면별 테스트 ──
  const results = {};

  for (const screenId of screens) {
    console.log(`\n[${screenId}] ──────────────────────────`);
    currentScreen = screenId;
    jsErrors[screenId] = [];

    const screenType = getScreenType(taskId, screenId);
    const moduleId = screenId.substring(0, 2).toUpperCase();
    const r = { screenId, screenType, tests: [], errors: [] };

    // ── T1: 화면 진입 (URL) ──
    console.log(`  [T1] Entry via URL...`);
    await page.goto(`${BASE_URL}/#/${moduleId}/${screenId}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    const tabExists = await page.evaluate((sid) => !!document.querySelector(`[data-pgm_id="${sid}"]`), screenId);
    r.tests.push({ name: 'T1_화면진입', result: tabExists ? 'PASS' : 'FAIL', detail: tabExists ? '탭 생성' : '탭 미생성' });

    if (!tabExists) {
      console.log(`  T1 FAIL — skip remaining`);
      results[screenId] = finalize(r);
      continue;
    }

    // ── T2: 진입 시 JS 에러 ──
    const entryErrors = jsErrors[screenId].filter(e => e.type === 'pageerror');
    r.tests.push({ name: 'T2_진입_JS에러', result: entryErrors.length === 0 ? 'PASS' : 'FAIL',
      detail: entryErrors.length === 0 ? '에러 없음' : entryErrors.map(e => e.message).join('; ') });

    // ── T3: 기본 구조 확인 ──
    const structure = await page.evaluate((sid) => {
      const l = platform.listener[sid];
      if (!l) return null;
      return {
        hasSearchForm: !!(l.form && l.form.searchForm),
        hasPostForm: !!(l.form && l.form.postForm),
        hasGrid: !!(l.grid && l.grid.grid1),
      };
    }, screenId);

    if (screenType === 'grid-only') {
      r.tests.push({ name: 'T3_검색폼', result: structure?.hasSearchForm ? 'PASS' : 'FAIL', detail: structure?.hasSearchForm ? '존재' : '없음' });
      r.tests.push({ name: 'T3_그리드', result: structure?.hasGrid ? 'PASS' : 'FAIL', detail: structure?.hasGrid ? '존재' : '없음' });
    } else if (screenType === 'form-detail') {
      r.tests.push({ name: 'T3_폼', result: structure?.hasPostForm ? 'PASS' : 'FAIL', detail: structure?.hasPostForm ? '존재' : '없음' });
    }

    // ── T4: mainButtonArea 버튼 목록 확인 ──
    const visibleButtons = await page.evaluate(() => {
      const area = document.querySelector('.mainButtonArea');
      if (!area) return [];
      return Array.from(area.querySelectorAll('button.btn')).filter(b => b.offsetParent !== null).map(b => ({
        text: b.textContent.trim(),
        id: b.id,
        dataType: b.getAttribute('data-type'),
      }));
    });
    r.tests.push({ name: 'T4_버튼목록', result: visibleButtons.length > 0 ? 'PASS' : 'FAIL',
      detail: visibleButtons.map(b => b.text || b.dataType).join(', ') });

    // ── T5~: 각 버튼 클릭 테스트 ──
    for (const btn of visibleButtons) {
      const btnName = btn.text.replace(/\[.*?\]/g, '').trim() || btn.dataType || 'unknown';

      // 데이터 변경 버튼은 스킵 (삭제, 저장, 접수, 과제접수 등)
      const destructive = ['삭제', '저장', '접수', '초안작성', '과제작성', '과제저장', '과제접수', '닫기'].some(d => btnName.includes(d));
      if (destructive) {
        r.tests.push({ name: `T5_버튼_${btnName}`, result: 'SKIP', detail: '데이터 변경 버튼 — 스킵' });
        continue;
      }

      console.log(`  [T5] Button click: ${btnName}...`);
      jsErrors[screenId] = [];

      try {
        // 버튼 클릭 (ID가 있으면 ID로, 없으면 텍스트로)
        if (btn.id) {
          await page.click(`#${btn.id}`);
        } else {
          await page.click(`.mainButtonArea button:has-text("${btnName}")`);
        }
        await page.waitForTimeout(2000);
        await page.waitForLoadState('networkidle');

        const btnErrors = jsErrors[screenId].filter(e => e.type === 'pageerror');
        r.tests.push({ name: `T5_버튼_${btnName}`, result: btnErrors.length === 0 ? 'PASS' : 'FAIL',
          detail: btnErrors.length === 0 ? '동작 OK' : btnErrors.map(e => e.message).join('; ') });
      } catch (e) {
        r.tests.push({ name: `T5_버튼_${btnName}`, result: 'FAIL', detail: `클릭 에러: ${e.message.substring(0, 100)}` });
      }
    }

    // ── T6: 조회 후 그리드 데이터 (grid-only) ──
    if (screenType === 'grid-only') {
      const rowCount = await page.evaluate((sid) => {
        const l = platform.listener[sid];
        return (l && l.grid && l.grid.grid1) ? l.grid.grid1.count() : -1;
      }, screenId);
      r.tests.push({ name: 'T6_그리드_데이터', result: rowCount >= 0 ? 'PASS' : 'FAIL', detail: `${rowCount}건` });

      // ── T7: 더블클릭 (데이터 있을 때) ──
      if (rowCount > 0) {
        console.log(`  [T7] Grid double-click...`);
        jsErrors[screenId] = [];

        await page.evaluate((sid) => {
          const l = platform.listener[sid];
          const grid = l.grid.grid1;
          const firstId = grid.getFirstId();
          if (firstId && l.gridRow && l.gridRow.dblclick) {
            const item = grid.getItem(firstId);
            l.gridRow.dblclick(firstId, null, item, grid);
          }
        }, screenId);
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');

        const dblErrors = jsErrors[screenId].filter(e => e.type === 'pageerror');
        r.tests.push({ name: 'T7_더블클릭', result: dblErrors.length === 0 ? 'PASS' : 'FAIL',
          detail: dblErrors.length === 0 ? '에러 없음' : dblErrors.map(e => e.message).join('; ') });

        // T8: 서브화면 데이터 바인딩 확인
        const subScreenId = screenId === 'SEA010' ? 'SEA011' : screenId === 'SEA020' ? 'SEA021' : null;
        if (subScreenId) {
          await page.waitForTimeout(2000);
          const formData = await page.evaluate((sid) => {
            const l = platform.listener[sid];
            if (!l || !l.form || !l.form.postForm) return null;
            const data = l.form.postForm.getData();
            return { fieldCount: Object.keys(data).length, hasWrkMastId: !!data.wrk_mast_id, hasPrjNm: !!data.prj_nm };
          }, subScreenId);

          if (formData) {
            const dataLoaded = formData.hasWrkMastId || formData.hasPrjNm;
            r.tests.push({ name: `T8_서브화면_데이터(${subScreenId})`, result: dataLoaded ? 'PASS' : 'FAIL',
              detail: dataLoaded ? `${formData.fieldCount}개 필드, wrk_mast_id=${formData.hasWrkMastId}, prj_nm=${formData.hasPrjNm}` : '데이터 미바인딩' });
          } else {
            r.tests.push({ name: `T8_서브화면_데이터(${subScreenId})`, result: 'FAIL', detail: '서브화면 폼 없음' });
          }
        }
      }
    }

    // ── 에러 집계 ──
    r.errors = [...jsErrors[screenId]];
    results[screenId] = finalize(r);
    console.log(`  Result: ${r.passed} PASS / ${r.failed} FAIL / ${r.tests.filter(t=>t.result==='SKIP').length} SKIP`);
  }

  await browser.close();

  // ── 리포트 생성 ──
  const reportPath = path.join(RESULTS_DIR, `${taskId}_smoke.md`);
  const fixMdPath = path.join(RESULTS_DIR, `${taskId}_smoke_fix.md`);
  const jsonPath = path.join(RESULTS_DIR, `${taskId}_smoke.json`);

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');

  let report = `# Smoke Test Report — ${taskId}\n\n`;
  report += `- 일시: ${new Date().toISOString()}\n`;
  report += `- Base URL: ${BASE_URL}\n`;
  report += `- 계정: ${LOGIN_ID}\n\n`;

  let totalPass = 0, totalFail = 0, totalSkip = 0;
  const failedItems = [];

  report += `## 요약\n\n| 화면 | 유형 | PASS | FAIL | SKIP | 결과 |\n|------|------|------|------|------|------|\n`;

  for (const [sid, r] of Object.entries(results)) {
    totalPass += r.passed; totalFail += r.failed; totalSkip += r.skipped;
    const status = r.failed === 0 ? 'PASS' : 'FAIL';
    report += `| ${sid} | ${r.screenType} | ${r.passed} | ${r.failed} | ${r.skipped} | ${status} |\n`;
    r.tests.filter(t => t.result === 'FAIL').forEach(t => {
      failedItems.push({ screenId: sid, test: t.name, detail: t.detail });
    });
  }

  report += `\n**총계: ${totalPass} PASS / ${totalFail} FAIL / ${totalSkip} SKIP**\n\n`;

  for (const [sid, r] of Object.entries(results)) {
    report += `---\n\n## ${sid} (${r.screenType})\n\n| 테스트 | 결과 | 상세 |\n|--------|------|------|\n`;
    r.tests.forEach(t => { report += `| ${t.name} | ${t.result} | ${t.detail} |\n`; });
    if (r.errors.length > 0) {
      report += `\n### JS 에러\n`;
      r.errors.forEach(e => { report += `- [${e.type}] ${e.message}\n`; });
    }
    report += `\n`;
  }

  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\n=== Report: ${reportPath} ===`);

  if (failedItems.length > 0) {
    let fixMd = `# Auto-generated fix from smoke test\n\n`;
    failedItems.forEach((item, idx) => { fixMd += `${idx + 1}. [${item.screenId}] ${item.test}: ${item.detail}\n`; });
    fs.writeFileSync(fixMdPath, fixMd, 'utf8');
    console.log(`=== Fix suggestions: ${fixMdPath} ===`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

function finalize(r) {
  r.passed = r.tests.filter(t => t.result === 'PASS').length;
  r.failed = r.tests.filter(t => t.result === 'FAIL').length;
  r.skipped = r.tests.filter(t => t.result === 'SKIP').length;
  return r;
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
