'use strict';

/**
 * 국회 의안정보시스템(likms.assembly.go.kr) 계약 매니페스트 —
 * LikmsStateCrawler / LikmsCrawler / LikmsStateParser / LikmsDetailParser.
 *
 * 표기 규약은 `scripts/drift-contracts/README.md` 참조. 이 사이트의 특징:
 * - 목록·상세는 **AJAX 조각**(HTML 조각 또는 JSON)이라 명령형 흐름이 필요하다.
 *   (세션 → CSRF → POST) 이런 점검은 `kind: 'flow'`로 두고, 어떤 값·필드를 기대하는지는
 *   여기 데이터로 남긴다 — 흐름 코드는 `scripts/check-site-drift.js`에 있다.
 * - 목록 조각의 페이지 수는 응답 메타(`#pager_count_text`·`#pager_pages_text`)에서 읽고,
 *   `totalPages === ceil(total / rows)` 관계가 성립해야 한다.
 * - `comCd`처럼 코드가 아닌 센티넬(`N999999` = 미확정)이 섞이는 자리가 있어
 *   "빈 값"만 계약 위반으로 본다.
 */

/** 계류의안 목록의 기본 페이지 크기(사이트 기본값) — 페이지 수 관계식의 근거 */
const LIKMS_PAGE_SIZE = 50;

module.exports = {
  id: 'likms',
  label: '국회 의안정보시스템 (likms.assembly.go.kr)',

  sourceFiles: ['src/likms.ts', 'src/parser.ts', 'src/config.ts'],

  /** 목록·상세 흐름이 기대하는 페이지 크기(관계식·필터 점검에서 함께 쓴다) */
  pageSize: LIKMS_PAGE_SIZE,

  endpoints: {
    statePage: {
      config: 'LIKMS_STATE_PAGE_URL',
      method: 'GET',
      params: ['stateId'],
      usedBy: 'src/likms.ts',
    },
    stateSearch: {
      config: 'LIKMS_STATE_SEARCH_URL',
      method: 'POST',
      // 브라우저가 폼을 직렬화해 보내는 값 + 검색 조건. 서버는 이 중 일부만으로는
      // 조건을 적용하지 않는다(예: 발의자 이름은 해석하지 않음).
      params: [
        'page',
        'stateId',
        'stateDtlDivCd',
        'rows',
        'billNm',
        'billNo',
        'representKindCd',
        'proposerKind',
        'representId',
        'ageCmtId',
        'cmtResultCd',
        'jntPrpslYn',
        'ageFrom',
        'ageTo',
        'billKind',
        'listOrd',
        'ordCd',
        'fromPropDt',
        'toPropDt',
        'nmReSchText',
      ],
      // Spring Security CSRF 헤더(값은 Config에 있다)
      headers: { config: 'LIKMS_CSRF_HEADER' },
      usedBy: 'src/likms.ts',
    },
    detailPage: {
      config: 'LIKMS_DETAIL_PAGE_URL',
      method: 'GET',
      params: ['billId', 'currMenuNo'],
      usedBy: 'src/likms.ts',
    },
    billInfo: {
      config: 'LIKMS_BILL_INFO_URL',
      method: 'POST',
      // 본문은 상세 페이지 `#form`의 숨김 필드를 그대로 직렬화해 보낸다(하드코딩 아님).
      params: [],
      usedBy: 'src/likms.ts',
    },
    findBill: {
      config: 'LIKMS_FIND_BILL_URL',
      method: 'GET',
      params: ['billNo'],
      usedBy: 'src/likms.ts',
    },
    findAgeCmt: {
      config: 'LIKMS_FIND_AGE_CMT_URL',
      method: 'GET',
      // `ageFrom`/`ageTo`는 **둘 다** 줘야 범위가 적용된다(한쪽만 주면 무시됨).
      params: ['ageFrom', 'ageTo'],
      usedBy: 'src/likms.ts',
    },
    sameNamePopup: {
      config: 'LIKMS_SAME_NM_POPUP_URL',
      method: 'GET',
      // `ageFrom`/`ageTo`가 없으면 400이라 항상 보낸다.
      params: ['memName', 'ageFrom', 'ageTo', 'classId'],
      usedBy: 'src/likms.ts',
    },
  },

  /**
   * 사이트가 코드로 받는 검색 조건 — 값이 바뀌면 필터가 조용히 무시되거나 넓어진다.
   * 실사이트 점검에서 "결과가 실제로 좁아지는지"까지 확인한다.
   */
  filters: {
    pending: {
      param: 'cmtResultCd',
      value: 'PRC_0000',
      label: '소관위 처리결과=계류',
      usedBy: 'src/likms.ts',
    },
    committee: {
      param: 'ageCmtId',
      label: '소관위 코드(이름으로는 조회 불가)',
      usedBy: 'src/likms.ts',
    },
  },

  checks: [
    {
      id: 'likms/state-session',
      label: '세션·CSRF 확보(meta[name=_csrf] + #form 숨김 필드)',
      kind: 'dom',
      endpoint: 'statePage',
      fetch: { op: 'likms.statePage', bind: 'likmsStatePage' },
      dom: [
        {
          selector: 'meta[name="_csrf"]',
          usedBy: 'src/likms.ts',
          note: 'CSRF 토큰(없으면 ensureSession이 실패한다)',
        },
        {
          selector: '#form input[type="hidden"]',
          usedBy: 'src/likms.ts',
          note: '검색 AJAX 본문의 기본값이 되는 숨김 필드',
        },
      ],
      derive: {
        csrfToken: 'likms.csrfToken',
        params: 'likms.stateFormParams',
      },
      fields: [
        { path: 'csrfToken', filled: true, label: 'CSRF 토큰' },
        {
          path: 'params',
          requireKeys: ['stateId', 'stateDtlDivCd'],
          label: '#form 숨김 필드',
        },
      ],
      inventory: {
        label: '숨김 필드',
        selector: '#form input[type="hidden"]',
        attribute: 'name',
      },
      extra: 'likms.sessionSummary',
    },

    {
      id: 'likms/state-list-dom',
      label: '계류의안 목록 조각 DOM(AJAX POST 응답)',
      kind: 'dom',
      endpoint: 'stateSearch',
      fetch: { op: 'likms.stateList', bind: 'likmsListHtml' },
      dependsOn: ['likms/state-session'],
      dom: [
        {
          selector: '#state-list',
          usedBy: 'src/parser.ts',
          note: '목록 컨테이너(파서가 조각 여부를 판별하는 기준)',
        },
        {
          selector: '#state-list tbody tr',
          usedBy: 'src/parser.ts',
          note: '의안 행',
        },
        {
          selector: 'td.align_left a[data-bill-id]',
          usedBy: 'src/parser.ts',
          note: 'billId를 들고 있는 의안명 앵커',
        },
        { selector: 'td.billNo', usedBy: 'src/parser.ts', note: '의안번호 셀' },
        {
          selector: 'td.proposerKindName',
          usedBy: 'src/parser.ts',
          note: '발의구분 셀(대표발의자 추출에 쓴다)',
        },
        {
          selector: 'a[onclick*="openSummaryPopup"]',
          usedBy: 'src/parser.ts',
          note: '제안이유 팝업 링크 — 사라지면 hasProposalReason이 전부 false가 되어 보정 경로가 조용히 꺼진다',
        },
        {
          selector: 'td.procStageName',
          usedBy: 'src/parser.ts',
          note: '심사진행상태 셀',
        },
        {
          selector: 'td.proposeDt',
          usedBy: 'src/parser.ts',
          note: '제안일자 셀',
        },
        {
          selector: 'td.currCmt',
          usedBy: 'src/parser.ts',
          note: '소관위 셀',
        },
        {
          selector: '#pager_count_text',
          usedBy: 'src/parser.ts',
          note: '총 건수(숨김 input의 value)',
        },
        {
          selector: '#pager_pages_text',
          usedBy: 'src/parser.ts',
          note: '전체 페이지 수(숨김 input의 value)',
        },
      ],
    },

    {
      id: 'likms/state-list-parse',
      label: '목록 파싱(총계·페이지 수·billId·상세 링크)',
      kind: 'parse',
      parse: { op: 'likms.stateList.parse', from: 'likmsListHtml', bind: 'likmsList' },
      dependsOn: ['likms/state-list-dom'],
      fields: [
        { path: 'items.length', min: 1, label: '의안 행' },
        { path: 'total', min: 1, label: '총 건수(#pager_count_text)' },
        { path: 'totalPages', min: 1, label: '페이지 수(#pager_pages_text)' },
        { path: 'currentPage', equals: 1, label: '현재 페이지' },
        { path: 'items[].billId', pattern: '^PRC_', label: 'billId' },
        { path: 'items[].billNo', pattern: '^\\d+$', label: '의안번호' },
        { path: 'items[].billName', filled: true, label: '의안명' },
        { path: 'items[].progressStatus', filled: true, label: '심사진행상태' },
        { path: 'items[].proposerKind', filled: true, label: '제안자구분' },
        {
          path: 'items[].proposalDate',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          label: '제안일자',
        },
        // Pre-referral bills may fill the entire newest page (2026-10-29).
        // listCoverage requires each committee cell and compares its source
        // text with the parsed value; state-filters checks assigned committees.
        {
          path: 'items[0].link',
          label: '상세 링크',
          template:
            '{LIKMS_DOMAIN}{LIKMS_DETAIL_PAGE_URL}?billId={billId}',
          tokens: {
            LIKMS_DOMAIN: 'Config.LIKMS_DOMAIN',
            LIKMS_DETAIL_PAGE_URL: 'Config.LIKMS_DETAIL_PAGE_URL',
            billId: 'items[0].billId',
          },
        },
      ],
      relations: [
        {
          kind: 'ceilDivisor',
          of: 'total',
          divisor: LIKMS_PAGE_SIZE,
          target: 'totalPages',
          label: `페이지 수 = ceil(총계 / ${LIKMS_PAGE_SIZE})`,
        },
        {
          kind: 'pageSize',
          list: 'items',
          total: 'total',
          size: LIKMS_PAGE_SIZE,
          label: `rows=${LIKMS_PAGE_SIZE} 페이지 크기`,
        },
      ],
      extra: 'likms.listCoverage',
      summary: 'total={total} · pages={totalPages} · items={items.length}',
    },

    {
      id: 'likms/committees',
      label: '소관위 목록 JSON(findAgeCmt.do → comCd/comCdName)',
      kind: 'flow',
      flow: 'likms.committees',
      endpoint: 'findAgeCmt',
      dependsOn: ['likms/state-session'],
      fields: [
        { path: 'committees.length', min: 11, label: '22대 소관위' },
        { path: 'committees[].comCd', filled: true, label: '소관위 코드' },
        { path: 'committees[].comCdName', filled: true, label: '소관위 이름' },
        // 코드는 숫자지만 '미확정(N999999)' 센티넬도 함께 온다 — 숫자 코드가
        // 충분히 많은지로 JSON 필드 변경을 판별한다.
        { path: 'numericCodes', min: 11, label: '숫자 소관위 코드' },
        {
          path: 'target.comCdName',
          filled: true,
          label: '기준 위원회 이름',
        },
        { path: 'target.comCd', filled: true, label: '기준 위원회 코드' },
      ],
      extra: 'likms.committeeCodes',
      summary: '{committees.length}건 · 기준 {target.comCdName}={target.comCd}',
    },

    {
      id: 'likms/state-filters',
      label: '검색 필터가 실제로 결과를 좁힌다(cmtResultCd·ageCmtId)',
      kind: 'flow',
      flow: 'likms.stateFilters',
      endpoint: 'stateSearch',
      filters: ['pending', 'committee'],
      dependsOn: ['likms/state-list-parse', 'likms/committees'],
      fields: [
        {
          path: 'pendingOnly.total',
          min: 1,
          lessThanPath: 'all.total',
          label: '계류(PRC_0000) 총계',
        },
        {
          path: 'scoped.total',
          min: 1,
          lessThanPath: 'all.total',
          label: '소관위 필터 총계',
        },
        { path: 'committeesInPage.length', min: 1, label: '필터 결과 소관위' },
        {
          path: 'committeesInPage[]',
          equalsPath: 'committee.comCdName',
          label: '필터 결과 소관위',
        },
      ],
      summary:
        '전체 {all.total} · 계류 {pendingOnly.total} · {committee.comCdName} {scoped.total}',
    },

    {
      id: 'likms/detail-flow',
      label: '의안상세 2단계 흐름(#form → billInfo.do 조각)',
      kind: 'flow',
      flow: 'likms.detailFlow',
      endpoint: 'detailPage',
      dependsOn: ['likms/state-list-parse'],
      html: 'likmsDetailPageHtml',
      dom: [
        {
          selector: 'h3.detailh3',
          usedBy: 'src/parser.ts',
          note: '상세 제목(의안명)',
        },
        {
          selector: '#form input[type="hidden"]',
          usedBy: 'src/likms.ts',
          note: 'billInfo.do로 그대로 넘기는 숨김 필드',
        },
        {
          selector: '#form input[name="billNo"]',
          usedBy: 'src/parser.ts',
          note: '상세 페이지 폼의 의안번호 값',
        },
      ],
      fragment: 'likmsFragmentHtml',
      fragmentDom: [
        {
          selector: '#insc-rcp-row',
          usedBy: 'src/parser.ts',
          note: '접수정보 행(billInfo.do 조각)',
        },
        {
          selector: '#insc-rcp-row td.billNo',
          usedBy: 'src/parser.ts',
          note: '의안번호 셀',
        },
        {
          selector: '#insc-rcp-row td.proposeDt',
          usedBy: 'src/parser.ts',
          note: '제안일자 셀',
        },
        {
          selector: '#insc-rcp-row td.proposer',
          usedBy: 'src/parser.ts',
          note: '제안자 셀',
        },
        {
          selector: '#insc-rcp-row td.sessionTitle',
          usedBy: 'src/parser.ts',
          note: '제안회기 셀',
        },
        {
          selector: '#insc-rcp-row td.doc',
          usedBy: 'src/parser.ts',
          note: '문서(의안원문·첨부) 셀 — 링크는 아직 없을 수 있어 셀까지만 요구한다',
        },
        {
          selector: '#insc-rcp-row td.doc a',
          usedBy: 'src/parser.ts',
          live: false,
          note: '문서 링크 — 의안원문이 없는 건에는 없다',
        },
        {
          selector: '#prntSummary',
          usedBy: 'src/parser.ts',
          live: false,
          note: 'Conditional reason body; reasonConsistency requires it when advertised',
        },
        {
          selector: '#insc-rcp-row td.billNo span',
          usedBy: 'src/parser.ts',
          note: '의안번호 값(셀 텍스트가 아니라 안쪽 span)',
        },
        {
          selector: '#insc-rcp-row td.proposer span',
          usedBy: 'src/parser.ts',
          note: '제안자 값',
        },
        {
          selector: '#insc-rcp-row td.proposeDt span',
          usedBy: 'src/parser.ts',
          note: '제안일자 값',
        },
        {
          selector: '#insc-rcp-row td.sessionTitle span',
          usedBy: 'src/parser.ts',
          note: '제안회기 값',
        },
      ],
      from: 'likmsList.items[0]',
      inventory: {
        label: '숨김 필드',
        selector: '#form input[type="hidden"]',
        attribute: 'name',
      },
      fields: [
        {
          path: 'params',
          requireKeys: ['billId', 'billNo', 'billKindCd'],
          label: '#form 숨김 필드',
        },
        {
          path: 'params.billId',
          equalsPath: 'item.billId',
          label: '#form billId',
        },
        {
          path: 'params.billNo',
          equalsPath: 'item.billNo',
          label: '#form billNo',
        },
        {
          path: 'detail.billNo',
          equalsPath: 'item.billNo',
          label: '조각의 의안번호',
        },
        { path: 'detail.session', filled: true, label: '제안회기' },
        {
          path: 'detail.proposalDate',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          optional: true,
          label: '제안일자',
        },
      ],
      extra: 'likms.reasonConsistency',
      summary: 'billNo {detail.billNo} · 첨부 {detail.attachments.length}건',
    },

    {
      id: 'likms/candidates',
      label: '동명이인 후보 팝업(selSameNmMemb.do → membId·대수)',
      kind: 'flow',
      flow: 'likms.candidates',
      endpoint: 'sameNamePopup',
      dependsOn: ['likms/state-list-parse'],
      options: { maxNames: 3 },
      // 후보 팝업은 크롤러가 파싱 결과만 돌려줘 HTML을 붙들 수 없다 — 여기 선택자들은
      // 소스 대조(`usedBy`)만 하고 실사이트 단언은 파싱 결과 필드로 한다.
      dom: [
        {
          selector: '#data_sect tr',
          usedBy: 'src/parser.ts',
          live: false,
          note: '후보 팝업 표 행(데스크톱 레이아웃)',
        },
        {
          selector: '[data-mem-id]',
          usedBy: 'src/parser.ts',
          live: false,
          note: '의원 ID 속성',
        },
        {
          selector: 'ul.m_list li',
          usedBy: 'src/parser.ts',
          live: false,
          note: '모바일 후보 목록 항목',
        },
      ],
      fields: [
        { path: 'names.length', min: 1, label: '대표발의자 이름' },
        { path: 'candidates.length', min: 1, label: '후보' },
        { path: 'candidates[].membId', filled: true, label: 'membId' },
        { path: 'candidates[].age', pattern: '^\\d+대$', label: '대수 라벨' },
        { path: 'candidates[].party', filled: true, label: '정당명' },
        {
          path: 'candidates[].name',
          equalsPath: 'name',
          label: '후보 이름',
        },
      ],
      summary: '{name} → 후보 {candidates.length}명',
    },
  ],
};
