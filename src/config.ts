export enum Config {
  DOMAIN = 'https://pal.assembly.go.kr',
  LIST_URL = '/napal/lgsltpa/lgsltpaOngoing/list.do',
  CONTENT_URL = '/napal/lgsltpa/lgsltpaOngoing/view.do',
  DONE_LIST_URL = '/napal/lgsltpa/lgsltpaDone/list.do',
  DONE_CONTENT_URL = '/napal/lgsltpa/lgsltpaDone/view.do',
  UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  // 국민참여입법센터 국회입법현황 (opinion.lawmaking.go.kr)
  NSM_DOMAIN = 'https://opinion.lawmaking.go.kr',
  NSM_LIST_URL = '/gcom/nsmLmSts/out',
  // 국회 의안정보시스템 (likms.assembly.go.kr)
  LIKMS_DOMAIN = 'https://likms.assembly.go.kr',
  LIKMS_DETAIL_PAGE_URL = '/bill/bi/billDetailPage.do',
  LIKMS_BILL_INFO_URL = '/bill/bi/bill/detail/billInfo.do',
  // 의안번호 → billId 해석 (JSON 응답). `/bill` 컨텍스트 경로가 필요하다(없으면 307).
  LIKMS_FIND_BILL_URL = '/bill/bi/common/findBillDetail.do',
  LIKMS_CURR_MENU_NO = '2600044',
  // 국회 의안정보시스템 의안현황 > 계류의안 (AJAX POST + Spring CSRF 필요)
  LIKMS_STATE_PAGE_URL = '/bill/bi/bill/state/mooringBillPage.do',
  LIKMS_STATE_SEARCH_URL = '/bill/bi/bill/state/searchBillStatePaging.do',
  /**
   * 동명이인 선택 팝업 — 이름이 겹치는 의원의 대수·한자명·정당명과 의원 ID를
   * 표로 돌려준다(브라우저는 `membCnt > 1`일 때 이 팝업을 띄운다).
   * `ageFrom`/`ageTo`가 없으면 400이므로 항상 보내야 한다.
   */
  LIKMS_SAME_NM_POPUP_URL = '/bill/bi/popup/selSameNmMemb.do',
  /**
   * 대수별 소관위원회 목록(JSON 응답, `ageCmtList`). 검색 파라미터 `ageCmtId`는
   * 이름이 아니라 코드를 받으므로 이름→코드 해석에 쓴다.
   * `ageFrom`/`ageTo`를 **둘 다** 줘야 그 범위로 좁혀지고(한 쪽만 주면 무시),
   * 아무것도 주지 않으면 전체 대수 목록(같은 이름은 `(18대~22대)` 꼬리표로 구분)을 준다.
   */
  LIKMS_FIND_AGE_CMT_URL = '/bill/bi/bill/sch/findAgeCmt.do',
  /**
   * 계류의안 목록의 심사진행단계 값 중 '위원회 회부 이전' 단계.
   * NSM `searchPending`(rslRsltNmL=900101 '발의')에 대응하며, 실측에서 두 집합이 일치했다.
   */
  LIKMS_PENDING_PROGRESS_STATUS = '접수',
  // Spring Security CSRF 헤더명 (biInit.js/axios 인터셉터와 동일)
  LIKMS_CSRF_HEADER = 'X-CSRF-TOKEN',
}
