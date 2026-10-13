'use strict';

/**
 * 크롤러 **계약 매니페스트** 진입점.
 *
 * 대상 사이트 3곳 + 교차 점검이 기대하는 값을 **데이터로** 모아 둔 곳이다.
 * 실행기(`scripts/check-site-drift.js`)는 이 데이터를 읽어 실사이트와 대조하고,
 * `scripts/drift-contracts/verify.js`는 이 데이터와 `src/` 소스가 어긋나지
 * 않았는지 확인한다(`npm run drift:contracts`).
 *
 * 파서·크롤러를 고칠 때: 이 폴더의 해당 사이트 파일을 **같은 PR에서** 고친다.
 * 소스에만 고치고 계약을 두면 `drift:contracts`가 실패하고, 반대로 계약만 고치면
 * 실사이트 점검이 계약 위반으로 잡는다.
 */

const pal = require('./pal');
const nsm = require('./nsm');
const likms = require('./likms');
const bridge = require('./bridge');

/** 실행 순서 = 리포트에 나오는 순서(교차 점검은 사이트별 점검 뒤) */
const SITES = [pal, nsm, likms, bridge];

/**
 * 매니페스트 전체를 순회하며 점검 하나씩 돌려준다(사이트 컨텍스트 포함).
 * 실행기와 검증기가 같은 방식으로 순회하도록 여기서만 만든다.
 */
function* walkChecks() {
  for (const site of SITES) {
    for (const check of site.checks) {
      yield { site, check };
    }
  }
}

/** `usedBy`가 적힌 모든 문자열 계약(선택자·설정 상수·파라미터 이름) */
function* walkLiterals() {
  for (const site of SITES) {
    for (const [name, endpoint] of Object.entries(site.endpoints ?? {})) {
      yield {
        site,
        kind: 'endpoint',
        name,
        value: endpoint.config,
        file: 'src/config.ts',
        note: `설정 상수 ${endpoint.config}`,
      };
      for (const param of endpoint.params ?? []) {
        yield {
          site,
          kind: 'endpoint-param',
          name: `${name}.${param}`,
          value: param,
          file: endpoint.usedBy,
          note: `요청 파라미터 ${param}`,
        };
      }
      if (endpoint.headers?.config) {
        yield {
          site,
          kind: 'endpoint-header',
          name: `${name}.${endpoint.headers.config}`,
          value: endpoint.headers.config,
          file: 'src/config.ts',
          note: `헤더 상수 ${endpoint.headers.config}`,
        };
      }
      if (endpoint.pathSuffix) {
        // '/{billNo}/detailRP' → 'detailRP' (가변 부분은 제외하고 고정 조각만 본다)
        for (const literal of endpoint.pathSuffix.split('/')) {
          if (literal === '' || literal.startsWith('{')) {
            continue;
          }
          yield {
            site,
            kind: 'endpoint-path',
            name: `${name}${endpoint.pathSuffix}`,
            value: literal,
            file: endpoint.usedBy,
            note: `경로 조각 ${literal}`,
          };
        }
      }
    }

    for (const [name, filter] of Object.entries(site.filters ?? {})) {
      yield {
        site,
        kind: 'filter-param',
        name: `${site.id}.${name}`,
        value: filter.param,
        file: filter.usedBy,
        note: `필터 파라미터 ${filter.param}`,
      };
      if (filter.value !== undefined) {
        yield {
          site,
          kind: 'filter-value',
          name: `${site.id}.${name}`,
          value: filter.value,
          file: filter.usedBy,
          note: `필터 값 ${filter.param}=${filter.value}`,
        };
      }
    }

    for (const group of ['dom', 'fragmentDom']) {
      for (const entry of collectDomEntries(site, group)) {
        yield {
          site,
          kind: 'selector',
          name: `${entry.checkId}: ${entry.selector}`,
          value: entry.selector,
          file: entry.usedBy,
          note: entry.note,
        };
      }
    }
  }
}

/** `dom`/`fragmentDom` 항목에 소유 점검 id를 붙여 돌려준다 */
function collectDomEntries(site, group) {
  const entries = [];
  for (const check of site.checks) {
    for (const entry of check[group] ?? []) {
      entries.push({ ...entry, group, checkId: check.id });
    }
  }
  return entries;
}

/** 실사이트에서 단언하는 선택자 목록(점검 id별) */
function liveSelectorsOf(check, group = 'dom') {
  return (check[group] ?? [])
    .filter((entry) => entry.live !== false)
    .map((entry) => entry.selector);
}

module.exports = {
  SITES,
  walkChecks,
  walkLiterals,
  collectDomEntries,
  liveSelectorsOf,
};
