'use strict';

/**
 * 국회입법예고(pal.assembly.go.kr) 계약 매니페스트 — PalCrawl / PalParser.
 *
 * 이 파일은 **데이터만** 담는다(점검 실행 코드는 `scripts/check-site-drift.js`).
 * 파서·크롤러를 고치면 여기 계약도 같은 PR에서 고친다 — `usedBy`가 적힌 항목은
 * `npm run drift:contracts`가 그 소스 파일에 문자열이 실재하는지 확인하므로,
 * 한쪽만 고치면 게이트에서 걸린다.
 *
 * 표기 규약(전 사이트 공통, 자세한 설명은 `scripts/drift-contracts/README.md`):
 *   endpoints  사이트 엔드포인트(설정 상수 이름·메서드·파라미터)
 *   dom        파서가 의존하는 선택자. `live: false`는 사이트에 없을 수 있어
 *              실사이트 단언에서 뺀다(제거용·조건부 선택자)
 *   fields     파싱 결과에 기대하는 값(path / filled / pattern / min / template …)
 *   relations  값 사이의 관계식(예: 페이지 수 = ceil(총계 / 50))
 *   summary    리포트에 남길 한 줄 요약 템플릿
 */

module.exports = {
  id: 'pal',
  label: '국회입법예고 (pal.assembly.go.kr)',

  // 이 사이트 계약이 구현된 소스 — 새 계약을 추가하면 여기 파일들에서 문자열을 찾는다.
  sourceFiles: ['src/pal.ts', 'src/parser.ts', 'src/config.ts'],

  endpoints: {
    list: {
      config: 'LIST_URL',
      method: 'GET',
      params: [
        'pageIndex',
        'pageUnit',
        'committeeId',
        'billName',
        'represent',
        'proposers',
        'ppslRsonMnCn',
        'sortCol',
        'sortGbn',
        'fromAge',
        'toAge',
        'billNo',
      ],
      usedBy: 'src/pal.ts',
    },
    content: {
      config: 'CONTENT_URL',
      method: 'GET',
      // 사이트는 `lgsltPaId`를 받지만 표기가 바뀐 링크가 있어 두 이름을 모두 보낸다.
      params: ['lgsltPaId', 'lgsltPaid'],
      usedBy: 'src/pal.ts',
    },
  },

  checks: [
    {
      id: 'pal/list-dom',
      label: '목록 테이블·제목 앵커(parseTable 선택자)',
      kind: 'dom',
      endpoint: 'list',
      fetch: { op: 'pal.list', bind: 'palHtml' },
      dom: [
        {
          selector: 'table > tbody > tr',
          usedBy: 'src/parser.ts',
          note: '법률안 목록 행',
        },
        {
          selector: 'td.td_block > a.board_subject',
          usedBy: 'src/parser.ts',
          note: '의안명 앵커(제목·상세 링크·contentId)',
        },
        {
          selector: 'td:nth-child(1)',
          usedBy: 'src/parser.ts',
          note: '목록 번호(num) 열 — 열 순서가 바뀌면 파싱이 어긋난다',
        },
        {
          selector: 'td:nth-child(3)',
          usedBy: 'src/parser.ts',
          note: '제안자 구분 열',
        },
        {
          selector: 'td:nth-child(4)',
          usedBy: 'src/parser.ts',
          note: '소관위 열',
        },
        {
          selector: 'td:nth-child(6) > a:nth-child(2)',
          usedBy: 'src/parser.ts',
          note: '첨부(hwp) 링크 — 첨부가 있는 행에만 있다',
        },
        {
          selector: 'td:nth-child(6) > a:nth-child(3)',
          usedBy: 'src/parser.ts',
          note: '첨부(pdf) 링크 — 첨부가 있는 행에만 있다',
        },
        {
          selector: 'td:nth-child(8)',
          usedBy: 'src/parser.ts',
          note: '조회수 열',
        },
      ],
    },

    {
      id: 'pal/list-parse',
      label: '목록 파싱(건수 표시·contentId·상세 링크)',
      kind: 'parse',
      parse: { op: 'pal.list.parse', from: 'palHtml', bind: 'palList' },
      dependsOn: ['pal/list-dom'],
      fields: [
        { path: 'items.length', min: 1, label: '법률안 행' },
        { path: 'total', min: 1, label: '총 건수(span "건 (n/m 페이지)")' },
        { path: 'totalPages', min: 1, label: '전체 페이지 수' },
        { path: 'currentPage', equals: 1, label: '현재 페이지' },
        { path: 'items[0].subject', filled: true, label: '의안명' },
        { path: 'items[0].contentId', pattern: '^PRC_', label: 'contentId' },
        {
          path: 'items[0].link',
          linkPrefix: 'DOMAIN',
          label: '상세 링크',
        },
        { path: 'items[0].num', min: 1, label: '목록 번호' },
      ],
      summary: 'total={total} · items={items.length} · 첫 건 {items[0].contentId}',
    },

    {
      id: 'pal/list-paging',
      label: '페이지 이동(pageIndex·currentPage)',
      kind: 'parse',
      endpoint: 'list',
      fetch: { op: 'pal.search2', bind: 'palPage2' },
      dependsOn: ['pal/list-parse'],
      fields: [
        { path: 'items.length', min: 1, label: '2페이지 행' },
        { path: 'currentPage', equals: 2, label: '2페이지 currentPage' },
        {
          path: 'items[0].contentId',
          notEqualsPath: 'palList.items[0].contentId',
          label: '2페이지 첫 건',
        },
      ],
      summary: '2페이지 첫 건 {items[0].contentId}',
    },

    {
      id: 'pal/detail-dom',
      label: '상세 페이지 DOM(제목·기본정보 테이블·섹션)',
      kind: 'dom',
      endpoint: 'content',
      fetch: {
        op: 'pal.detail',
        from: 'palList.items[0]',
        bind: 'palDetailHtml',
      },
      dependsOn: ['pal/list-parse'],
      dom: [
        {
          selector: '.legislation-heading h3',
          usedBy: 'src/parser.ts',
          note: '제목·의안번호',
        },
        {
          // 합성 선택자 — 파서는 `.board-added table` + `thead th`로 찾는다
          selector: '.board-added table thead th',
          note: '기본정보 표 헤더',
        },
        {
          selector: '.board-added table tbody > tr td',
          note: '기본정보 값 셀(제안일·소관위·예고기간)',
        },
        {
          selector: '.board-added table',
          usedBy: 'src/parser.ts',
          note: '기본정보 표',
        },
        {
          // 합성 선택자 — 파서는 `.card-wrap .item` + `h4`로 찾는다
          selector: '.card-wrap .item h4',
          note: '본문 섹션 제목(제안이유 등)',
        },
        {
          selector: '.card-wrap .item',
          usedBy: 'src/parser.ts',
          note: '본문 섹션 묶음',
        },
        {
          selector: '.desc',
          usedBy: 'src/parser.ts',
          live: false,
          note: '섹션 본문 — 본문이 없는 의안에는 없다',
        },
        {
          selector: 'span.a11y_hidden',
          usedBy: 'src/parser.ts',
          live: false,
          note: '첨부 버튼에서 제거하는 숨김 텍스트',
        },
        {
          selector: 'a.btn_sm',
          usedBy: 'src/parser.ts',
          live: false,
          note: '복제한 셀에서 제거하는 버튼 앵커',
        },
        {
          selector: '.m_subject, script, style',
          usedBy: 'src/parser.ts',
          live: false,
          note: '복제한 셀에서 제거하는 요소(제목 중복·스크립트)',
        },
      ],
      // 본문 섹션 제목 인벤토리 — 리포트에 섹션 구성이 남아 리뷰가 쉬워진다.
      inventory: { label: '섹션', selector: '.card-wrap .item h4' },
    },

    {
      id: 'pal/detail-parse',
      label: '상세 파싱(의안번호·제안일·소관위·예고기간)',
      kind: 'parse',
      parse: { op: 'pal.detail.parse', from: 'palDetailHtml', bind: 'palContent' },
      dependsOn: ['pal/detail-dom'],
      fields: [
        { path: 'title', filled: true, label: '의안명' },
        { path: 'billNumber', pattern: '^\\d+$', label: '의안번호' },
        {
          path: 'proposalDate',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          label: '제안일',
        },
        { path: 'committee', filled: true, label: '소관위원회' },
        {
          path: 'noticePeriod',
          pattern: '^\\d{4}-\\d{2}-\\d{2}\\s*~\\s*\\d{4}-\\d{2}-\\d{2}$',
          label: '입법예고기간',
        },
      ],
      extra: 'pal.reasonConsistency',
      summary: '의안번호 {billNumber} · 제안일 {proposalDate}',
    },

    {
      id: 'pal/gate-probe',
      label: '게이트 차단 검증용 임시 계약(실사이트에 없는 선택자)',
      kind: 'dom',
      endpoint: 'list',
      fetch: { op: 'pal.list', bind: 'palHtml' },
      dom: [
        {
          selector: '#drift-gate-probe-does-not-exist',
          note: '임시 — 차단 검증 후 제거',
        },
      ],
    },
  ],
};
