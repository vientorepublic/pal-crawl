import type {
  IBulkOptions,
  INsmAttachment,
  INsmBillDetail,
  INsmBillItem,
  INsmSearchQuery,
  INsmSearchResult,
} from './pal';
import {
  LikmsCrawler,
  LikmsStateCrawler,
  type ILikmsStateQuery,
  type LikmsStateCrawlerConfig,
  type LikmsStateProposerKind,
} from './likms';
import {
  LikmsDetailParser,
  type ILikmsCommittee,
  type ILikmsDetailInfo,
  type ILikmsStateBillItem,
} from './parser';

/**
 * 상임위 **이름** 비교용 정규화.
 *
 * likms의 소관위 목록은 대수 범위를 넓히면 같은 이름을 `(18대~22대)` 같은 꼬리표로
 * 구분하므로, 꼬리표와 공백을 제거해 비교한다(`법제사법 위원회` ↔ `법제사법위원회`).
 */
const normalizeCommitteeName = (name: string): string =>
  name.replace(/\s+/g, '').replace(/\([^()]*\)$/, '');

/**
 * 국민참여입법센터(`NsmLmSts`)와 동일한 '계류 법안 목록 조회' 인터페이스(공통 포트).
 *
 * - `NsmLmSts`가 구조적으로 이 포트를 만족한다.
 * - `LikmsNsmAdapter`가 이 포트를 구현해 호출부 수정 없이 국회 의안정보시스템의
 *   계류의안 조회로 교체할 수 있다.
 *
 * `searchPending` / `getAllPendingPages`는 일부러 포함하지 않는다. `NsmLmSts`는 서버 필터로
 * 좁히지만 likms에는 그런 필터가 없어, 같은 이름으로 감추면 스캔 비용이 드러나지 않는다.
 * 이 둘을 쓰던 호출부는 컴파일 오류로 한 번 멈추고, `LikmsNsmAdapter`의
 * `searchPending`/`getAllPendingPages`(스캔 기반 대안, JSDoc 참조)를 직접 고르게 한다.
 */
export interface INsmListCrawler {
  /** 목록 페이지 HTML을 반환합니다. */
  getListHTML(query?: INsmSearchQuery): Promise<string>;
  /** 목록 HTML을 검색 결과로 파싱합니다. */
  parseList(html: string): INsmSearchResult;
  /** 목록을 검색합니다. */
  search(query?: INsmSearchQuery): Promise<INsmSearchResult>;
  /** 특정 페이지의 목록을 반환합니다. */
  getPage(
    pageIndex: number,
    query?: Omit<INsmSearchQuery, 'pageIndex'>,
  ): Promise<INsmBillItem[]>;
  /** 전체 페이지를 순차적으로 yield합니다. */
  getAllPages(
    query?: Omit<INsmSearchQuery, 'pageIndex'>,
    options?: IBulkOptions,
  ): AsyncGenerator<INsmSearchResult>;
}

/**
 * 국민참여입법센터(`NsmLmSts`)와 동일한 '법안 상세 조회' 인터페이스(공통 포트).
 *
 * - `NsmLmSts`가 구조적으로 이 포트를 만족한다.
 * - `LikmsNsmAdapter`가 이 포트를 구현해 호출부 수정 없이 국회 의안정보시스템의
 *   의안상세 조회로 교체할 수 있다.
 *
 * 값 형식은 양쪽이 다르다(예: likms의 `proposalDate`는 `2026-10-13`, `session`은
 * `제22대(2024~2028)제439회`). 문자열 비교를 하던 호출부는 값을 확인해야 한다.
 */
export interface INsmDetailCrawler {
  /** 상세 페이지 HTML을 반환합니다. */
  getDetailHTML(billNo: string): Promise<string>;
  /** 상세 HTML을 법안 상세 정보로 파싱합니다(네트워크 호출 없음). */
  parseDetail(html: string): INsmBillDetail;
  /** 법안 상세 정보를 조회합니다. */
  getDetail(billNo: string): Promise<INsmBillDetail>;
}

/** NsmLmSts 발의구분 코드 → likms 제안자구분 코드 */
const PROPOSER_KIND_BY_SGT_CLS: Record<string, LikmsStateProposerKind> = {
  '900201': 'GOV', // 정부
  '900202': 'MEMASEMBY', // 의원
  '900203': 'CHRPR', // 위원장
};

/**
 * 국민참여입법센터(`NsmLmSts`) 호출부를 국회 의안정보시스템 계류의안 조회로
 * 바꿔주는 얇은 어댑터. `INsmListCrawler` 포트를 구현한다.
 *
 * ## 쿼리 매핑 (NsmLmSts → likms)
 * | INsmSearchQuery | ILikmsStateQuery | 비고 |
 * |---|---|---|
 * | `pageIndex` | `pageIndex` | |
 * | `pageSize` | `pageSize`(`rows`) | 양쪽 다 임의 값 반영(NSM 13·100, likms 13·25·200 실측). 기본값만 다르다(NSM 20건 ↔ likms 50건) — 미지정 시 결과 건수·페이지 수가 달라진다 |
 * | `sugCd` / `endSugCd` | `ageFrom` / `ageTo` | 제안대수 |
 * | `sgtCls` | `proposerKind` | 900201→GOV, 900202→MEMASEMBY, 900203→CHRPR |
 * | `scPpsUsr` | — (미지원) | 제안자명 — likms는 **이름을 받지 않아** 옮길 수 없다. 지정하면 예외를 던진다(조용히 무시하면 필터가 빠진 전체 결과가 나온다) |
 * | `scCptPpostCmt` | `ageCmtId` | 상임위 **이름**을 `/bi/bill/sch/findAgeCmt.do` 목록에서 코드로 해석한다. 대수 범위(`sugCd`/`endSugCd`) 안에서 찾고, 이름이 없거나 여러 코드면 예외 |
 * | `searchStDtNew` / `searchEdDtNew` | `fromPropDt` / `toPropDt` | 제안일자, likms는 **양쪽 모두 줄 때만** 서버가 적용한다(한쪽만 주면 전체). NSM 쪽은 `YYYYMMDD`여야 하므로(`YYYY-MM-DD`로 두 값을 주면 0건) 그대로 옮기면 필터가 사라진다 |
 * | `sortOrder` | `ordCd` | ASC/DESC |
 * | `scBlNmSct` | `billNo`(숫자) 또는 `billNm`(문자) | 값 형태로 자동 판별 |
 *
 * ## 매핑하지 않는 필드 (likms에 동일 축이 없음)
 * `rslRsltNmL`, `rslRsltNmR`(심사·의결현황), `cptOfiOrgCd`(소관부처),
 * `sortCol`(값 체계 상이), `issLawitmYn`, `stDt`/`edDt`.
 * 이 필드들은 무시되므로, 해당 조건이 반드시 필요하면 `likms` 프로퍼티로
 * `LikmsStateCrawler`를 직접 써서 매핑해야 한다.
 *
 * 반대로 likms에만 있고 `INsmSearchQuery`에 없는 축도 있다: `cmtResultCd`(소관위
 * 처리결과 계류/가결/부결/폐기), `jntPrpslYn`(공동발의 여부), `stateDtlDivCd`(탭).
 * 어댑터는 추측해서 채우지 않으므로, 필요하면 `adapter.likms.search()`로 직접 지정한다.
 *
 * `scPpsUsr`만은 무시하지 않고 **예외를 던진다**. likms는 제안자명을 받지 않고
 * 의원 ID(`representId`)만 받는데, 어댑터는 이름을 ID로 확정할 수 없기
 * 때문이다(동명이인·미등록 가능). 이름밖에 모를 때는
 * `adapter.likms.findRepresentCandidates(name)`으로 사이트가 제시하는 후보를 보고
 * 고른 `membId`를 `adapter.likms.search({ representId, representKindCd })`로 넘긴다.
 *
 * ## 결과 매핑 (likms → NsmLmSts)
 * `billName`/`billNo`/`link`/`proposer`/`proposalDate`/`committee`/`progressStatus`는
 * 그대로 채우고, 계류의안 목록에 없는 `ministry`/`progressDate`/`resolutionStatus`/
 * `resolutionDate`는 빈 문자열로 둔다.
 *
 * 주의: `representId`로 좁힌 결과에도 공동발의 건이 섞인다(발의구분 기본 '전체').
 * 목록의 제안자 표기(`proposer`)는 대표발의자이므로 찾는 사람과 다른 행이 나올 수 있다.
 * 발의구분까지 특정하려면 `likms` 프로퍼티로 `representKindCd`를 함께 보낸다.
 *
 * 제안이유(`LikmsStateCrawler`의 `hydrateProposalReason`)는 `INsmBillItem`에 대응 필드가
 * 없어 어댑터 결과에 담기지 않는다. 필요하면 `likms` 프로퍼티로 직접 조회한다.
 */
export class LikmsNsmAdapter implements INsmListCrawler, INsmDetailCrawler {
  /**
   * 계류의안 전용 API(`hasProposalReason`, `billId`, `clearSession` 등)를 쓰기 위한
   * 내부 크롤러. 어댑터가 제공하지 않는 값이 필요하면 이걸 직접 사용한다.
   */
  public readonly likms: LikmsStateCrawler;

  /** 의안상세 전용 크롤러 (billId 단위 조회) */
  private readonly detail: LikmsCrawler;
  private readonly detailParser: LikmsDetailParser;

  constructor(config?: LikmsStateCrawlerConfig) {
    this.likms = new LikmsStateCrawler(config);
    this.detail = new LikmsCrawler(config);
    this.detailParser = new LikmsDetailParser();
  }

  /**
   * 캐시된 CSRF 토큰/세션과 소관위 목록 캐시를 버립니다.
   * 다음 조회에서 토큰·소관위 목록을 새로 받아옵니다.
   */
  public clearSession(): void {
    this.likms.clearSession();
    this.committeeLists.clear();
  }

  /**
   * 상임위 이름 → 소관위 코드 해석에 쓰는 대수별 목록 캐시.
   * 위원회 구성은 대수 단위로만 바뀌므로 (범위 → 목록)으로 캐시한다.
   */
  private readonly committeeLists = new Map<string, ILikmsCommittee[]>();

  /** 대수 범위의 소관위 목록을 캐시로 감싸 조회합니다. */
  private async getCommitteeList(
    ageFrom?: string | number,
    ageTo?: string | number,
  ): Promise<ILikmsCommittee[]> {
    const key = `${ageFrom ?? ''}~${ageTo ?? ''}`;
    const cached = this.committeeLists.get(key);
    if (cached) {
      return cached;
    }

    const list = await this.likms.findCommittees(ageFrom, ageTo);
    this.committeeLists.set(key, list);
    return list;
  }

  /**
   * 상임위 **이름**(NSM `scCptPpostCmt`)을 likms 소관위 코드(`ageCmtId`)로 해석합니다.
   *
   * likms 서버는 이름이 아니라 코드를 받으므로 사이트 목록에서 찾는다. 대수 범위
   * (`sugCd`/`endSugCd`)로 좁혀 찾고, 꼬리표·공백을 제거해 비교한다. 확정할 수 없으면
   * **요청 전에** 예외를 던진다(필터가 빠진 전체 결과를 돌려주지 않는다):
   * - 이름이 목록에 없을 때 (`unknown committee`)
   * - 같은 이름이 여러 코드로 존재할 때 — 범위를 넓히면 `보건복지위원회`처럼
   *   대수별로 코드가 나뉜다 (`ambiguous committee`)
   */
  private async resolveCommitteeId(
    name?: string,
    ageFrom?: string | number,
    ageTo?: string | number,
  ): Promise<string | undefined> {
    const normalized = name?.trim();
    if (!normalized) {
      return undefined;
    }

    const list = await this.getCommitteeList(ageFrom, ageTo);
    const exact = list.filter(
      (committee) =>
        committee.comCdName.replace(/\s+/g, '') ===
        normalized.replace(/\s+/g, ''),
    );
    const matches =
      exact.length > 0
        ? exact
        : list.filter(
            (committee) =>
              normalizeCommitteeName(committee.comCdName) ===
              normalizeCommitteeName(normalized),
          );

    const codes = [...new Set(matches.map((committee) => committee.comCd))];
    if (codes.length === 1) {
      return codes[0];
    }
    if (codes.length === 0) {
      throw new Error(
        `unknown committee: ${normalized} — use likms.findCommittees() to pick a comCd and pass it via ageCmtId`,
      );
    }

    const candidates = matches
      .map((committee) => `${committee.comCd} ${committee.comCdName}`)
      .join(', ');
    throw new Error(
      `ambiguous committee: ${normalized} matches ${codes.length} codes (${candidates}) — narrow sugCd/endSugCd or pass ageCmtId via likms.search`,
    );
  }

  /**
   * NSM 쿼리 → likms 쿼리.
   *
   * 이름 기반 필터(`scPpsUsr`, `scCptPpostCmt`)는 서버가 확정 값을 받지 못하는 축이라
   * 조용히 버리지 않는다. 해석할 수 없으면 **요청 전에** 예외를 던져, 필터가 빠진
   * 전체 결과를 오답으로 돌려주는 일을 막는다.
   */
  private async toLikmsQuery(
    query: INsmSearchQuery,
  ): Promise<ILikmsStateQuery> {
    // likms는 제안자명을 받지 않는다 — 무시하면 필터가 빠진 전체 결과(오답)를 돌려주므로 알린다.
    if (query.scPpsUsr?.trim()) {
      throw new Error(
        'scPpsUsr is not supported: likms filters by member ID only — pick a membId from likms.findRepresentCandidates() and search with representId',
      );
    }

    const needle = query.scBlNmSct?.trim();
    const looksLikeBillNo = needle !== undefined && /^[0-9]+$/.test(needle);
    // 상임위 이름은 대수 범위 안에서 코드로 해석한다(실패 시 여기서 예외).
    const ageCmtId = await this.resolveCommitteeId(
      query.scCptPpostCmt,
      query.sugCd,
      query.endSugCd,
    );

    return {
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      billNm: looksLikeBillNo ? undefined : needle,
      billNo: looksLikeBillNo ? needle : undefined,
      proposerKind: query.sgtCls
        ? PROPOSER_KIND_BY_SGT_CLS[query.sgtCls]
        : undefined,
      ageCmtId,
      ageFrom: query.sugCd,
      ageTo: query.endSugCd,
      fromPropDt: query.searchStDtNew,
      toPropDt: query.searchEdDtNew,
      ordCd: query.sortOrder,
    };
  }

  private static toNsmItem(item: ILikmsStateBillItem): INsmBillItem {
    return {
      billName: item.billName,
      billNo: item.billNo,
      link: item.link,
      proposer: item.proposer,
      proposalDate: item.proposalDate,
      committee: item.committee,
      // 계류의안 목록에는 없는 필드는 빈 문자열로 둔다.
      ministry: '',
      progressStatus: item.progressStatus,
      progressDate: '',
      resolutionStatus: '',
      resolutionDate: '',
    };
  }

  /** likms 의안상세 → `INsmBillDetail` (값이 있는 쪽을 우선한다) */
  private static mergeDetail(
    base: ILikmsDetailInfo,
    extra: ILikmsDetailInfo,
  ): ILikmsDetailInfo {
    return {
      title: extra.title || base.title,
      billNo: extra.billNo || base.billNo,
      proposer: extra.proposer || base.proposer,
      proposalDate: extra.proposalDate || base.proposalDate,
      session: extra.session || base.session,
      proposalReason: extra.proposalReason ?? base.proposalReason,
      attachments:
        extra.attachments.length > 0 ? extra.attachments : base.attachments,
    };
  }

  /**
   * likms 의안상세 → `INsmBillDetail`.
   *
   * likms에는 NSM의 '발의정보' 원문 한 줄이 없어, 접수정보로 같은 형식의 문자열을
   * 만들어 `proposalInfo`에 넣는다(`"제안자, 제N호(제안일자). 제안회기"`).
   * `attachments.fileId`에는 NSM의 숫자 ID 대신 다운로드 URL이 들어간다.
   */
  private static toNsmDetail(info: ILikmsDetailInfo): INsmBillDetail {
    const parts: string[] = [];
    if (info.proposer) {
      parts.push(info.proposer);
    }
    if (info.billNo) {
      const date = info.proposalDate ? `(${info.proposalDate})` : '';
      parts.push(`제${info.billNo}호${date}`);
    }

    const head = parts.join(', ');
    const proposalInfo = info.session
      ? head
        ? `${head}. ${info.session}`
        : info.session
      : head;

    const attachments: INsmAttachment[] = info.attachments.map((item) => ({
      filename: item.filename,
      fileId: item.url,
    }));

    return {
      title: info.title,
      billNo: info.billNo,
      proposalInfo,
      proposer: info.proposer,
      proposalDate: info.proposalDate,
      session: info.session,
      proposalReason: info.proposalReason,
      attachments,
    };
  }

  /**
   * 의안상세 페이지 HTML을 반환합니다.
   *
   * 인자는 NSM과 같이 의안번호(`2221883`)를 받고, likms의 billId(`PRC_...`)도 허용한다.
   * 의안번호는 `findBillDetail.do`로 billId로 해석하며, 존재하지 않으면
   * `Error('bill not found: ...')`를 던진다.
   */
  public async getDetailHTML(billNoOrBillId: string): Promise<string> {
    const billId = await this.resolveBillId(billNoOrBillId);
    return this.detail.getDetailPageHTML(billId);
  }

  /**
   * 의안상세 HTML을 `INsmBillDetail`로 파싱합니다(네트워크 호출 없음).
   *
   * likms는 제목이 상세 페이지에, 발의정보·제안이유가 심사정보 탭 조각에 나뉘어 있어
   * 어느 쪽 HTML을 줘도 들어 있는 값만 채워진다. 전부 채우려면 `getDetail`을 쓴다.
   */
  public parseDetail(html: string): INsmBillDetail {
    return LikmsNsmAdapter.toNsmDetail(this.detailParser.parseDetail(html));
  }

  /**
   * 의안 상세(제목·발의정보·제안이유·의안원문)를 조회합니다.
   *
   * likms는 제목과 나머지가 서로 다른 응답에 있어 상세 페이지 + 심사정보 조각을
   * 두 번 요청한다(숨김 폼 파라미터는 상세 페이지에서 추출).
   */
  public async getDetail(billNoOrBillId: string): Promise<INsmBillDetail> {
    const billId = await this.resolveBillId(billNoOrBillId);

    const pageHtml = await this.detail.getDetailPageHTML(billId);
    const params = this.detail.parseDetailFormParams(pageHtml);
    if (!params.billId) {
      params.billId = billId;
    }
    const fragmentHtml = await this.detail.getBillInfoHTML(params);

    return LikmsNsmAdapter.toNsmDetail(
      LikmsNsmAdapter.mergeDetail(
        this.detailParser.parseDetail(pageHtml),
        this.detailParser.parseDetail(fragmentHtml),
      ),
    );
  }

  /** 의안번호면 billId로 해석하고, billId(`PRC_...`)면 그대로 사용한다. */
  private async resolveBillId(billNoOrBillId: string): Promise<string> {
    const normalized = billNoOrBillId.trim();
    if (!normalized) {
      throw new Error('billNo is required');
    }
    if (normalized.startsWith('PRC_')) {
      return normalized;
    }

    const billId = await this.detail.resolveBillId(normalized);
    if (!billId) {
      throw new Error(`bill not found: ${normalized}`);
    }
    return billId;
  }

  private static toNsmResult(
    result: ReturnType<LikmsStateCrawler['parseList']>,
  ): INsmSearchResult {
    return {
      total: result.total,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      items: result.items.map((item) => LikmsNsmAdapter.toNsmItem(item)),
    };
  }

  /** 목록 조각 HTML을 반환합니다. */
  public async getListHTML(query: INsmSearchQuery = {}): Promise<string> {
    return this.likms.getStateListHTML(await this.toLikmsQuery(query));
  }

  /** 목록 조각 HTML을 NSM 형식의 검색 결과로 파싱합니다. */
  public parseList(html: string): INsmSearchResult {
    return LikmsNsmAdapter.toNsmResult(this.likms.parseList(html));
  }

  /** 계류의안을 검색해 NSM 형식의 결과로 반환합니다. */
  public async search(query: INsmSearchQuery = {}): Promise<INsmSearchResult> {
    const result = await this.likms.search(await this.toLikmsQuery(query));
    return LikmsNsmAdapter.toNsmResult(result);
  }

  /** 특정 페이지의 계류의안 목록을 NSM 아이템 형식으로 반환합니다. */
  public async getPage(
    pageIndex: number,
    query: Omit<INsmSearchQuery, 'pageIndex'> = {},
  ): Promise<INsmBillItem[]> {
    const result = await this.search({ ...query, pageIndex });
    return result.items;
  }

  /** 계류의안 전체 페이지를 NSM 형식으로 순차 yield합니다. */
  public getAllPages(
    query?: Omit<INsmSearchQuery, 'pageIndex'>,
    options?: IBulkOptions,
  ): AsyncGenerator<INsmSearchResult> {
    return this.getAllPagesImpl(query ?? {}, options ?? {});
  }

  private async *getAllPagesImpl(
    query: Omit<INsmSearchQuery, 'pageIndex'>,
    options: IBulkOptions,
  ): AsyncGenerator<INsmSearchResult> {
    for await (const page of this.likms.getAllPages(
      await this.toLikmsQuery(query),
      options,
    )) {
      yield LikmsNsmAdapter.toNsmResult(page);
    }
  }

  /**
   * 발의 상태(위원회 회부 이전) 법안만 조회합니다 — `NsmLmSts.searchPending`의 대안.
   *
   * `NsmLmSts`는 `rslRsltNmL=900101`로 서버에서 좁히지만, likms에는 심사진행상태를
   * 좁히는 유효한 필터가 없어(실측) 목록을 앞에서부터 **스캔**하며 `progressStatus`가
   * `'접수'`인 항목만 걸러낸다. 그래서:
   * - 비용이 크다: 접수 항목이 나올 때까지 페이지를 순차 요청한다(`options.maxPages`, 기본 10).
   * - `options.maxPages` 안에서 못 찾으면 빈 결과(`items: []`)를 반환한다.
   * - `items`는 접수 항목만이고 `total`/`totalPages`는 전체(접수 포함) 기준 원본 값이다.
   * - `progressStatus`는 likms 어휘(`'접수'`)이고 NSM의 `'발의'`와 문자열이 다르다.
   *
   * 페이지 단위로 전부 순회하려면 `getAllPendingPages`를 쓴다.
   */
  public async searchPending(
    query: INsmSearchQuery = {},
    options?: IBulkOptions,
  ): Promise<INsmSearchResult> {
    const result = await this.likms.searchPending(
      await this.toLikmsQuery(query),
      options,
    );
    return LikmsNsmAdapter.toNsmResult(result);
  }

  /**
   * 접수(위원회 회부 이전) 법안을 페이지 단위로 순차적으로 yield합니다.
   * 서버 필터가 없어 전체 목록을 스캔하며, `options.maxPages`로 범위를 제한합니다.
   */
  public getAllPendingPages(
    query?: Omit<INsmSearchQuery, 'pageIndex'>,
    options?: IBulkOptions,
  ): AsyncGenerator<INsmSearchResult> {
    return this.getAllPendingPagesImpl(query ?? {}, options ?? {});
  }

  private async *getAllPendingPagesImpl(
    query: Omit<INsmSearchQuery, 'pageIndex'>,
    options: IBulkOptions,
  ): AsyncGenerator<INsmSearchResult> {
    for await (const page of this.likms.getAllPendingPages(
      await this.toLikmsQuery(query),
      options,
    )) {
      yield LikmsNsmAdapter.toNsmResult(page);
    }
  }
}
