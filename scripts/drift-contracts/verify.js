'use strict';

/**
 * 계약 매니페스트 ↔ `src/` 소스 대조 검증 (네트워크 불필요).
 *
 * 왜 필요한가: 계약을 데이터로 분리하면 리뷰는 쉬워지지만, 파서만 고치고 계약은
 * 그대로 두면 **조용히 썩는다**. 그래서 두 방향을 모두 본다.
 *
 *   1. 매니페스트 → 소스: `usedBy`가 적힌 문자열(선택자·설정 상수·요청 파라미터)이
 *      그 소스 파일에 실제로 있는가. 파서에서 선택자 이름을 바꾸면 여기서 걸린다.
 *   2. 소스 → 매니페스트: 소스에 있는 **페이지 특이 선택자**가 모두 계약에 선언됐는가.
 *      파서에 새 선택자를 추가하면 계약도 같이 적어야 통과한다.
 *
 * 즉 파서 변경과 점검 항목 변경이 같은 PR에 묶이도록 강제하는 장치다.
 *
 * 사용: `npm run drift:contracts` (= `node scripts/check-site-drift.js --contracts`)
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');

/** 선택자를 뽑아 볼 소스(테스트 제외). 파서·크롤러·설정이 대상이다. */
const SOURCE_FILES = [
  'src/config.ts',
  'src/http-client.ts',
  'src/pal.ts',
  'src/parser.ts',
  'src/likms.ts',
  'src/nsm-compat.ts',
];

/** cheerio 호출에 넘긴 선택자 리터럴: `$('…')`, `.find('…')`, `.closest('…')` … */
const CHEERIO_CALL =
  /\$\(\s*'([^']+)'|\.(?:find|closest|filter|is|has|children|parents|siblings)\(\s*'([^']+)'/g;

/**
 * 위에서 못 잡히는 선택자 리터럴(헬퍼에 문자열로 넘기는 경우): `.`·`#`로 시작.
 * 홑따옴표로 감싼 문자열 안에 큰따옴표 속성 선택자가 올 수 있어(예:
 * `'#form input[name="billNo"]'`) 이스케이프를 허용해 문자열 전체를 잡는다.
 */
const STRING_LITERAL = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;

/**
 * "페이지 특이 선택자"만 계약에 요구한다 — `table`, `td`, `pre` 같은 구조용 선택자는
 * 사이트 리뉴얼과 무관하게 늘 있으므로 계약 대상이 아니다.
 */
function looksPageSpecific(selector) {
  if (/[.#][A-Za-z_-]/.test(selector)) return true; // 클래스·id
  if (/\[[^\]]+\]/.test(selector)) return true; // 속성 선택자
  if (/^[a-zA-Z-]+:(?:nth-|not\(|first|last)/.test(selector)) return true; // 의사 클래스
  return false;
}

/** 소스에서 (선택자, 파일, 줄) 목록을 뽑는다 */
function extractSelectorsFromSource() {
  const found = new Map();
  for (const file of SOURCE_FILES) {
    const absolute = path.join(ROOT, file);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    const lines = fs.readFileSync(absolute, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const texts = [];
      for (const match of line.matchAll(CHEERIO_CALL)) {
        texts.push(match[1] ?? match[2]);
      }
      for (const match of line.matchAll(STRING_LITERAL)) {
        const text = match[1] ?? match[2];
        // `.`·`#`로 시작하는 리터럴만 선택자 후보로 본다(`./dist/...` 같은 경로 제외)
        if (text !== undefined && /^[.#][A-Za-z_-]/.test(text)) {
          texts.push(text);
        }
      }
      for (const text of texts) {
        if (text === undefined || text === '') continue;
        if (!looksPageSpecific(text)) continue;
        if (!found.has(text)) {
          found.set(text, { selector: text, file, line: index + 1 });
        }
      }
    });
  }
  return [...found.values()];
}

/** 0 = 통과, >0 = 위반 건수 */
function verifyContracts({ knownFlows = [], knownExtras = [], log = console.log } = {}) {
  const manifest = require('./index.js');
  const failures = [];
  const fail = (message) => failures.push(message);

  const declaredSelectors = new Set();
  const checkIds = new Set();
  const relations = new Set(['ceilDivisor', 'pageSize']);
  const kinds = new Set(['dom', 'parse', 'flow']);

  // ── 1. 매니페스트 스키마 ────────────────────────────────────────────────────
  const siteIds = new Set();
  for (const site of manifest.SITES) {
    if (!site.id || siteIds.has(site.id)) {
      fail(`사이트 id가 없거나 중복입니다: ${site.id}`);
    }
    siteIds.add(site.id);

    for (const file of site.sourceFiles ?? []) {
      if (!fs.existsSync(path.join(ROOT, file))) {
        fail(`[${site.id}] sourceFiles에 없는 파일이 있습니다: ${file}`);
      }
    }

    const endpoints = site.endpoints ?? {};
    const filters = site.filters ?? {};
    const localIds = new Set();

    for (const check of site.checks ?? []) {
      if (!check.id || !check.label) {
        fail(`[${site.id}] id/label이 없는 점검이 있습니다`);
        continue;
      }
      if (checkIds.has(check.id)) {
        fail(`점검 id가 중복입니다: ${check.id}`);
      }
      checkIds.add(check.id);
      localIds.add(check.id);

      if (!kinds.has(check.kind)) {
        fail(`[${check.id}] 알 수 없는 kind: ${check.kind}`);
      }
      if (check.kind === 'dom' && !check.fetch) {
        fail(`[${check.id}] kind=dom인데 fetch가 없습니다`);
      }
      if (check.kind === 'parse' && !check.fetch && !check.parse) {
        fail(`[${check.id}] kind=parse인데 fetch/parse가 없습니다`);
      }
      if (check.kind === 'flow') {
        if (!check.flow) {
          fail(`[${check.id}] kind=flow인데 flow 이름이 없습니다`);
        } else if (!knownFlows.includes(check.flow)) {
          fail(`[${check.id}] 실행기에 없는 flow입니다: ${check.flow}`);
        }
      }
      if (check.extra !== undefined && !knownExtras.includes(check.extra)) {
        fail(`[${check.id}] 실행기에 없는 extra입니다: ${check.extra}`);
      }
      if (check.endpoint !== undefined && endpoints[check.endpoint] === undefined) {
        fail(`[${check.id}] 선언되지 않은 endpoint 참조: ${check.endpoint}`);
      }
      for (const name of toArray(check.filters)) {
        if (filters[name] === undefined) {
          fail(`[${check.id}] 선언되지 않은 filter 참조: ${name}`);
        }
      }
      if (check.filter !== undefined && filters[check.filter] === undefined) {
        fail(`[${check.id}] 선언되지 않은 filter 참조: ${check.filter}`);
      }
      for (const field of toArray(check.fields)) {
        if (!field.path) {
          fail(`[${check.id}] path가 없는 필드 계약이 있습니다`);
        }
      }
      for (const relation of toArray(check.relations)) {
        if (!relations.has(relation.kind)) {
          fail(`[${check.id}] 알 수 없는 관계식: ${relation.kind}`);
        }
      }
      for (const dep of toArray(check.dependsOn)) {
        if (!localIds.has(dep) && !checkIds.has(dep)) {
          fail(`[${check.id}] 선행 점검을 찾을 수 없습니다: ${dep}`);
        }
      }
    }
  }

  // ── 2. 매니페스트 → 소스 ────────────────────────────────────────────────────
  const sourceCache = new Map();
  const readSource = (file) => {
    if (!sourceCache.has(file)) {
      const absolute = path.join(ROOT, file);
      sourceCache.set(file, fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null);
    }
    return sourceCache.get(file);
  };

  for (const literal of manifest.walkLiterals()) {
    declaredSelectors.add(literal.value);
    if (!literal.file) {
      // `usedBy`가 없으면 실사이트 확인용 합성 선택자다 — 소스 대조 대상이 아니다.
      continue;
    }
    const text = readSource(literal.file);
    if (text === null) {
      fail(`[${literal.site.id}] ${literal.name}: 없는 파일 ${literal.file}`);
      continue;
    }
    if (!text.includes(literal.value)) {
      fail(
        `[${literal.site.id}] ${literal.name}: ${literal.file}에 "${literal.value}"이(가) 없습니다 — 소스와 계약이 어긋났습니다`,
      );
    }
  }

  // ── 3. 소스 → 매니페스트 (페이지 특이 선택자 인벤토리) ───────────────────────
  const sourceSelectors = extractSelectorsFromSource();
  for (const entry of sourceSelectors) {
    if (!declaredSelectors.has(entry.selector)) {
      fail(
        `선언되지 않은 선택자: "${entry.selector}" (${entry.file}:${entry.line}) — 계약 매니페스트에 추가하세요`,
      );
    }
  }

  // ── 4. 결과 ────────────────────────────────────────────────────────────────
  const totals = {
    sites: manifest.SITES.length,
    checks: checkIds.size,
    selectors: declaredSelectors.size,
    sourceSelectors: sourceSelectors.length,
  };

  log(
    `[ok]   계약 매니페스트: 사이트 ${totals.sites}곳 · 점검 ${totals.checks}건 · 선언된 문자열 ${totals.selectors}개`,
  );
  if (failures.length === 0) {
    log(
      `[ok]   소스 대조: 페이지 특이 선택자 ${totals.sourceSelectors}개가 모두 선언되어 있습니다`,
    );
  } else {
    for (const failure of failures) {
      log(`[FAIL] ${failure}`);
    }
  }
  log(
    failures.length === 0
      ? '[ok]   계약 검증 통과'
      : `[FAIL] 계약 검증 실패: ${failures.length}건`,
  );

  return failures.length;
}

/** 배열/단일 값 어느 쪽이어도 배열로 만든다 */
function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { verifyContracts, extractSelectorsFromSource, SOURCE_FILES };
