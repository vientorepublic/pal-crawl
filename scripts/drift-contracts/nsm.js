'use strict';

/**
 * 국민참여입법센터(opinion.lawmaking.go.kr) 계약 매니페스트 — NsmLmSts / NsmLmStsParser.
 *
 * 표기 규약은 `scripts/drift-contracts/README.md` 참조. 이 사이트의 특징:
 * - 목록 테이블은 모바일 대응으로 셀마다 `data-th`(컬럼 한글명)를 달고 있고,
 *   파서는 인덱스가 아니라 **그 값으로 컬럼을 찾는다**(컬럼 순서 변경에 강함).
 * - 셀 안쪽 `<p>`는 값이 있을 때만 나온다(위원회 회부 전이면 빈 셀) — 그래서
 *   `p` 존재 여부는 계약이 아니다.
 */

module.exports = {
  id: 'nsm',
  label: '국민참여입법센터 (opinion.lawmaking.go.kr)',

  sourceFiles: ['src/pal.ts', 'src/parser.ts', 'src/config.ts'],

  endpoints: {
    list: {
      config: 'NSM_LIST_URL',
      method: 'GET',
      params: [
        'pageIndex',
        'pageSize',
        'sugCd',
        'endSugCd',
        'sgtCls',
        'cptOfiOrgCd',
        'rslRsltNmL',
        'rslRsltNmR',
        'scCptPpostCmt',
        'searchStDtNew',
        'searchEdDtNew',
        'scPpsUsr',
        'issLawitmYn',
        'stDt',
        'edDt',
        'sortCol',
        'sortOrder',
        'scBlNm',
        'scBlNmSct',
      ],
      usedBy: 'src/pal.ts',
    },
    detail: {
      config: 'NSM_LIST_URL',
      method: 'GET',
      // `{NSM_LIST_URL}/{의안번호}/detailRP`
      pathSuffix: '/{billNo}/detailRP',
      usedBy: 'src/pal.ts',
    },
  },

  /**
   * 사이트가 코드로 받는 검색 조건 — `rslRsltNmL=900101`은 '발의' 상태를 뜻한다.
   * 값이 바뀌면 필터가 조용히 넓어지므로, 실사이트 점검에서 결과의 상태를 확인한다.
   */
  filters: {
    pending: {
      param: 'rslRsltNmL',
      value: '900101',
      expectedStatus: '발의',
      usedBy: 'src/pal.ts',
    },
  },

  checks: [
    {
      id: 'nsm/list-dom',
      label: '목록 DOM(건수·셀 data-th 앵커)',
      kind: 'dom',
      endpoint: 'list',
      fetch: { op: 'nsm.list', bind: 'nsmHtml' },
      dom: [
        {
          selector: 'p.numBuild',
          usedBy: 'src/parser.ts',
          note: '총 건수·페이지 수 표시',
        },
        {
          selector: 'table tbody tr',
          usedBy: 'src/parser.ts',
          note: '법안 목록 행',
        },
        {
          selector: 'td[data-th="의안명"]',
          usedBy: 'src/parser.ts',
          note: '의안명 셀 — 파서는 인덱스가 아니라 이 data-th 값으로 찾는다',
        },
        {
          selector: 'td[data-th="의안명"] a',
          note: '의안명 앵커(제목·상세 링크·의안번호)',
        },
        {
          selector: 'td[data-th="제안자(제안일자)"]',
          usedBy: 'src/parser.ts',
          note: '제안자·제안일자 셀',
        },
        {
          selector: 'td[data-th="상임위원회(소관부처)"]',
          usedBy: 'src/parser.ts',
          note: '소관위 셀(회부 전이면 빈 셀)',
        },
        {
          selector: 'td[data-th="국회현황(추진일자)"]',
          usedBy: 'src/parser.ts',
          note: '진행 상태 셀',
        },
        {
          selector: 'td[data-th="의결현황(의결일자)"]',
          usedBy: 'src/parser.ts',
          note: '의결 현황 셀',
        },
      ],
      // 컬럼 한글명 인벤토리 — 파서가 data-th로 컬럼을 찾는 근거라 이름이 바뀌면 위험하다.
      inventory: {
        label: '컬럼',
        selector: 'table tbody tr:first-child td[data-th]',
        attribute: 'data-th',
      },
    },

    {
      id: 'nsm/list-parse',
      label: '목록 파싱(건수·의안번호·상세 링크·제안일자)',
      kind: 'parse',
      parse: { op: 'nsm.list.parse', from: 'nsmHtml', bind: 'nsmList' },
      dependsOn: ['nsm/list-dom'],
      fields: [
        { path: 'items.length', min: 1, label: '법안 행' },
        { path: 'total', min: 1, label: '총 건수(p.numBuild)' },
        { path: 'totalPages', min: 1, label: '전체 페이지 수' },
        { path: 'currentPage', equals: 1, label: '현재 페이지' },
        { path: 'items[0].billName', filled: true, label: '의안명' },
        { path: 'items[0].billNo', pattern: '^\\d+$', label: '의안번호' },
        {
          path: 'items[0].link',
          label: '상세 링크',
          template: '{NSM_DOMAIN}{NSM_LIST_URL}/{billNo}/detailRP',
          tokens: {
            NSM_DOMAIN: 'Config.NSM_DOMAIN',
            NSM_LIST_URL: 'Config.NSM_LIST_URL',
            billNo: 'items[0].billNo',
          },
        },
        {
          path: 'items[0].proposalDate',
          pattern: '^\\d{4}\\.\\s*\\d{1,2}\\.\\s*\\d{1,2}\\.',
          label: '제안일자',
        },
        { path: 'items[0].proposer', filled: true, label: '제안자' },
        { path: 'items[0].progressStatus', filled: true, label: '국회현황' },
      ],
      summary:
        'total={total} · items={items.length} · 첫 건 {items[0].billNo}({items[0].progressStatus})',
    },

    {
      id: 'nsm/pending-filter',
      label: '발의 상태 필터(rslRsltNmL=900101 → "발의")',
      kind: 'parse',
      fetch: { op: 'nsm.pending', bind: 'nsmPending' },
      filter: 'pending',
      fields: [
        { path: 'items.length', min: 1, label: '발의 상태 법안 행' },
        {
          path: 'items[0].progressStatus',
          equals: '발의',
          label: '필터 결과 상태',
        },
      ],
      summary:
        'total={total} · 첫 건 {items[0].billNo}({items[0].progressStatus})',
    },

    {
      id: 'nsm/detail-dom',
      label: '상세 페이지 DOM(제목·발의정보·제안이유)',
      kind: 'dom',
      endpoint: 'detail',
      fetch: {
        op: 'nsm.detail',
        from: 'nsmList.items[0]',
        bind: 'nsmDetailHtml',
      },
      dependsOn: ['nsm/list-parse'],
      dom: [
        { selector: 'h2', usedBy: 'src/parser.ts', note: '의안명 제목' },
        { selector: 'table th', note: '항목 헤더 셀' },
        { selector: 'table td', note: '항목 값 셀' },
        {
          selector: 'button[onclick*="fnDownload"]',
          usedBy: 'src/parser.ts',
          live: false,
          note: '의안원문·첨부 다운로드 버튼 — 문서가 아직 없으면 없다',
        },
        {
          selector: 'span.a11y_hidden',
          usedBy: 'src/parser.ts',
          live: false,
          note: '버튼에서 제거하는 숨김 텍스트',
        },
        {
          selector: 'pre',
          usedBy: 'src/parser.ts',
          live: false,
          note: 'Reason body may be an empty pre; reasonConsistency checks cell text',
        },
      ],
      // 상세 페이지 표의 헤더 — "발의정보"가 사라지면 제안자·제안일 파싱이 빈다.
      // "제안이유"는 의안에 따라 섹션이 없을 수 있어 요구하지 않는다(인벤토리에만 남긴다).
      headers: { require: ['발의정보'], optional: ['제안이유'] },
    },

    {
      id: 'nsm/detail-parse',
      label: '상세 파싱(의안번호·제안자·제안회기·첨부)',
      kind: 'parse',
      parse: { op: 'nsm.detail.parse', from: 'nsmDetailHtml', bind: 'nsmDetail' },
      dependsOn: ['nsm/detail-dom'],
      fields: [
        { path: 'title', filled: true, label: '의안명' },
        {
          path: 'billNo',
          equalsPath: 'nsmList.items[0].billNo',
          label: '의안번호',
        },
        { path: 'proposalInfo', pattern: '제\\d+호', label: '발의정보' },
        { path: 'proposer', filled: true, label: '제안자' },
        { path: 'session', filled: true, label: '제안회기' },
        { path: 'attachments[].fileId', pattern: '^\\d+$', label: '첨부 ID' },
        { path: 'attachments[].filename', filled: true, label: '첨부 파일명' },
      ],
      extra: 'nsm.reasonConsistency',
      summary:
        '제안자 {proposer} · 회기 {session} · 첨부 {attachments.length}건',
    },
  ],
};
