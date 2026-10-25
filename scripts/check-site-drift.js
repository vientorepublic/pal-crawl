#!/usr/bin/env node
'use strict';

/**
 * scripts/check-site-drift.js — 대상 사이트 3곳의 **크롤러 계약**이 실사이트에서
 * 그대로인지 검증한다(계약이 깨지면 파서가 조용히 빈 값을 돌려주는 회귀가 된다).
 *
 * 배경: 이 라이브러리는 세 사이트의 HTML 선택자와 AJAX 흐름(엔드포인트·파라미터·
 * CSRF 헤더)에 의존한다. 그런데 파서는 프로젝트 규약상 **절대 예외를 던지지 않는다**
 * ("잘못된/빈 HTML이면 빈 배열·null·0으로 반환" — AGENTS.md). 그래서 사이트가
 * 리뉴얼되면 크롤러는 조용히 빈 값을 돌려주고, 회귀는 사용자 코드의 데이터 결손으로만
 * 드러난다. 이 스크립트는 실사이트를 호출해 **코드가 기대하는 계약**이 그대로인지 본다.
 *
 * 계약은 **데이터**다 — `scripts/drift-contracts/`의 사이트별 매니페스트에 선언되어
 * 있고(선택자·엔드포인트·필터·필드 형식·관계식), 이 파일은 그것을 실행하는 실행기다.
 *   - kind: 'dom'   요청 → HTML 선택자 확인
 *   - kind: 'parse' 요청 → 파서 실행 → 필드·관계식 확인
 *   - kind: 'flow'  명령형 흐름(세션·CSRF·AJAX 조각·교차 확인) → 필드 확인
 * 명령형 흐름(`FLOWS`)과 부가 점검(`EXTRAS`)은 여기 코드로 두되, 기대값은 매니페스트에
 * 남긴다. 파서를 고치면 매니페스트도 같은 PR에서 고쳐야 한다:
 * `npm run drift:contracts`가 매니페스트 ↔ `src/` 대조를 강제한다.
 *
 * 판정 3종 — 상태 값(`ok`/`drift`/`error`)은 JSON·코드에서 그대로 쓰고,
 * 사람에게 보이는 라벨만 한국어로 바꾼다(`STATUS_LABEL`).
 * - `ok`    : **계약 유지** — 파서가 기대하는 선택자·엔드포인트·필드가 실사이트에 살아 있음
 * - `drift` : **계약 위반**(사이트가 바뀐 것 — 선택자·엔드포인트·응답 필드의 소실/개명, 4xx·5xx)
 * - `error` : **확인 불가**(타임아웃·DNS·연결 오류) — 사이트 변경인지 일시 장애인지 단정 못 함
 *
 * 종료 코드: `0` = 전부 계약 유지, `1` = 계약 위반 있음, `2` = 계약 위반은 없고 확인 불가가 있음.
 * (계약 위반과 일시 장애를 구분해 알림이 오탐으로 소진되지 않게 한다.)
 *
 * 일시 장애 대응: 계약 위반이 없는데 확인 불가(`error`)가 남으면 **지연 후 기본 1회
 * 재점검**한다(`--retry`, `--retry-delay`). 재점검 결과는 판정 우선순위가 더 강할 때만
 * 채택하므로(`STATUS_RANK`: drift > ok > error > skipped) 일시 장애는 회복되지만
 * **드리프트는 재점검 성공으로 가려지지 않는다**. 이미 드리프트가 있으면(종료 코드 1)
 * 사이트 부하를 늘리지 않도록 재점검하지 않는다.
 *
 * 사용:
 *   npm run build
 *   node scripts/check-site-drift.js                        # 콘솔 요약
 *   node scripts/check-site-drift.js --json out.json --markdown out.md
 *   node scripts/check-site-drift.js --sites pal,nsm        # 일부 사이트만
 *   node scripts/check-site-drift.js --self-test            # 네트워크 없이 검출기 자체 검증
 *   node scripts/check-site-drift.js --contracts            # 매니페스트 ↔ src 대조(npm run drift:contracts)
 *
 * 이 스크립트는 `dist/`(배포 산출물)를 임포트한다 — 사용자가 실제로 쓰는 코드를
 * 점검하기 위해서다. 소스(src) 상태가 아니라 **빌드된 산출물**이 기준이다.
 * (`--self-test`, `--contracts`는 네트워크·dist 없이 돈다.)
 */

const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

const manifest = require('./drift-contracts');
const { verifyContracts } = require('./drift-contracts/verify');

const ROOT = path.join(__dirname, '..');
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.js');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

/** 사이트 부하 방지: 연속 요청 사이 지연(ms) */
const DEFAULT_DELAY_MS = 300;
/** CI에서 오래 매달리지 않도록 재시도는 2회로 제한한다(라이브러리 기본값은 3회) */
const REQUEST_CONFIG = { timeout: 20000, retryCount: 2 };
/** 확인 불가(타임아웃 등)가 남았을 때 재점검까지 기다리는 기본 시간(ms) */
const RETRY_DELAY_MS = 15000;

// ─── CLI ─────────────────────────────────────────────────────────────────────

const SITE_IDS = manifest.SITES.map((site) => site.id).join(', ');

const HELP = `사용: node scripts/check-site-drift.js [옵션]

옵션:
  --json <path>       점검 결과 JSON을 파일로 저장
  --markdown <path>   사람이 읽는 리포트(Markdown)를 파일로 저장
  --sites <list>      점검할 사이트 ID (쉼표 구분, 생략하면 전체)
                      사용 가능: ${SITE_IDS}
  --delay <ms>        연속 요청 사이 지연 (기본 ${DEFAULT_DELAY_MS}ms)
  --offline           네트워크 점검을 건너뛴다(--self-test와 함께 쓸 때 편의용)
  --retry <n>         확인 불가가 남았을 때 지연 후 재점검하는 횟수 (기본 1, 0이면 끔)
  --retry-delay <ms>  재점검 전 대기 (기본 ${RETRY_DELAY_MS}ms)
  --self-test         네트워크 없이 검출·분류·리포트 로직 자체를 검증
  --contracts         계약 매니페스트와 src 소스가 어긋나지 않았는지 검증
  --help              이 도움말
`;

function parseArgs(argv) {
  const options = {
    json: null,
    markdown: null,
    sites: null,
    delay: DEFAULT_DELAY_MS,
    retry: 1,
    retryDelay: RETRY_DELAY_MS,
    selfTest: false,
    contracts: false,
    offline: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`값이 필요한 옵션입니다: ${arg}`);
      }
      return argv[index];
    };

    switch (arg) {
      case '--json':
        options.json = next();
        break;
      case '--markdown':
        options.markdown = next();
        break;
      case '--sites':
        options.sites = next()
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        break;
      case '--delay':
        options.delay = Number.parseInt(next(), 10);
        break;
      case '--retry':
        options.retry = Number.parseInt(next(), 10);
        break;
      case '--retry-delay':
        options.retryDelay = Number.parseInt(next(), 10);
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      case '--contracts':
        options.contracts = true;
        break;
      case '--offline':
        options.offline = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`알 수 없는 옵션입니다: ${arg}`);
    }
  }

  if (!Number.isFinite(options.delay) || options.delay < 0) {
    throw new Error(`--delay 값이 올바르지 않습니다: ${options.delay}`);
  }
  if (!Number.isInteger(options.retry) || options.retry < 0) {
    throw new Error(`--retry 값이 올바르지 않습니다: ${options.retry}`);
  }
  if (!Number.isFinite(options.retryDelay) || options.retryDelay < 0) {
    throw new Error(`--retry-delay 값이 올바르지 않습니다: ${options.retryDelay}`);
  }

  return options;
}

// ─── 판정 도구 ───────────────────────────────────────────────────────────────

/**
 * 계약 위반(사이트 변경)을 나타내는 오류.
 * 이 오류만 `drift`로 분류하고, 그 밖의 오류는 `error`(확인 불가)로 본다.
 */
class DriftError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DriftError';
  }
}

/** 계약 위반이면 던진다. `error`(확인 불가)와 섞이지 않도록 DriftError를 쓴다. */
function expect(condition, message) {
  if (!condition) {
    throw new DriftError(message);
  }
}

/** 선택자들이 응답에 모두 존재하는지 확인하고, 존재 목록을 요약 문자열로 돌려준다. */
function expectSelectors(html, selectors, label) {
  expect(
    typeof html === 'string' && html.length > 0,
    `${label}: 응답 HTML이 비었습니다`,
  );
  const $ = cheerio.load(html);
  const missing = selectors.filter((selector) => $(selector).length === 0);
  if (missing.length > 0) {
    throw new DriftError(`${label}: 선택자 소실 → ${missing.join(', ')}`);
  }
  return `선택자 ${selectors.length}개 확인`;
}

/** `th` 텍스트로 표 헤더 계약을 확인하고 인벤토리를 돌려준다. */
function expectHeaders(html, spec) {
  expect(typeof html === 'string', '헤더 계약을 확인할 HTML이 없습니다');
  const $ = cheerio.load(html);
  const headers = $(spec.selector ?? 'th')
    .map((_, el) => $(el).text().replace(/\s+/g, '').trim())
    .get()
    .filter(Boolean);

  for (const required of spec.require ?? []) {
    expect(
      headers.some((header) => header.includes(required)),
      `"${required}" 헤더가 사라졌습니다 (가진 헤더: ${headers.join(', ')})`,
    );
  }
  return `헤더 [${headers.join(' / ')}]`;
}

/** 인벤토리(컬럼 목록·섹션 목록 등)를 뽑아 요약 문자열로 돌려준다. */
function collectInventory(html, spec) {
  expect(
    typeof html === 'string' && html.length > 0,
    `${spec.label} 인벤토리를 만들 HTML이 없습니다(매니페스트의 fetch/html 확인)`,
  );
  const $ = cheerio.load(html);
  const values = [];
  $(spec.selector).each((_, el) => {
    const value = spec.attribute
      ? $(el).attr(spec.attribute)
      : $(el).text().replace(/\s+/g, ' ').trim();
    if (value && !values.includes(value)) {
      values.push(value);
    }
  });
  if (values.length === 0) {
    throw new DriftError(
      `${spec.label} 인벤토리: "${spec.selector}"에서 값을 찾지 못했습니다`,
    );
  }
  return `${spec.label} [${values.join(' / ')}]`;
}

/** 오류 메시지를 한 줄로 정리한다. */
function messageOf(error) {
  if (error instanceof Error) {
    return error.message.replace(/\s+/g, ' ').trim();
  }
  return String(error);
}

/**
 * 확인 불가(`error`)인지 사이트 변경(`drift`)인지 구분한다.
 * HTTP 4xx·5xx는 HttpClient가 재시도까지 마친 뒤의 결과이므로 "엔드포인트가 바뀌었다"로
 * 보고 drift로 분류한다. 타임아웃·DNS·연결 실패는 일시 장애일 수 있어 확인 불가로 남긴다.
 */
function classifyFailure(error) {
  if (error instanceof DriftError) {
    return 'drift';
  }
  if (/Invalid response:\s*[45]\d\d/.test(messageOf(error))) {
    return 'drift';
  }
  return 'error';
}

/** 값이 채워져 있어야 하는 문자열 계약 */
function expectFilled(value, label) {
  expect(
    typeof value === 'string' && value.trim().length > 0,
    `${label}이(가) 비었습니다 (받은 값: ${JSON.stringify(value)})`,
  );
}

/** 정규식으로 형식 계약을 확인한다 */
function expectFormat(value, pattern, label) {
  expect(
    typeof value === 'string' && pattern.test(value),
    `${label} 형식이 바뀌었습니다 (받은 값: ${JSON.stringify(value)})`,
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// ─── 경로 해석(매니페스트의 path/summary 표현) ───────────────────────────────

/**
 * `items[0].billId` 같은 경로를 단계 목록으로 바꾼다.
 * `items[]`는 "모든 요소"를 뜻한다(각 항목에 같은 계약을 적용).
 */
function parsePath(dottedPath) {
  const steps = [];
  for (const chunk of dottedPath.split('.')) {
    const head = /^[^[\]]+/.exec(chunk);
    if (head) {
      steps.push({ key: head[0] });
    }
    for (const bracket of chunk.slice(head ? head[0].length : 0).match(/\[[^\]]*\]/g) ?? []) {
      const inner = bracket.slice(1, -1);
      steps.push(inner === '' ? { each: true } : { index: Number(inner) });
    }
  }
  return steps;
}

/** 경로를 따라가 만나는 값을 모두 모은다(없으면 빈 배열). */
function resolveValues(root, dottedPath) {
  let values = [root];
  for (const step of parsePath(dottedPath)) {
    const next = [];
    for (const value of values) {
      if (step.each) {
        if (Array.isArray(value)) {
          next.push(...value);
        }
      } else if (step.index !== undefined) {
        if (Array.isArray(value) && step.index < value.length) {
          next.push(value[step.index]);
        }
      } else if (
        (isPlainObject(value) || Array.isArray(value)) &&
        value[step.key] !== undefined
      ) {
        // 배열의 `length`처럼 속성으로 읽는 값도 있다(`items.length`).
        next.push(value[step.key]);
      }
    }
    values = next;
  }
  return values;
}

/** 경로의 첫 값(없으면 undefined) */
function resolveFirst(root, dottedPath) {
  return resolveValues(root, dottedPath)[0];
}

/**
 * `{path}` 자리표시자를 값으로 채운다. `tokens`가 있으면 그 이름을 먼저 본다
 * — 토큰 값이 `Config.X`면 라이브러리 설정 상수(엔드포인트)를 쓴다.
 */
function expandTemplate(template, tokens, scope, lib) {
  return template.replace(/\{([^{}]+)\}/g, (whole, name) => {
    const token = tokens?.[name];
    let value;
    if (token === undefined) {
      value = resolveFirst(scope, name);
    } else if (typeof token === 'string' && token.startsWith('Config.')) {
      value = lib.Config[token.slice('Config.'.length)];
    } else {
      value = resolveFirst(scope, token);
    }
    return value === undefined || value === null ? whole : String(value);
  });
}

// ─── 값 계약 실행기 ──────────────────────────────────────────────────────────

/** 매니페스트의 필드 계약 한 건을 확인한다. */
function expectField(scope, spec, env) {
  const label = spec.label ?? spec.path;
  let values = resolveValues(scope, spec.path);

  if (spec.optional) {
    // 값이 없는 것도 정상인 자리(예: 아직 의안원문이 없는 건) — 형식만 본다.
    values = values.filter(
      (value) => value !== undefined && value !== null && value !== '',
    );
    if (values.length === 0) {
      return;
    }
  }

  if (values.length === 0) {
    // `items[].x`처럼 "모든 항목"을 뜻하는 경로는 항목이 없으면 확인할 것이 없다
    // (목록 자체가 비었는지는 `items.length` 계약이 따로 본다).
    if (spec.path.includes('[]')) {
      return;
    }
    throw new DriftError(`${label} 값을 찾을 수 없습니다: ${spec.path}`);
  }
  for (const value of values) {
    assertValue(value, spec, scope, label, env);
  }
}

/** 값 하나에 대한 단언(필드 계약의 종류를 전부 여기서 처리한다) */
function assertValue(value, spec, scope, label, env) {
  const { lib } = env;
  const received = JSON.stringify(value);

  if (spec.filled) {
    expect(
      typeof value === 'string' && value.trim().length > 0,
      `${label}이(가) 비었습니다 (받은 값: ${received})`,
    );
  }
  if (spec.pattern) {
    expectFormat(
      typeof value === 'string' ? value : '',
      new RegExp(spec.pattern),
      label,
    );
  }
  if (spec.min !== undefined) {
    expect(
      typeof value === 'number' && value >= spec.min,
      `${label}이(가) ${spec.min} 이상이 아닙니다 (받은 값: ${received})`,
    );
  }
  if (spec.equals !== undefined) {
    expect(
      value === spec.equals,
      `${label}이(가) ${JSON.stringify(spec.equals)}가 아닙니다 (받은 값: ${received})`,
    );
  }
  if (spec.equalsPath !== undefined) {
    const expected = resolveFirst(scope, spec.equalsPath);
    expect(
      value === expected,
      `${label} 불일치: ${received} (기대 ${JSON.stringify(expected)} = ${spec.equalsPath})`,
    );
  }
  if (spec.notEqualsPath !== undefined) {
    const other = resolveFirst(scope, spec.notEqualsPath);
    expect(
      value !== other,
      `${label}이(가) ${spec.notEqualsPath}(=${JSON.stringify(other)})와 같습니다 — 페이지 이동이 반영되지 않았습니다`,
    );
  }
  if (spec.lessThanPath !== undefined) {
    const other = resolveFirst(scope, spec.lessThanPath);
    expect(
      typeof value === 'number' && value < other,
      `${label}이(가) ${spec.lessThanPath}(=${other})보다 작지 않습니다 (받은 값: ${received}) — 필터가 반영되지 않았습니다`,
    );
  }
  if (spec.linkPrefix !== undefined) {
    const domain = lib.Config[spec.linkPrefix];
    expect(
      typeof value === 'string' && value.startsWith(`${domain}/`),
      `${label}이(가) ${spec.linkPrefix}(${domain}) 기준이 아닙니다: ${received}`,
    );
  }
  if (spec.template !== undefined) {
    const expected = expandTemplate(spec.template, spec.tokens, scope, lib);
    expect(
      value === expected,
      `${label} 형식이 바뀌었습니다: ${received} (기대 ${expected})`,
    );
  }
  if (spec.requireKeys !== undefined) {
    const keys = isPlainObject(value) ? Object.keys(value) : [];
    const missing = spec.requireKeys.filter((key) => !keys.includes(key));
    expect(
      missing.length === 0,
      `${label} 누락: ${missing.join(', ')} (가진 필드: ${keys.join(', ') || '없음'})`,
    );
  }
}

/** 값 사이의 관계식(예: 페이지 수 = ceil(총계 / rows)) */
function expectRelations(scope, relations) {
  for (const relation of relations ?? []) {
    if (relation.kind === 'ceilDivisor') {
      const total = resolveFirst(scope, relation.of);
      const target = resolveFirst(scope, relation.target);
      const expected = Math.ceil(total / relation.divisor);
      expect(
        target === expected,
        `${relation.label}이(가) 깨졌습니다: ${relation.target}=${target}, ${relation.of}=${total} (기대 ${expected})`,
      );
    } else if (relation.kind === 'pageSize') {
      const list = resolveFirst(scope, relation.list);
      const total = resolveFirst(scope, relation.total);
      const expected = Math.min(relation.size, total);
      expect(
        Array.isArray(list) && list.length === expected,
        `${relation.label}이(가) 반영되지 않았습니다: pages=${Array.isArray(list) ? list.length : 'n/a'}, ${relation.total}=${total} (기대 ${expected})`,
      );
    }
  }
}

// ─── 점검 실행기 ─────────────────────────────────────────────────────────────

class Checker {
  constructor(delayMs) {
    this.delayMs = delayMs;
    this.results = [];
  }

  /**
   * 점검 하나를 실행해 결과를 누적한다. 어떤 예외도 밖으로 던지지 않는다
   * (점검 하나가 죽어도 나머지 점검은 계속 돌아야 한다).
   */
  async runCheck(siteId, check, context) {
    const entry = {
      site: siteId,
      id: check.id,
      label: check.label,
      status: 'ok',
      detail: '',
      ms: 0,
    };
    const startedAt = Date.now();

    try {
      const dependencyFailed = (check.dependsOn ?? []).some(
        (dep) =>
          !this.results.some(
            (result) => result.id === dep && result.status === 'ok',
          ),
      );

      if (dependencyFailed) {
        entry.status = 'skipped';
        entry.detail = `선행 점검(${check.dependsOn.join(', ')})이 통과하지 않아 건너뜀`;
      } else {
        const detail = await check.run(context);
        entry.detail = typeof detail === 'string' ? detail : '';
      }
    } catch (error) {
      entry.status = classifyFailure(error);
      entry.detail = messageOf(error);
    }

    entry.ms = Date.now() - startedAt;
    this.results.push(entry);

    if (this.delayMs > 0 && entry.status !== 'skipped') {
      await sleep(this.delayMs);
    }

    return entry;
  }

  async runSite(site) {
    const context = {};
    for (const check of site.checks) {
      await this.runCheck(site.id, check, context);
    }
  }

  get counts() {
    return {
      checks: this.results.length,
      ok: this.results.filter((r) => r.status === 'ok').length,
      drift: this.results.filter((r) => r.status === 'drift').length,
      inconclusive: this.results.filter((r) => r.status === 'error').length,
      skipped: this.results.filter((r) => r.status === 'skipped').length,
    };
  }

  /** 0 = 전부 ok, 1 = drift 있음, 2 = 확인 불가만 있음 */
  get exitCode() {
    const { drift, inconclusive } = this.counts;
    if (drift > 0) return 1;
    if (inconclusive > 0) return 2;
    return 0;
  }
}

/**
 * 판정 우선순위 — 재점검 결과가 **더 강한** 판정일 때만 채택한다.
 * 그래서 일시 장애(`error`)는 `ok`로 회복되지만, 드리프트(`drift`)는 재점검이
 * 우연히 성공해도 가려지지 않는다(계약 위반을 놓치는 쪽이 더 큰 손실이다).
 */
const STATUS_RANK = { drift: 3, ok: 2, error: 1, skipped: 0 };

/** 재점검을 하지 않았을 때의 기본 형태 */
function emptyRetry(delayMs) {
  return {
    attempts: 0,
    delayMs: delayMs ?? null,
    sites: [],
    checks: 0,
    recovered: [],
  };
}

/**
 * 확인 불가(`error`)가 남은 사이트만 **지연 후 다시 점검**한다(기본 1회).
 *
 * 왜 사이트 단위로 다시 도는가: 점검은 앞 점검이 만든 컨텍스트(받은 HTML·파싱 결과)에
 * 의존하므로 그 점검만 따로 다시 돌릴 수 없다. 대신 재점검 결과를 판정 우선순위로
 * 병합해, 1차에서 통과한 항목은 낮은 판정으로 덮어쓰지 않는다.
 *
 * 어떤 예외도 밖으로 던지지 않는다 — 재점검이 이상해도 1차 판정과 리포트가 남아야 한다.
 */
async function retryInconclusive(
  primary,
  sites,
  { attempts, delayMs, log = console.log },
) {
  const info = emptyRetry(delayMs);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const affected = sites.filter((site) =>
      primary.results.some(
        (result) => result.site === site.id && result.status === 'error',
      ),
    );
    if (affected.length === 0) {
      break;
    }

    log(
      `\n↻ 확인 불가 항목 재점검 ${attempt}/${attempts} — ${delayMs}ms 대기 후 ${affected
        .map((site) => site.label)
        .join(', ')}`,
    );
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const retryChecker = new Checker(primary.delayMs);
    for (const site of affected) {
      await retryChecker.runSite(site);
    }

    info.attempts = attempt;
    info.checks += retryChecker.results.length;
    for (const site of affected) {
      if (!info.sites.includes(site.id)) {
        info.sites.push(site.id);
      }
    }

    for (const retried of retryChecker.results) {
      const current = primary.results.find(
        (result) => result.id === retried.id,
      );
      if (current === undefined) {
        continue;
      }
      current.retried = true;
      if (STATUS_RANK[retried.status] > STATUS_RANK[current.status]) {
        info.recovered.push({
          id: current.id,
          from: current.status,
          to: retried.status,
        });
        current.previousStatus = current.status;
        current.status = retried.status;
        current.detail = retried.detail;
        current.ms = retried.ms;
      }
    }
  }

  return info;
}

// ─── 요청 op (사이트마다 다른 호출 한 줄) ────────────────────────────────────
//
// 매니페스트는 "무엇을 기대하는가"를 담고, 실제 호출은 여기 한 줄로 둔다.
// op는 `fetch`/`parse`/`derive` 단계에서 이름으로 불린다.

/** 세션(CSRF 토큰·쿠키)을 유지해야 하므로 사이트당 하나만 만들어 재사용한다. */
function likmsStateCrawler(env) {
  if (!env.context.likmsStateCrawler) {
    env.context.likmsStateCrawler = new env.lib.LikmsStateCrawler(env.config);
  }
  return env.context.likmsStateCrawler;
}

const OPS = {
  // 국회입법예고 (PalCrawl / PalParser)
  'pal.list': (env) => new env.lib.PalCrawl(env.config).getPalHTML(),
  'pal.list.parse': (env) =>
    new env.lib.PalParser().parseSearchResult(env.html),
  'pal.search2': (env) =>
    new env.lib.PalCrawl(env.config).search({ pageIndex: 2 }),
  'pal.detail': (env) =>
    new env.lib.PalCrawl(env.config).getContentHTML(env.from.contentId),
  'pal.detail.parse': (env) => new env.lib.PalParser().parseContent(env.html),

  // 국민참여입법센터 (NsmLmSts / NsmLmStsParser)
  'nsm.list': (env) =>
    new env.lib.NsmLmSts(env.config).getListHTML({ pageSize: 10 }),
  'nsm.list.parse': (env) => new env.lib.NsmLmStsParser().parseList(env.html),
  'nsm.pending': (env) =>
    new env.lib.NsmLmSts(env.config).searchPending({
      pageSize: 10,
      sugCd: '22',
      endSugCd: '22',
    }),
  'nsm.detail': (env) =>
    new env.lib.NsmLmSts(env.config).getDetailHTML(env.from.billNo),
  'nsm.detail.parse': (env) =>
    new env.lib.NsmLmStsParser().parseDetail(env.html),

  // 국회 의안정보시스템 (LikmsStateCrawler / LikmsCrawler)
  'likms.statePage': (env) => likmsStateCrawler(env).getStatePageHTML(),
  'likms.stateList': (env) =>
    likmsStateCrawler(env).getStateListHTML({ pageSize: env.site.pageSize }),
  'likms.stateList.parse': (env) => likmsStateCrawler(env).parseList(env.html),
  'likms.csrfToken': (env) => likmsStateCrawler(env).extractCsrfToken(env.html),
  'likms.stateFormParams': (env) =>
    likmsStateCrawler(env).parseStateFormParams(env.html),
};

// ─── 명령형 흐름 (매니페스트의 `kind: 'flow'`) ───────────────────────────────
//
// 세션·CSRF를 거치는 AJAX, 여러 요청을 비교하는 점검은 데이터만으로 표현할 수 없어
// 여기 코드로 둔다. 다만 **기대값은 매니페스트에** 남긴다(fields/relations/options).

/** 계류의안 목록의 발의자 표기에서 대표발의자 이름만 뽑는다 */
function extractProposerName(proposer) {
  if (!/등\s*\d+인$/.test(proposer ?? '')) {
    return '';
  }
  return proposer
    .replace(/\s*등\s*\d+인$/, '')
    .replace(/(의원|위원장)$/, '')
    .trim();
}

const FLOWS = {
  /** 소관위 목록 JSON(findAgeCmt.do) — 이름만으로는 필터를 못 걸어 코드를 확인한다. */
  async 'likms.committees'(env) {
    const committees = await likmsStateCrawler(env).findCommittees(22, 22);

    // 다음 점검(ageCmtId 필터)이 쓸 기준 위원회를 고른다.
    const target =
      committees.find((item) => item.comCdName === '법제사법위원회') ??
      committees.find((item) => item.comCdName.endsWith('위원회'));
    expect(
      target !== undefined,
      '위원회명이 "…위원회"로 끝나는 항목이 없습니다(JSON 계약 변경 의심)',
    );
    env.context.committee = target;

    return {
      committees,
      target,
      numericCodes: committees.filter((item) => /^\d+$/.test(item.comCd))
        .length,
      nonNumeric: committees
        .filter((item) => !/^\d+$/.test(item.comCd))
        .map((item) => `${item.comCd}/${item.comCdName}`),
    };
  },

  /** 검색 필터가 실제로 결과를 좁히는지(파라미터가 조용히 무시되면 여기서 걸린다). */
  async 'likms.stateFilters'(env) {
    const crawler = likmsStateCrawler(env);
    const pendingFilter = env.site.filters.pending;
    const committeeFilter = env.site.filters.committee;
    const committee = env.context.committee;
    expect(
      committee !== undefined,
      '선행 점검에서 기준 위원회를 얻지 못했습니다',
    );

    const all = await crawler.search({ pageSize: 1 });
    const pendingOnly = await crawler.search({
      pageSize: 1,
      [pendingFilter.param]: pendingFilter.value,
    });
    const scoped = await crawler.search({
      pageSize: env.site.pageSize,
      [committeeFilter.param]: committee.comCd,
    });

    return {
      all,
      pendingOnly,
      scoped,
      committeesInPage: [
        ...new Set(scoped.items.map((item) => item.committee)),
      ],
    };
  },

  /** 의안상세 2단계 흐름: 상세 페이지 → #form 숨김 필드 → billInfo.do 조각. */
  async 'likms.detailFlow'(env) {
    const item = env.from;
    const crawler = new env.lib.LikmsCrawler(env.config);

    const pageHtml = await crawler.getDetailPageHTML(item.billId);
    env.context.likmsDetailPageHtml = pageHtml;

    const params = crawler.parseDetailFormParams(pageHtml);
    const fragment = await crawler.getBillInfoHTML(params);
    env.context.likmsFragmentHtml = fragment;

    const parser = new env.lib.LikmsDetailParser();
    return {
      item,
      params,
      fragment,
      detail: parser.parseDetail(fragment),
      reason: parser.parseProposalReason(fragment),
    };
  },

  /** 동명이인 후보 팝업 — 이름만으로는 의원을 확정할 수 없어 사이트가 후보를 준다. */
  async 'likms.candidates'(env) {
    const items = resolveFirst(env.context, 'likmsList.items') ?? [];
    const names = [
      ...new Set(
        items.map((item) => extractProposerName(item.proposer)).filter(Boolean),
      ),
    ].slice(0, env.check.options?.maxNames ?? 3);

    expect(
      names.length > 0,
      '목록에서 대표발의자 이름을 하나도 추출하지 못했습니다(proposer 표기 확인)',
    );

    let found = null;
    for (const name of names) {
      const candidates =
        await likmsStateCrawler(env).findRepresentCandidates(name);
      if (candidates.length > 0) {
        found = { name, candidates };
        break;
      }
    }
    expect(
      found !== null,
      `대표발의자 후보를 찾지 못했습니다 (시도: ${names.join(', ')}) — 팝업 DOM·엔드포인트 확인 필요`,
    );

    return { names, name: found.name, candidates: found.candidates };
  },

  /** 교차: PAL contentId가 likms billId로 그대로 쓰이는가(제안이유 보정 경로). */
  async 'bridge.palLikmsReason'(env) {
    const list = await new env.lib.PalCrawl(env.config).search();
    expect(list.items.length > 0, 'PAL 목록이 비어 교차 점검을 할 수 없습니다');

    const pattern = new RegExp(env.check.options.contentIdPattern);
    const maxTries = env.check.options.maxTries;
    const crawler = new env.lib.LikmsCrawler(env.config);

    const tried = [];
    let bridged = null;
    for (const item of list.items.slice(0, maxTries)) {
      if (!pattern.test(item.contentId ?? '')) {
        continue;
      }
      tried.push(item.contentId);
      const pageHtml = await crawler.getDetailPageHTML(item.contentId);
      const params = crawler.parseDetailFormParams(pageHtml);
      if (params.billId !== item.contentId) {
        continue; // 두 사이트의 ID 체계가 어긋난 건 — 다음 후보로
      }
      const fragment = await crawler.getBillInfoHTML(params);
      const reason = crawler.parseProposalReason(fragment);
      if (reason) {
        bridged = { contentId: item.contentId, length: reason.length };
        break;
      }
    }

    expect(
      tried.length > 0,
      'PAL 목록에 PRC_ contentId가 없습니다(목록 파싱·ID 체계 확인)',
    );
    expect(
      bridged !== null,
      `PAL contentId ${tried.join(', ')} 중 어느 것도 likms 제안이유로 이어지지 않았습니다(보정 경로 단절)`,
    );

    return { list, tried, bridged };
  },
};

// ─── 부가 점검 (매니페스트의 `extra`) ────────────────────────────────────────
//
// 필드 계약만으로 표현하기 어려운 교차 확인("본문은 있는데 파싱이 비면 구조 변경")과
// 리포트에 남길 부가 정보를 담당한다.

const EXTRAS = {
  /** 제안이유 섹션은 있을 수도(그때는 본문이 있어야 한다) 없을 수도 있다. */
  'pal.reasonConsistency'(env) {
    const $ = cheerio.load(env.context.palDetailHtml ?? '');
    let sectionExists = false;
    let reasonDesc = '';
    $('.card-wrap .item').each((_, item) => {
      const heading = $(item).find('h4').first().text().replace(/\s+/g, '');
      if (heading.includes('제안이유')) {
        sectionExists = true;
        reasonDesc = $(item)
          .find('.desc')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim();
      }
    });

    // 본문이 제목만 반복하는 경우는 파서가 제목 줄을 잘라내므로 '빈 섹션'과 같다.
    const descIsEmpty =
      reasonDesc === '' || reasonDesc.replace(/\s+/g, '') === '제안이유및주요내용';
    if (!sectionExists) {
      return '제안이유 섹션 없음(likms 보정 경로 사용)';
    }
    if (descIsEmpty) {
      return '제안이유 섹션 본문 비어 있음(likms 보정 경로 사용)';
    }
    expect(
      env.scope.proposalReason !== null,
      '제안이유 본문은 있는데 파싱 결과가 null입니다(섹션 제목·구조 변경 의심)',
    );
    return `제안이유 ${env.scope.proposalReason.length}자`;
  },

  /** 상세 조각의 제안이유 본문이 있는데 파싱이 null이면 구조 변경 신호다. */
  'nsm.reasonConsistency'(env) {
    const $ = cheerio.load(env.context.nsmDetailHtml ?? '');
    const hasHeader = $('th')
      .map((_, el) => $(el).text().replace(/\s+/g, ''))
      .get()
      .some((header) => header.includes('제안이유'));
    const hasReasonBody = $('pre').length > 0;
    if (hasHeader && hasReasonBody) {
      expect(
        env.scope.proposalReason !== null,
        '제안이유 헤더·본문은 있는데 파싱 결과가 null입니다',
      );
    }
    return env.scope.proposalReason === null
      ? '제안이유 null'
      : `제안이유 ${env.scope.proposalReason.length}자`;
  },

  /** `#prntSummary` 본문은 있는데 파싱이 null이면 구조 변경 신호다. */
  'likms.reasonConsistency'(env) {
    const raw = cheerio
      .load(env.context.likmsFragmentHtml ?? '')('#prntSummary')
      .text()
      .trim();
    if (raw !== '') {
      expect(
        env.scope.reason !== null,
        '#prntSummary 본문은 있는데 제안이유 파싱이 null입니다(구조 변경 의심)',
      );
    }
    const docAnchors = cheerio
      .load(env.context.likmsFragmentHtml ?? '')('#insc-rcp-row td.doc a')
      .length;
    return `문서 링크 ${docAnchors}개 · 제안이유 ${
      env.scope.reason === null ? 'null' : `${env.scope.reason.length}자`
    }`;
  },

  /**
   * 목록에서 "조용히 꺼지는 경로"를 비율로 감시한다.
   * - 대표발의자 이름: 뽑히지 않으면 의원 해석·동명이인 후보 점검의 전제가 무너진다.
   * - 소관위 표기: 회부 전 건은 빈 값이 정상이므로 **전부 빈 값일 때만** 이상으로 본다.
   * - 제안이유 팝업 링크(`hasProposalReason`): onclick 이름이 바뀌면 전부 false가 되어
   *   likms 제안이유 보정 경로가 소리 없이 꺼진다.
   */
  'likms.listCoverage'(env) {
    const items = resolveFirst(env.scope, 'items') ?? [];
    const withProposer = items.filter(
      (item) => extractProposerName(item.proposer) !== '',
    ).length;
    const withCommittee = items.filter(
      (item) => typeof item.committee === 'string' && item.committee !== '',
    ).length;
    const withReason = items.filter((item) => item.hasProposalReason).length;

    expect(
      items.length === 0 || withCommittee > 0,
      '목록 50건 모두 소관위가 비었습니다(`td.currCmt` 파싱 확인)',
    );
    expect(
      items.length === 0 || withReason > 0,
      '제안이유 팝업 링크(a[onclick*=openSummaryPopup])가 한 건도 잡히지 않았습니다 — likms 보정 경로가 꺼집니다',
    );

    return `대표발의자 ${withProposer}/${items.length} · 소관위 표기 ${withCommittee}/${items.length} · 제안이유 링크 ${withReason}/${items.length}`;
  },

  /** 코드가 아닌 센티넬(예: 미확정 N999999)이 섞여 있으면 리포트에 남긴다. */
  'likms.committeeCodes'(env) {
    const nonNumeric = env.scope.nonNumeric ?? [];
    return nonNumeric.length > 0
      ? `비숫자 코드 [${nonNumeric.join(', ')}]`
      : '';
  },

  /** CSRF 토큰은 값 자체를 리포트에 남기지 않고 길이만 남긴다. */
  'likms.sessionSummary'(env) {
    const token = env.scope.csrfToken;
    return `CSRF 토큰 ${typeof token === 'string' ? token.length : 0}자`;
  },
};

// ─── 매니페스트 실행 ─────────────────────────────────────────────────────────

/** 매니페스트가 선언한 요청 op를 실행한다. */
function runOp(name, env) {
  const op = OPS[name];
  expect(op !== undefined, `실행기에 없는 요청 op입니다: ${name}`);
  return op(env);
}

/** 매니페스트의 점검 하나를 실행하고 리포트에 남길 한 줄을 돌려준다. */
async function executeCheck(env) {
  const { context, site, check } = env;
  const parts = [];

  // `from`은 컨텍스트 바인딩 경로(예: 앞 점검이 바인딩한 목록의 첫 건)를 뜻한다.
  const fromPath = check.fetch?.from ?? check.from;
  const from =
    fromPath === undefined ? undefined : resolveFirst(context, fromPath);
  if (fromPath !== undefined) {
    expect(
      from !== undefined,
      `컨텍스트에서 ${fromPath}을(를) 찾지 못했습니다(선행 점검 확인)`,
    );
  }

  // 1. 요청 — 결과를 컨텍스트에 묶어 뒤 점검이 재사용한다(사이트 부하 절반).
  let fetched;
  if (check.fetch) {
    fetched = await runOp(check.fetch.op, { ...env, from });
    if (check.fetch.bind) {
      context[check.fetch.bind] = fetched;
    }
  }

  // 2. 파싱 또는 명령형 흐름 → 이 점검이 확인할 대상
  let subject;
  if (check.parse) {
    const source = check.parse.from
      ? resolveFirst(context, check.parse.from)
      : fetched;
    subject = await runOp(check.parse.op, { ...env, html: source });
    if (check.parse.bind) {
      context[check.parse.bind] = subject;
    }
  } else if (check.flow) {
    const flow = FLOWS[check.flow];
    expect(flow !== undefined, `실행기에 없는 흐름입니다: ${check.flow}`);
    subject = await flow({ ...env, from });
  } else {
    subject = fetched;
  }

  // 3. 선택자 계약 — 흐름이 스스로 묶은 HTML(check.html)이나 방금 받은 응답을 본다.
  const html = check.html ? resolveFirst(context, check.html) : fetched;
  const fragment = check.fragment
    ? resolveFirst(context, check.fragment)
    : undefined;
  const liveDom = manifest.liveSelectorsOf(check);
  if (liveDom.length > 0) {
    parts.push(expectSelectors(html, liveDom, check.label));
  }
  const liveFragmentDom = manifest.liveSelectorsOf(check, 'fragmentDom');
  if (liveFragmentDom.length > 0) {
    parts.push(
      `조각 ${expectSelectors(fragment, liveFragmentDom, `${check.label}(조각)`)}`,
    );
  }
  if (check.headers) {
    parts.push(expectHeaders(html, check.headers));
  }
  for (const inventory of [check.inventory, check.fragmentInventory]) {
    if (inventory) {
      parts.push(
        collectInventory(inventory === check.inventory ? html : fragment, inventory),
      );
    }
  }

  // 4. 값 계약 — 컨텍스트 바인딩과 합쳐 경로를 푼다(다른 점검이 바인딩한 값도 참조).
  const scope = {
    ...context,
    ...(isPlainObject(subject) ? subject : {}),
  };
  for (const [key, op] of Object.entries(check.derive ?? {})) {
    scope[key] = await runOp(op, { ...env, html });
    context[key] = scope[key];
  }
  for (const field of check.fields ?? []) {
    expectField(scope, field, { lib: env.lib });
  }
  expectRelations(scope, check.relations);

  // 5. 사람이 읽을 요약
  if (check.summary) {
    parts.push(expandTemplate(check.summary, check.tokens, scope, env.lib));
  }
  if (check.extra) {
    const extra = EXTRAS[check.extra];
    expect(extra !== undefined, `실행기에 없는 부가 점검입니다: ${check.extra}`);
    const text = extra({ ...env, scope, subject });
    if (text) {
      parts.push(text);
    }
  }

  return parts.filter(Boolean).join(' · ');
}

/** 매니페스트를 실행기가 쓰는 사이트/점검 구조로 바꾼다. */
function createSites(lib, config, selected) {
  return manifest.SITES.filter(
    (site) => selected === null || selected.includes(site.id),
  ).map((site) => ({
    id: site.id,
    label: site.label,
    checks: site.checks.map((check) => ({
      id: check.id,
      label: check.label,
      dependsOn: check.dependsOn,
      run: (context) => executeCheck({ lib, config, site, check, context }),
    })),
  }));
}

// ─── 검출기 자체 검증(--self-test) ───────────────────────────────────────────

/**
 * 네트워크 없이 **검출기 로직**을 검증한다: 선택자가 사라지면 drift로 잡히는지,
 * 필드·관계식 계약이 어긋나면 잡히는지, 4xx·5xx는 drift, 타임아웃은 확인 불가로
 * 분류되는지, 종료 코드가 규칙대로 나오는지.
 * (사이트 계약 점검 자체는 실사이트 호출로만 검증할 수 있다.)
 */
const SELF_TEST_GOOD_HTML =
  '<table><tbody><tr><td class="td_block">' +
  '<a class="board_subject" href="/napal/view.do?lgsltPaId=PRC_TEST">제목</a>' +
  '</td></tr></tbody></table>';

const SELF_TEST_LIB = { Config: { DOMAIN: 'https://example.test' } };

const SELF_TEST_CASES = [
  {
    id: 'self/good-selector',
    label: '계약이 유지된 fixture는 통과해야 한다',
    expected: 'ok',
    run: () =>
      expectSelectors(
        SELF_TEST_GOOD_HTML,
        ['td.td_block > a.board_subject'],
        'self-test',
      ),
  },
  {
    id: 'self/renamed-class',
    label: '클래스명이 바뀐 fixture는 drift여야 한다',
    expected: 'drift',
    run: () =>
      expectSelectors(
        SELF_TEST_GOOD_HTML.replace(
          'class="board_subject"',
          'class="board-subject"',
        ),
        ['td.td_block > a.board_subject'],
        'self-test',
      ),
  },
  {
    id: 'self/assertion',
    label: '계약 검증 실패는 drift여야 한다',
    expected: 'drift',
    run: () => expect(false, '의안명 앵커가 사라졌습니다'),
  },
  {
    id: 'self/field-contract',
    label: '필드 계약(형식)이 깨지면 drift여야 한다',
    expected: 'drift',
    run: () =>
      expectField(
        { items: [{ billId: 'BILL_1' }] },
        { path: 'items[].billId', pattern: '^PRC_', label: 'billId' },
        { lib: SELF_TEST_LIB },
      ),
  },
  {
    id: 'self/relation-contract',
    label: '관계식이 깨지면 drift여야 한다',
    expected: 'drift',
    run: () =>
      expectRelations(
        { total: 120, totalPages: 2 },
        [
          {
            kind: 'ceilDivisor',
            of: 'total',
            divisor: 50,
            target: 'totalPages',
            label: '페이지 수',
          },
        ],
      ),
  },
  {
    id: 'self/http-5xx',
    label: '재시도 후 5xx는 drift여야 한다(엔드포인트 변경 신호)',
    expected: 'drift',
    run: () => {
      throw new Error('Invalid response: 503 Service Unavailable');
    },
  },
  {
    id: 'self/timeout',
    label: '타임아웃은 확인 불가(error)여야 한다',
    expected: 'error',
    run: () => {
      throw new Error('Request timeout after 20000ms');
    },
  },
];

async function runSelfTest() {
  const failures = [];
  const checker = new Checker(0);

  for (const testCase of SELF_TEST_CASES) {
    const entry = await checker.runCheck('self-test', testCase, {});
    const passed = entry.status === testCase.expected;
    console.log(
      `${passed ? '[ok]  ' : '[FAIL]'} ${testCase.id} — 기대 ${testCase.expected}, 실제 ${entry.status}`,
    );
    if (!passed) {
      failures.push(`${testCase.id}: 기대 ${testCase.expected}, 실제 ${entry.status}`);
    }
  }

  // 분류·집계·종료 코드 규칙 검증
  const counts = checker.counts;
  const expectedCounts = { ok: 1, drift: 5, inconclusive: 1 };
  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (counts[key] !== expected) {
      failures.push(`집계 ${key}: 기대 ${expected}, 실제 ${counts[key]}`);
    }
  }
  if (checker.exitCode !== 1) {
    failures.push(`exitCode: 기대 1, 실제 ${checker.exitCode}`);
  }

  const okOnly = new Checker(0);
  await okOnly.runCheck('self-test', SELF_TEST_CASES[0], {});
  if (okOnly.exitCode !== 0) {
    failures.push(`전부 ok일 때 exitCode: 기대 0, 실제 ${okOnly.exitCode}`);
  }

  const errorOnly = new Checker(0);
  const timeoutCase = SELF_TEST_CASES[SELF_TEST_CASES.length - 1];
  await errorOnly.runCheck('self-test', timeoutCase, {});
  if (errorOnly.exitCode !== 2) {
    failures.push(`확인 불가만 있을 때 exitCode: 기대 2, 실제 ${errorOnly.exitCode}`);
  }

  // 일시 장애 재점검: 회복은 되지만 드리프트는 재점검 성공으로 가려지지 않아야 한다
  const retryPrimary = new Checker(0);
  let flakyCalls = 0;
  let driftThenOkCalls = 0;
  const timeoutError = () => new Error('Request timeout after 20000ms');
  const retrySite = {
    id: 'self/retry',
    label: '재점검 사이트',
    checks: [
      {
        id: 'self/retry-recovers',
        label: '첫 시도 확인 불가 → 재점검 성공',
        run: () => {
          flakyCalls += 1;
          if (flakyCalls === 1) {
            throw timeoutError();
          }
          return '재점검에서 회복';
        },
      },
      {
        id: 'self/retry-stays',
        label: '재점검에서도 확인 불가',
        run: () => {
          throw timeoutError();
        },
      },
      {
        id: 'self/retry-guards-drift',
        label: '드리프트는 재점검 성공으로 가려지지 않는다',
        run: () => {
          driftThenOkCalls += 1;
          if (driftThenOkCalls === 1) {
            throw new DriftError('선택자 소실 → td.td_block > a.board_subject');
          }
          return '재점검에서는 선택자가 보임';
        },
      },
    ],
  };
  await retryPrimary.runSite(retrySite);
  const retryInfo = await retryInconclusive(retryPrimary, [retrySite], {
    attempts: 1,
    delayMs: 0,
    log: () => {},
  });
  const retryById = Object.fromEntries(
    retryPrimary.results.map((result) => [result.id, result]),
  );
  if (
    retryById['self/retry-recovers'].status !== 'ok' ||
    retryById['self/retry-recovers'].previousStatus !== 'error'
  ) {
    failures.push(
      `재점검 회복: 기대 error→ok, 실제 ${retryById['self/retry-recovers'].status}`,
    );
  }
  if (
    retryById['self/retry-stays'].status !== 'error' ||
    retryById['self/retry-stays'].retried !== true
  ) {
    failures.push(
      `재점검 후 잔여 확인 불가: 기대 error+재점검 표시, 실제 ${retryById['self/retry-stays'].status}`,
    );
  }
  if (retryById['self/retry-guards-drift'].status !== 'drift') {
    failures.push(
      `재점검이 드리프트를 가렸습니다: 실제 ${retryById['self/retry-guards-drift'].status}`,
    );
  }
  if (retryInfo.attempts !== 1 || retryInfo.recovered.length !== 1) {
    failures.push(
      `재점검 집계: attempts=${retryInfo.attempts} recovered=${retryInfo.recovered.length}`,
    );
  }
  const retryReport = buildReport(retryPrimary.results, {
    startedAt: new Date(),
    retry: retryInfo,
  });
  const retryMarkdown = renderMarkdown(retryReport, { title: 'self-test' });
  if (
    !retryMarkdown.includes('재점검:') ||
    !retryMarkdown.includes('재점검에서 판정 변경')
  ) {
    failures.push('재점검 정보가 Markdown 리포트에 없습니다');
  }
  if (retryReport.retry.attempts !== 1) {
    failures.push('재점검 정보가 JSON 리포트에 없습니다');
  }

  // 리포트 렌더링이 검출 결과를 담고 있는지
  const report = buildReport(checker.results, { startedAt: new Date() });
  const markdown = renderMarkdown(report, { title: 'self-test' });
  const json = JSON.stringify(report);
  if (!markdown.includes(SELF_TEST_CASES[1].id) && !markdown.includes('renamed')) {
    failures.push('Markdown 리포트에 drift 항목이 없습니다');
  }
  if (!json.includes('"drift"') || report.drift.length !== 5) {
    failures.push('JSON 리포트에 drift 항목이 없습니다');
  }

  // 매니페스트 실행기가 경로·템플릿을 제대로 푸는지
  const scope = {
    items: [{ billNo: '2221883' }],
    committee: { comCdName: '법제사법위원회' },
  };
  if (resolveFirst(scope, 'items[0].billNo') !== '2221883') {
    failures.push('경로 해석: items[0].billNo');
  }
  if (resolveValues(scope, 'items[].billNo').length !== 1) {
    failures.push('경로 해석: items[].billNo');
  }
  const expanded = expandTemplate(
    '{DOMAIN}/{billNo}',
    { DOMAIN: 'Config.DOMAIN', billNo: 'items[0].billNo' },
    scope,
    SELF_TEST_LIB,
  );
  if (expanded !== 'https://example.test/2221883') {
    failures.push(`템플릿 확장: ${expanded}`);
  }

  // 매니페스트 자체가 실행기와 어긋나지 않는지(흐름·부가 점검 이름)
  const contractFailures = verifyContracts({
    knownFlows: Object.keys(FLOWS),
    knownExtras: Object.keys(EXTRAS),
    log: () => {},
  });
  if (contractFailures > 0) {
    failures.push(`계약 매니페스트 검증 실패: ${contractFailures}건`);
  }

  console.log(
    `\n${SELF_TEST_CASES.length + 5 - failures.length}/${SELF_TEST_CASES.length + 5} self-test 항목 통과`,
  );
  if (failures.length > 0) {
    console.error('self-test 실패:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
  }
  return failures.length;
}

// ─── 리포트 ──────────────────────────────────────────────────────────────────

/** 사이트 id → 표시 이름(매니페스트가 단일 진실원) */
const SITE_LABELS = Object.fromEntries(
  manifest.SITES.map((site) => [site.id, site.label]),
);

const truncate = (text, limit) =>
  text.length > limit ? `${text.slice(0, limit)}…` : text;

function buildReport(
  results,
  { startedAt, exitCode, libraryVersion, durationMs, runUrl, retry },
) {
  const groupBySite = new Map();
  for (const result of results) {
    if (!groupBySite.has(result.site)) {
      groupBySite.set(result.site, []);
    }
    groupBySite.get(result.site).push(result);
  }

  const sites = [...groupBySite.entries()].map(([id, checks]) => {
    const status = checks.some((check) => check.status === 'drift')
      ? 'drift'
      : checks.some((check) => check.status === 'error')
        ? 'error'
        : 'ok';
    return {
      id,
      label: SITE_LABELS[id] ?? id,
      status,
      checks: checks.map((check) => ({
        id: check.id,
        label: check.label,
        status: check.status,
        detail: truncate(check.detail, 500),
        ms: check.ms,
        // 일시 장애 재점검으로 판정이 바뀌었는지(리포트에서 "(재점검)"으로 보인다)
        retried: check.retried === true,
        previousStatus: check.previousStatus ?? null,
      })),
    };
  });

  const counts = {
    checks: results.length,
    ok: results.filter((result) => result.status === 'ok').length,
    drift: results.filter((result) => result.status === 'drift').length,
    inconclusive: results.filter((result) => result.status === 'error').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
  };

  return {
    checkedAt: startedAt.toISOString(),
    // 알림 스크립트가 KST를 다시 계산하지 않도록 미리 넣어 둔다(대상 사이트가 국내 시스템).
    checkedAtKst: toKstString(startedAt.toISOString()),
    runUrl: runUrl ?? null,
    durationMs: durationMs ?? 0,
    libraryVersion: libraryVersion ?? null,
    exitCode: exitCode ?? (counts.drift > 0 ? 1 : counts.inconclusive > 0 ? 2 : 0),
    summary: counts,
    // 확인 불가가 남아 지연 후 다시 점검한 기록(없으면 attempts=0)
    retry: retry ?? emptyRetry(null),
    sites,
    drift: results
      .filter((result) => result.status === 'drift')
      .map((result) => ({
        site: result.site,
        id: result.id,
        label: result.label,
        detail: truncate(result.detail, 500),
      })),
    inconclusive: results
      .filter((result) => result.status === 'error')
      .map((result) => ({
        site: result.site,
        id: result.id,
        label: result.label,
        detail: truncate(result.detail, 500),
      })),
  };
}

const STATUS_ICON = {
  ok: '✅',
  drift: '❌',
  error: '⚠️',
  skipped: '⏭️',
};

/** 상태 값(JSON·코드) → 사람에게 보이는 라벨(계약 관점으로 읽히게 한다) */
const STATUS_LABEL = {
  ok: '계약 유지',
  drift: '계약 위반',
  error: '확인 불가',
  skipped: '건너뜀',
};

/** 점검 시각을 KST로도 보여준다(대상 사이트가 국내 시스템) */
function toKstString(isoString) {
  const kst = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 19).replace('T', ' ')} KST`;
}

function renderMarkdown(report, { title } = {}) {
  const { summary } = report;
  const lines = [];

  lines.push(`## ${title ?? '크롤러 계약 검증'} 결과`);
  lines.push('');
  lines.push(`- 점검 시각: \`${report.checkedAtKst}\``);
  lines.push(`- pal-crawl 버전: \`${report.libraryVersion ?? 'unknown'}\``);
  if (report.runUrl) {
    lines.push(`- 실행 로그: ${report.runUrl}`);
  }
  lines.push(
    `- 결과: ${
      summary.drift > 0
        ? `❌ **계약 위반 ${summary.drift}건** — 실사이트 응답이 파서의 기대와 다릅니다`
        : summary.inconclusive > 0
          ? `⚠️ 확인 불가 ${summary.inconclusive}건 (계약 위반 없음)`
          : '✅ 계약 유지 (파서가 기대하는 계약이 실사이트에 그대로 있음)'
    } — 점검 ${summary.checks}건 (계약 유지 ${summary.ok} · 확인 불가 ${summary.inconclusive} · 건너뜀 ${summary.skipped})`,
  );
  const retry = report.retry ?? emptyRetry(null);
  if (retry.attempts > 0) {
    lines.push(
      `- 재점검: 확인 불가 항목을 지연 ${retry.delayMs}ms 두고 ${retry.attempts}회 다시 점검 — 판정 변경 ${retry.recovered.length}건`,
    );
  }
  lines.push('');

  for (const site of report.sites) {
    lines.push(`### ${STATUS_ICON[site.status] ?? ''} ${site.label}`);
    lines.push('');
    lines.push('| 점검 | 결과 | 비고 |');
    lines.push('|------|------|------|');
    for (const check of site.checks) {
      const retryNote = check.previousStatus
        ? ` · 재점검에서 판정 변경(${STATUS_LABEL[check.previousStatus] ?? check.previousStatus} → ${STATUS_LABEL[check.status] ?? check.status})`
        : check.retried
          ? ' · 재점검함'
          : '';
      lines.push(
        `| \`${check.id}\` ${check.label} | ${STATUS_ICON[check.status] ?? ''} ${STATUS_LABEL[check.status] ?? check.status} | ${check.detail.replace(/\|/g, '\\|')}${retryNote} |`,
      );
    }
    lines.push('');
  }

  if (retry.recovered.length > 0) {
    lines.push('### 재점검에서 판정이 바뀐 항목 (일시 장애 회복)');
    lines.push('');
    for (const item of retry.recovered) {
      lines.push(
        `- **\`${item.id}\`**: ${STATUS_LABEL[item.from] ?? item.from} → ${STATUS_LABEL[item.to] ?? item.to}`,
      );
    }
    lines.push('');
  }

  if (report.drift.length > 0) {
    lines.push('### 계약 위반 상세 — 사이트 응답이 코드의 기대와 다름');
    lines.push('');
    for (const item of report.drift) {
      lines.push(`- **${item.site} / ${item.id}** (${item.label}): ${item.detail}`);
    }
    lines.push('');
    lines.push('#### 다음 조치');
    lines.push('');
    lines.push('1. 대상 사이트를 브라우저로 열어 위 항목의 선택자·엔드포인트·응답 필드를 확인한다.');
    lines.push('2. DOM/엔드포인트 변화가 확정되면 `agent_memories/site-notes/`에 기록한다(형식: `agent_memories/README.md`).');
    lines.push('3. 파서·크롤러를 수정하고 `scripts/drift-contracts/`의 계약도 같은 PR에서 고친다(선택자·엔드포인트·필드 형식).');
    lines.push('4. `src/*.test.ts` fixture를 실제 캡처로 갱신한다 — 파서 변경은 fixture 테스트를 먼저 깨뜨려 회귀를 잡는 것이 규약이다.');
    lines.push('5. `npm run drift:contracts`와 이 워크플로를 수동 실행(`workflow_dispatch`)해 계약이 복구됐는지 확인한다.');
    lines.push('');
  }

  if (report.inconclusive.length > 0) {
    lines.push('### 확인 불가 (사이트 변경인지 일시 장애인지 단정 못 함)');
    lines.push('');
    for (const item of report.inconclusive) {
      lines.push(`- **${item.site} / ${item.id}**: ${item.detail}`);
    }
    lines.push('');
    lines.push(
      '타임아웃·연결 실패는 사이트 점검 시간대의 일시 장애일 수 있다. 다음 정기 점검에서 반복되면 조사한다.',
    );
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

// ─── 실행 ────────────────────────────────────────────────────────────────────

async function runLive(options, lib) {
  const sites = createSites(lib, REQUEST_CONFIG, options.sites);
  if (sites.length === 0) {
    throw new Error(
      `점검할 사이트가 없습니다: ${options.sites.join(', ')} (사용 가능: ${SITE_IDS})`,
    );
  }

  const checker = new Checker(options.delay);

  for (const site of sites) {
    console.log(`\n── ${site.label}`);
    await checker.runSite(site);
    for (const result of checker.results.filter(
      (entry) => entry.site === site.id,
    )) {
      const icon = STATUS_ICON[result.status] ?? '';
      console.log(
        `  ${icon} [${STATUS_LABEL[result.status] ?? result.status}] ${result.id} — ${result.detail} (${result.ms}ms)`,
      );
    }
  }

  return { checker, sites };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(messageOf(error));
    console.error(`\n${HELP}`);
    process.exit(2);
    return;
  }

  if (options.help) {
    console.log(HELP);
    return;
  }

  if (options.selfTest) {
    const failures = await runSelfTest();
    process.exit(failures > 0 ? 1 : 0);
    return;
  }

  if (options.contracts) {
    const failures = verifyContracts({
      knownFlows: Object.keys(FLOWS),
      knownExtras: Object.keys(EXTRAS),
    });
    process.exit(failures > 0 ? 1 : 0);
    return;
  }

  if (options.offline) {
    console.log('--offline: 실사이트 점검을 건너뜁니다.');
    return;
  }

  if (!fs.existsSync(DIST_ENTRY)) {
    console.error(
      `dist/index.js가 없습니다: ${DIST_ENTRY}\n먼저 \`npm run build\`를 실행하세요.`,
    );
    process.exit(2);
    return;
  }

  const lib = require(DIST_ENTRY);
  const libraryVersion = JSON.parse(
    fs.readFileSync(PACKAGE_JSON, 'utf8'),
  ).version;

  const startedAt = new Date();
  console.log('pal-crawl 크롤러 계약 검증 — 실사이트 응답을 파서의 계약과 대조');
  console.log(`  entry: ${DIST_ENTRY} (pal-crawl ${libraryVersion})`);
  console.log(
    `  계약: scripts/drift-contracts (사이트 ${manifest.SITES.length}곳 · 점검 ${
      manifest.SITES.reduce((total, site) => total + site.checks.length, 0)
    }건)`,
  );

  const runUrl =
    process.env.GITHUB_SERVER_URL &&
    process.env.GITHUB_REPOSITORY &&
    process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null;

  let live;
  try {
    live = await runLive(options, lib);
  } catch (error) {
    // 사이트 지정 오류 등 시작 단계 실패 — 리포트를 만들 수 없으므로 확인 불가(2)로 끝낸다.
    console.error(messageOf(error));
    process.exit(2);
    return;
  }

  const { checker, sites } = live;

  // 일시 장애(확인 불가)는 지연 후 재점검한다 — 드리프트가 이미 있으면 실패가 확정이므로
  // 사이트 부하를 늘리지 않도록 재점검하지 않는다.
  let retry = emptyRetry(options.retryDelay);
  if (options.retry > 0 && checker.exitCode === 2) {
    retry = await retryInconclusive(checker, sites, {
      attempts: options.retry,
      delayMs: options.retryDelay,
    });
    if (retry.attempts > 0) {
      console.log(
        `  재점검 결과: 판정 변경 ${retry.recovered.length}건 · 남은 확인 불가 ${checker.counts.inconclusive}건`,
      );
    }
  }

  const report = buildReport(checker.results, {
    startedAt,
    exitCode: checker.exitCode,
    libraryVersion,
    durationMs: Date.now() - startedAt.getTime(),
    runUrl,
    retry,
  });

  if (options.markdown) {
    fs.mkdirSync(path.dirname(path.resolve(options.markdown)), {
      recursive: true,
    });
    fs.writeFileSync(
      options.markdown,
      renderMarkdown(report, { title: '크롤러 계약 검증' }),
      'utf8',
    );
    console.log(`\nMarkdown 리포트: ${options.markdown}`);
  }

  if (options.json) {
    fs.mkdirSync(path.dirname(path.resolve(options.json)), { recursive: true });
    fs.writeFileSync(options.json, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`JSON 리포트: ${options.json}`);
  }

  const { summary } = report;
  console.log(
    `\n점검 ${summary.checks}건 · 계약 유지 ${summary.ok} · 계약 위반 ${summary.drift} · 확인 불가 ${summary.inconclusive} · 건너뜀 ${summary.skipped}`,
  );
  if (report.retry.attempts > 0) {
    console.log(
      `재점검 ${report.retry.attempts}회 (대기 ${report.retry.delayMs}ms · ${report.retry.sites.join(', ')}) — 판정 변경 ${report.retry.recovered.length}건`,
    );
  }
  console.log(
    report.exitCode === 0
      ? '결과: 계약 유지 ✅ (크롤러 계약이 실사이트에서 그대로입니다)'
      : report.exitCode === 1
        ? '결과: 계약 위반 ❌ (실사이트 응답이 계약과 다름 — 파서·계약 확인 필요)'
        : '결과: 확인 불가 ⚠️ (네트워크/타임아웃 — 계약 위반 여부 미확정)',
  );

  process.exit(report.exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
