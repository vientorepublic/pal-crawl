import { URL } from 'url';
import * as cheerio from 'cheerio';
import { Config } from './config';
import { HttpClient } from './http-client';
import type { IBulkOptions } from './pal';
import {
  LikmsDetailParser,
  LikmsStateParser,
  type ILikmsCommittee,
  type ILikmsRepresentCandidate,
  type ILikmsStateBillItem,
  type ILikmsStateSearchResult,
} from './parser';

export interface LikmsCrawlerConfig {
  userAgent?: string;
  timeout?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
}

/**
 * 국회 의안정보시스템(likms.assembly.go.kr) 크롤러.
 *
 * 의안상세 페이지(billDetailPage.do)는 심사정보 탭 내용을 빈 div에 AJAX(POST)로
 * 채우므로, 정적 HTML만으로는 제안이유를 읽을 수 없다.
 *
 * 실제 흐름 (billDetail.js 기준):
 *   1. GET  /bill/bi/billDetailPage.do?billId=...&currMenuNo=2600044
 *      → 숨김 폼(#form)에 billId, billNo, billKindCd 등 파라미터 포함
 *   2. POST /bill/bi/bill/detail/billInfo.do (폼 파라미터 직렬화)
 *      → 심사정보 탭 조각 HTML 반환
 *   3. 조각의 <pre id="prntSummary"> 안에 제안이유 및 주요내용이 들어 있음
 *
 * PAL(입법예고) 상세 페이지에서 제안이유가 비어 있는 의안의 contentId(=PRC_...)
 * 는 동일한 ID로 이 시스템에서 조회할 수 있다.
 */
export class LikmsCrawler {
  private readonly httpClient: HttpClient;
  private readonly detailParser: LikmsDetailParser;

  constructor(config?: LikmsCrawlerConfig) {
    this.httpClient = new HttpClient({
      userAgent: config?.userAgent ?? Config.UserAgent,
      timeout: config?.timeout ?? 10000,
      retryCount: config?.retryCount ?? 3,
      customHeaders: config?.customHeaders ?? {},
    });
    this.detailParser = new LikmsDetailParser();
  }

  /**
   * 의안번호(예: `2221883`)로 billId를 조회합니다 (`/bi/common/findBillDetail.do`).
   * 의안상세 페이지는 billId만 받으므로, 목록의 의안번호밖에 없을 때 사용합니다.
   * 존재하지 않거나 응답이 JSON이 아니면 `null`을 반환합니다(네트워크 오류는 전파).
   */
  public async resolveBillId(billNo: string): Promise<string | null> {
    const normalized = billNo.trim();
    if (!normalized) {
      return null;
    }

    const url = new URL(Config.LIKMS_FIND_BILL_URL, Config.LIKMS_DOMAIN);
    url.searchParams.set('billNo', normalized);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await this.httpClient.get(url));
    } catch (error) {
      if (error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const data = (parsed as Record<string, unknown>).data;
    if (typeof data !== 'object' || data === null) {
      return null;
    }
    const billId = (data as Record<string, unknown>).billId;
    return typeof billId === 'string' && billId.trim() ? billId.trim() : null;
  }

  private buildDetailPageUrl(billId: string): URL {
    const url = new URL(Config.LIKMS_DETAIL_PAGE_URL, Config.LIKMS_DOMAIN);
    url.searchParams.set('billId', billId);
    url.searchParams.set('currMenuNo', Config.LIKMS_CURR_MENU_NO);
    return url;
  }

  /** 의안상세 페이지 HTML을 반환합니다. */
  public async getDetailPageHTML(billId: string): Promise<string> {
    const normalized = billId.trim();
    if (!normalized) {
      throw new Error('billId is required');
    }
    return this.httpClient.get(this.buildDetailPageUrl(normalized));
  }

  /**
   * 의안상세 페이지의 숨김 폼(#form input[type=hidden]) 파라미터를 추출합니다.
   * billInfo.do AJAX 요청은 이 파라미터들에 심사정보 섹션의 렌더링 조건이 걸려
   * 있어 원본 페이지에서 그대로 가져와야 한다.
   */
  public parseDetailFormParams(html: string): Record<string, string> {
    const $ = cheerio.load(html);
    const params: Record<string, string> = {};
    $('#form input[type="hidden"]').each((_, el) => {
      const name = $(el).attr('name');
      if (!name) {
        return;
      }
      params[name] = $(el).attr('value') ?? '';
    });
    return params;
  }

  /** 심사정보 탭 조각 HTML을 POST로 반환합니다. */
  public async getBillInfoHTML(
    params: Record<string, string>,
  ): Promise<string> {
    const url = new URL(Config.LIKMS_BILL_INFO_URL, Config.LIKMS_DOMAIN);
    const body = new URLSearchParams(params).toString();
    return this.httpClient.post(url, body);
  }

  /** 심사정보 탭 조각 HTML에서 제안이유 및 주요내용을 파싱하여 반환합니다. */
  public parseProposalReason(fragmentHtml: string): string | null {
    return this.detailParser.parseProposalReason(fragmentHtml);
  }

  /**
   * billId(PAL contentId와 동일)로 제안이유 및 주요내용을 조회합니다.
   * 네트워크·파싱 실패를 절대 던지지 않고 null을 반환해 호출부가 안전하게
   * 동작하도록 한다.
   */
  public async getProposalReason(billId: string): Promise<string | null> {
    const normalized = billId.trim();
    if (!normalized) {
      return null;
    }

    try {
      const detailHtml = await this.getDetailPageHTML(normalized);
      const params = this.parseDetailFormParams(detailHtml);
      if (!params.billId) {
        params.billId = normalized;
      }
      const fragmentHtml = await this.getBillInfoHTML(params);
      return this.parseProposalReason(fragmentHtml);
    } catch {
      return null;
    }
  }
}

// ── 국회 의안정보시스템 의안현황 > 계류의안 ───────────────────────────────────

export interface LikmsStateCrawlerConfig {
  userAgent?: string;
  timeout?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
  /**
   * 목록의 `hasProposalReason` 법안의 제안이유를 의안상세에서 조회해 채울지 여부
   * (기본값: false).
   *
   * 건당 2회(상세 페이지 + billInfo.do) 요청이 추가되므로 기본적으로 꺼져 있다.
   * 켜면 `search` / `getPage` / `getAllPages`가 자동으로 보정하며, 실패한 건은
   * 기존 값(`null`)을 유지하고 오류를 던지지 않는다.
   * 보정 속도를 조절하려면 `hydrateProposalReasons(items, options)`를 직접 호출한다.
   */
  hydrateProposalReason?: boolean;
}

/**
 * 의안현황 페이지 구분. 계류의안(`mooring`)이 기본값이며 이 크롤러의 주 대상입니다.
 * - mooring: 계류의안
 * - finish: 처리의안
 * - suggest: 위원회안(대안)
 * - beforePropose: 본회의 부의안건
 */
export type LikmsStateId = 'mooring' | 'finish' | 'suggest' | 'beforePropose';

/**
 * 발의구분 코드
 * - REPR: 대표발의
 * - SING: 1인발의
 * - COMM: 공동발의
 * - 전체
 */
export type LikmsStateRepresentKind = 'REPR' | 'SING' | 'COMM' | '전체';

/** 정렬 방향 */
export type LikmsStateSortOrder = 'ASC' | 'DESC';

/**
 * 제안자구분 코드 (`proposerKind`)
 * - MEMASEMBY: 의원
 * - GOV: 정부
 * - CHRPR: 위원장
 * - CHRM: 의장
 * - PRESIDENT: 대통령
 * - ETC: 기타
 */
export type LikmsStateProposerKind =
  'MEMASEMBY' | 'GOV' | 'CHRPR' | 'CHRM' | 'PRESIDENT' | 'ETC' | '전체';

/**
 * 소관위 처리결과 코드 (`cmtResultCd`). 사이트 검색 폼의 선택지와 같은 값이다(실측 2026-10-13).
 * - PRC_0000: 계류
 * - PRC_0011: 폐기
 * - PRC_0013: 가결
 * - PRC_0014: 부결
 *
 * 소관위원회의 처리결과이므로 NSM `rslRsltNmR`(본회의 의결현황)과는 축이 다르다.
 */
export type LikmsStateCmtResult =
  'PRC_0000' | 'PRC_0011' | 'PRC_0013' | 'PRC_0014';

/** 공동발의 여부 (`jntPrpslYn`). 미지정이면 사이트 기본값 '전체'로 조회된다. */
export type LikmsStateJointProposal = 'Y' | 'N';

export interface ILikmsStateQuery {
  pageIndex?: number;
  /** 페이지당 건수 (`rows`, 기본값 50) */
  pageSize?: number;
  /** 의안현황 페이지 구분 (기본값: "mooring") */
  stateId?: LikmsStateId;
  /** 탭 구분 (계류의안 기본값: "all") */
  stateDtlDivCd?: string;
  /** 의안명 */
  billNm?: string;
  /** 의안번호 */
  billNo?: string;
  /**
   * 발의구분 (대표발의/1인발의/공동발의).
   * 발의자 필터는 `representId`와 이 값이 **둘 다** 있어야 서버가 적용한다
   * (`representId`만 주면 무시되므로 '전체'로 자동 보정된다).
   */
  representKindCd?: LikmsStateRepresentKind;
  /** 제안자구분 (정부/의원/위원장 등) */
  proposerKind?: LikmsStateProposerKind;
  /**
   * 발의자 ID(의원 ID). 서버 필터는 이 값만 확정적으로 받는다 — 이름은 받지 않으므로
   * 크롤러가 이름을 해석하지 않는다. 이름밖에 모를 때는 `findRepresentCandidates(name)`로
   * 사이트가 주는 후보를 확인해 그 `membId`를 여기에 넣는다.
   * (`representKindCd`와 함께 보내야 필터가 동작한다.)
   */
  representId?: string;
  /**
   * 소관위원회 코드. 이름이 아니라 코드를 받으므로 이름밖에 모를 때는
   * `findCommittees(ageFrom, ageTo)`로 코드를 확인해 여기에 넣는다.
   */
  ageCmtId?: string;
  /**
   * 소관위 처리결과(계류/가결/부결/폐기). 계류안만 보려면 `'PRC_0000'`.
   * 계류의안 탭에서도 처리된 건이 섞여 나오므로 좁힐 때 쓴다.
   */
  cmtResultCd?: LikmsStateCmtResult;
  /** 공동발의 여부. `'전체'`는 값을 보내지 않는 것과 같다. */
  jntPrpslYn?: LikmsStateJointProposal;
  /** 제안대수 시작 (예: "22") */
  ageFrom?: string | number;
  /** 제안대수 끝 */
  ageTo?: string | number;
  /** 의안종류 (예: "법률안") */
  billKind?: string;
  /** 정렬 컬럼 (예: "billNo", "billName", "proposeDt") */
  listOrd?: string;
  /** 정렬 방향 */
  ordCd?: LikmsStateSortOrder;
  /**
   * 제안일자 시작 (YYYY-MM-DD). 서버는 `toPropDt`와 **함께** 줄 때만 적용한다
   * (한쪽만 보내면 무시된다).
   */
  fromPropDt?: string;
  /** 제안일자 종료 (YYYY-MM-DD). `fromPropDt`와 함께 줘야 적용된다. */
  toPropDt?: string;
  /** 결과 내 재검색어 */
  nmReSchText?: string;
}

/** 계류의안 세션: CSRF 토큰과 검색 폼의 숨김 필드 */
interface ILikmsStateSession {
  token: string;
  /**
   * 페이지 `#form`의 숨김 필드(CSRF 토큰 제외).
   * 브라우저는 이 필드들을 그대로 실어 보내고, 그중 `isPopSelect`·`anbillDivCd` 등이
   * 있어야 발의자(`representId`) 필터가 동작한다. 크롤러도 같은 방식을 따른다.
   */
  formParams: Record<string, string>;
}

/**
 * 국회 의안정보시스템(likms.assembly.go.kr) 의안현황 > 계류의안 크롤러.
 *
 * 국민참여입법센터(NsmLmSts)의 계류 법안 조회를 대체할 수 있으며, 동일한
 * `search` / `getPage` / `getAllPages` 구조를 제공합니다.
 *
 * 실제 흐름 (billState.js, biInit.js 기준):
 *   1. GET  /bill/bi/bill/state/mooringBillPage.do?stateId=mooring
 *      → 세션 쿠키(JSESSIONID)와 <meta name="_csrf"> 토큰, #form 숨김 필드 확보
 *   2. POST /bill/bi/bill/state/searchBillStatePaging.do
 *      → 헤더 X-CSRF-TOKEN: <토큰>, 본문은 1에서 얻은 숨김 필드 + 요청 조건
 *   3. 응답은 <div id="state-list"> 목록 조각 HTML (JSON 아님)
 *      - 총 건수/페이지: #pager_count_text, #pager_pages_text 숨김 input
 *
 * CSRF 토큰은 페이지 로드 시 한 번 발급되어 세션 동안 유지되므로, 첫 요청에서만
 * 페이지를 조회해 토큰·폼 필드를 캐시합니다(만료 시 1회 자동 재발급).
 *
 * 본문을 페이지 숨김 필드로 시작하는 이유: 브라우저가 폼을 직렬화해 보내는 방식과
 * 같아야 발의자(`representId`) 필터가 동작한다. 최소 파라미터만 보내면
 * 서버가 발의자 조건을 조용히 무시한다.
 *
 * 발의자 **이름**은 서버도 크롤러도 해석하지 않는다(이름만으로는 어느 의원인지
 * 확정할 수 없다). 이름밖에 없으면 `findRepresentCandidates()`로 사이트가 제시하는
 * 후보를 보고 호출부가 `membId`를 고르는 것이 유일한 경로다.
 */
export class LikmsStateCrawler {
  private readonly httpClient: HttpClient;
  private readonly parser: LikmsStateParser;
  /** 제안이유 보정용 의안상세 크롤러 (billId 단위 조회) */
  private readonly detailCrawler: LikmsCrawler;
  private readonly hydrateProposalReason: boolean;
  /** 제안이유 보정 기본 동시 요청 수 (1 = 순차) */
  private readonly hydrateConcurrency = 1;
  /** 제안이유 보정 기본 요청 간 지연(ms) — 대상 사이트 부하 방지 */
  private readonly hydrateDelayMs = 500;
  private session: ILikmsStateSession | null = null;

  constructor(config?: LikmsStateCrawlerConfig) {
    this.httpClient = new HttpClient({
      userAgent: config?.userAgent ?? Config.UserAgent,
      timeout: config?.timeout ?? 10000,
      retryCount: config?.retryCount ?? 3,
      customHeaders: config?.customHeaders ?? {},
    });
    this.parser = new LikmsStateParser();
    this.detailCrawler = new LikmsCrawler({
      userAgent: config?.userAgent ?? Config.UserAgent,
      timeout: config?.timeout ?? 10000,
      retryCount: config?.retryCount ?? 3,
      customHeaders: config?.customHeaders ?? {},
    });
    this.hydrateProposalReason = config?.hydrateProposalReason ?? false;
  }

  private buildStatePageUrl(stateId: LikmsStateId): URL {
    const url = new URL(Config.LIKMS_STATE_PAGE_URL, Config.LIKMS_DOMAIN);
    url.searchParams.set('stateId', stateId);
    return url;
  }

  /**
   * 계류의안 페이지 HTML을 반환합니다.
   * 세션 쿠키와 CSRF 토큰을 확보하는 진입점으로 사용됩니다.
   */
  public async getStatePageHTML(
    stateId: LikmsStateId = 'mooring',
  ): Promise<string> {
    return this.httpClient.get(this.buildStatePageUrl(stateId));
  }

  /** 페이지의 <meta name="_csrf"> 값에서 CSRF 토큰을 추출합니다. */
  public extractCsrfToken(html: string): string | null {
    const $ = cheerio.load(html);
    const token = $('meta[name="_csrf"]').attr('content')?.trim();
    return token || null;
  }

  /**
   * 페이지 `#form`의 숨김 필드를 객체로 추출합니다(CSRF 토큰 제외).
   * 검색 AJAX 본문의 기본값으로 쓰이며, 브라우저가 폼을 직렬화해 보내는 것과 같습니다.
   */
  public parseStateFormParams(html: string): Record<string, string> {
    const $ = cheerio.load(html);
    const params: Record<string, string> = {};
    $('#form input[type="hidden"]').each((_, el) => {
      const name = $(el).attr('name');
      if (!name || name === '_csrf') {
        return;
      }
      params[name] = $(el).attr('value') ?? '';
    });
    return params;
  }

  /**
   * 캐시된 세션(CSRF 토큰·폼 숨김 필드)을 버려 다음 요청에서 다시 발급받도록 합니다.
   */
  public clearSession(): void {
    this.session = null;
  }

  private async ensureSession(
    stateId: LikmsStateId,
  ): Promise<ILikmsStateSession> {
    if (this.session) {
      return this.session;
    }

    const html = await this.getStatePageHTML(stateId);
    const token = this.extractCsrfToken(html);
    if (!token) {
      throw new Error('CSRF token is missing on state page');
    }

    this.session = { token, formParams: this.parseStateFormParams(html) };
    return this.session;
  }

  private buildSearchBody(
    query: ILikmsStateQuery,
    formParams: Record<string, string> = {},
  ): string {
    const params = new URLSearchParams();
    // 브라우저처럼 페이지 폼의 숨김 필드를 먼저 깔고, 아래에서 요청 값으로 덮어쓴다.
    for (const [key, value] of Object.entries(formParams)) {
      params.set(key, value);
    }
    params.set('page', String(query.pageIndex ?? 1));
    params.set('stateId', query.stateId ?? 'mooring');
    params.set('stateDtlDivCd', query.stateDtlDivCd ?? 'all');

    const entries: Array<[string, string | number | undefined]> = [
      ['rows', query.pageSize],
      ['billNm', query.billNm],
      ['billNo', query.billNo],
      // 발의자 필터는 ID와 발의구분이 셋트여야 서버가 적용한다(ID만 보내면 무시됨).
      [
        'representKindCd',
        query.representKindCd ?? (query.representId ? '전체' : undefined),
      ],
      ['proposerKind', query.proposerKind],
      ['representId', query.representId],
      ['ageCmtId', query.ageCmtId],
      ['cmtResultCd', query.cmtResultCd],
      ['jntPrpslYn', query.jntPrpslYn],
      ['ageFrom', query.ageFrom],
      ['ageTo', query.ageTo],
      ['billKind', query.billKind],
      ['listOrd', query.listOrd],
      ['ordCd', query.ordCd],
      ['fromPropDt', query.fromPropDt],
      ['toPropDt', query.toPropDt],
      ['nmReSchText', query.nmReSchText],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }

    return params.toString();
  }

  /**
   * 발의자명으로 **후보 목록**을 조회합니다 (`/bi/popup/selSameNmMemb.do`).
   *
   * 서버 검색 필터는 의원 ID(`representId`)만 받으므로, 이름밖에 모를 때 이 메서드로
   * 사이트가 제시하는 후보(의원 ID·대수·한자명·정당명)를 보고 호출부가 고른다.
   * 이름 하나를 ID로 자동 확정하지 않는다 — 같은 이름이 여러 대수에 있거나
   * **같은 대수에** 둘 이상일 수 있어(예: 21대 이수진 2인) 크롤러가 정할 수 없다.
   *
   * - 명단에 없으면 빈 배열
   * - `ageFrom`/`ageTo`는 서버가 필수로 받는다(없으면 400) → 기본값은 전체 범위(`01`–`99`)
   * - GET이라 CSRF 토큰·세션이 필요 없다(실측: 쿠키 없이도 200)
   *
   * - 명단에 없으면 빈 배열
   * - `ageFrom`/`ageTo`는 서버가 필수로 받는다(없으면 400) → 기본값은 전체 범위(`01`–`99`)
   * - GET이라 CSRF 토큰·세션이 필요 없다(실측: 쿠키 없이도 200)
   *
   * @param name 의원명 (목록의 발의자 표기와 같은 한글 이름)
   * @param ageFrom 대수 시작 (기본값 `01`)
   * @param ageTo 대수 끝 (기본값 `99`)
   */
  public async findRepresentCandidates(
    name: string,
    ageFrom?: string | number,
    ageTo?: string | number,
  ): Promise<ILikmsRepresentCandidate[]> {
    const normalized = name.trim();
    if (!normalized) {
      throw new Error('represent name is required');
    }

    const url = new URL(Config.LIKMS_SAME_NM_POPUP_URL, Config.LIKMS_DOMAIN);
    url.searchParams.set('memName', normalized);
    url.searchParams.set('ageFrom', String(ageFrom ?? '01'));
    url.searchParams.set('ageTo', String(ageTo ?? '99'));
    url.searchParams.set('classId', 'bill');

    const html = await this.httpClient.get(url);
    return this.parser.parseSameNameCandidates(html);
  }

  /**
   * 대수 범위의 **소관위원회 목록**을 조회합니다 (`/bi/bill/sch/findAgeCmt.do`).
   *
   * 검색 파라미터 `ageCmtId`는 이름이 아니라 코드를 받으므로, 이름밖에 모를 때
   * 이 메서드로 코드를 확인한다. 위원회 구성은 대수마다 달라지므로 범위를 좁혀
   * 조회한다(실측: `ageFrom=22&ageTo=22` → 22대 25건). 범위를 주지 않으면 전체
   * 대수를 합친 목록을 주며, 이때는 같은 이름이 코드별로 나뉘어
   * `보건복지위원회(18대~22대)`처럼 대수 꼬리표가 붙는다.
   *
   * - `ageFrom`/`ageTo`는 **둘 다** 줘야 범위가 적용된다(한 쪽만 주면 서버가 무시하므로 예외).
   * - 브라우저와 같은 GET이며 CSRF 토큰·세션이 필요 없다(실측: 쿠키 없이 200).
   * - 응답이 JSON이 아니면 빈 배열(예외 없음), 네트워크 오류는 전파한다.
   */
  public async findCommittees(
    ageFrom?: string | number,
    ageTo?: string | number,
  ): Promise<ILikmsCommittee[]> {
    const from = ageFrom === undefined ? '' : String(ageFrom).trim();
    const to = ageTo === undefined ? '' : String(ageTo).trim();
    if ((from && !to) || (!from && to)) {
      throw new Error('ageFrom and ageTo are required together');
    }

    const url = new URL(Config.LIKMS_FIND_AGE_CMT_URL, Config.LIKMS_DOMAIN);
    if (from && to) {
      url.searchParams.set('ageFrom', from);
      url.searchParams.set('ageTo', to);
    }

    return this.parser.parseCommittees(await this.httpClient.get(url));
  }

  /**
   * 계류의안 목록 조각 HTML을 AJAX(POST)로 반환합니다.
   *
   * 브라우저와 동일하게 세션 페이지의 숨김 폼 필드를 본문 기본값으로 보내고,
   * CSRF 토큰을 `X-CSRF-TOKEN` 헤더로 전송합니다. 토큰이 만료된 경우
   * 세션을 다시 발급받아 1회 재시도합니다.
   */
  public async getStateListHTML(query: ILikmsStateQuery = {}): Promise<string> {
    const stateId = query.stateId ?? 'mooring';
    const url = new URL(Config.LIKMS_STATE_SEARCH_URL, Config.LIKMS_DOMAIN);
    const hadSession = this.session !== null;

    const run = async (): Promise<string> => {
      const session = await this.ensureSession(stateId);
      return this.httpClient.post(
        url,
        this.buildSearchBody(query, session.formParams),
        { [Config.LIKMS_CSRF_HEADER]: session.token },
      );
    };

    try {
      return await run();
    } catch (error) {
      // 세션/CSRF 토큰이 거부된 경우에만 새로 발급받아 1회 재시도한다.
      // (네트워크 장애로 실패했을 때 불필요한 추가 요청을 만들지 않는다.)
      if (!hadSession || !this.isSessionRejection(error)) {
        throw error;
      }
      this.session = null;
      return run();
    }
  }

  /** HttpClient가 세션/CSRF 거부(401·403)로 실패했는지 판별합니다. */
  private isSessionRejection(error: unknown): boolean {
    const message = error instanceof Error ? error.message : '';
    return /\b(401|403)\b/.test(message);
  }

  /** 목록 조각 HTML에서 계류의안 검색 결과를 파싱하여 반환합니다. */
  public parseList(html: string): ILikmsStateSearchResult {
    return this.parser.parseList(html);
  }

  /**
   * `hasProposalReason`인 법안의 제안이유를 의안상세에서 조회해 `proposalReason`에 채웁니다.
   *
   * 목록 HTML에는 제안이유 본문이 없어 건마다 2회(상세 페이지 + `billInfo.do`) 요청이 든다.
   * `hasProposalReason`가 false인 건은 조회하지 않고, 조회·파싱에 실패한 건은 기존 값
   * (`null`)을 유지하며 예외를 던지지 않는다.
   *
   * @param items 보정할 목록 (입력 배열은 변경하지 않는다)
   * @param options `delayMs`(기본 500)·`concurrency`(기본 1)로 요청 속도를 조절한다.
   * @returns 보정된 복사본 배열
   */
  public async hydrateProposalReasons(
    items: ILikmsStateBillItem[],
    options?: IBulkOptions,
  ): Promise<ILikmsStateBillItem[]> {
    const hydrated = items.map((item) => ({ ...item }));
    const targets = hydrated.filter((item) => item.hasProposalReason);
    if (targets.length === 0) {
      return hydrated;
    }

    const delayMs = Math.max(0, options?.delayMs ?? this.hydrateDelayMs);
    const concurrency = Math.max(
      1,
      options?.concurrency ?? this.hydrateConcurrency,
    );

    for (let start = 0; start < targets.length; start += concurrency) {
      if (start > 0 && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }

      const chunk = targets.slice(start, start + concurrency);
      await Promise.all(
        chunk.map(async (item) => {
          if (!item.billId) {
            return;
          }

          try {
            const proposalReason = await this.detailCrawler.getProposalReason(
              item.billId,
            );
            if (proposalReason) {
              item.proposalReason = proposalReason;
            }
          } catch {
            // 보정 실패 시 기존 값(null) 유지
          }
        }),
      );
    }

    return hydrated;
  }

  /**
   * 계류의안을 검색합니다. 필터를 지정하지 않으면 1페이지를 반환합니다.
   * `hydrateProposalReason`이 켜져 있으면 `hasProposalReason` 건의 제안이유도 채웁니다.
   */
  public async search(
    query: ILikmsStateQuery = {},
  ): Promise<ILikmsStateSearchResult> {
    const html = await this.getStateListHTML(query);
    const result = this.parser.parseList(html);
    if (!this.hydrateProposalReason) {
      return result;
    }

    return {
      ...result,
      items: await this.hydrateProposalReasons(result.items),
    };
  }

  /** 특정 페이지의 계류의안 목록을 반환합니다. */
  public async getPage(
    pageIndex: number,
    query: Omit<ILikmsStateQuery, 'pageIndex'> = {},
  ): Promise<ILikmsStateBillItem[]> {
    const result = await this.search({ ...query, pageIndex });
    return result.items;
  }

  private async *_getAllPagesImpl(
    query: Omit<ILikmsStateQuery, 'pageIndex'>,
    options: IBulkOptions,
  ): AsyncGenerator<ILikmsStateSearchResult> {
    const delayMs = options.delayMs ?? 500;
    const concurrency = Math.max(1, options.concurrency ?? 1);

    const first = await this.search({ ...query, pageIndex: 1 });
    yield first;

    if (first.totalPages <= 1 || first.items.length === 0) return;

    const maxPages = Math.min(
      first.totalPages,
      options.maxPages ?? first.totalPages,
    );

    for (let start = 2; start <= maxPages; start += concurrency) {
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
      const end = Math.min(start + concurrency - 1, maxPages);
      const pageNums = Array.from(
        { length: end - start + 1 },
        (_, i) => start + i,
      );
      const results = await Promise.all(
        pageNums.map((p) => this.search({ ...query, pageIndex: p })),
      );
      for (const result of results) {
        yield result;
        if (result.items.length === 0) return;
      }
    }
  }

  /**
   * 계류의안 전체 페이지를 순차적으로 yield하는 async generator.
   * `IBulkOptions`로 딜레이·동시성·최대 페이지를 조절할 수 있습니다.
   */
  public getAllPages(
    query?: Omit<ILikmsStateQuery, 'pageIndex'>,
    options?: IBulkOptions,
  ): AsyncGenerator<ILikmsStateSearchResult> {
    return this._getAllPagesImpl(query ?? {}, options ?? {});
  }

  /**
   * 심사진행단계가 '접수'(위원회 회부 이전)인 항목만 남깁니다.
   *
   * 국민참여입법센터 `searchPending`(`rslRsltNmL=900101` '발의')에 대응하는 판정이다.
   * 실측(2026-10-13)에서 likms 계류의안의 '접수' 항목과 NSM '발의' 결과가 같은
   * 부분집합임을 확인했다(표본 13건 중 12건 일치).
   */
  public filterPending(items: ILikmsStateBillItem[]): ILikmsStateBillItem[] {
    return items.filter(
      (item) => item.progressStatus === Config.LIKMS_PENDING_PROGRESS_STATUS,
    );
  }

  /**
   * 접수(위원회 회부 이전) 법안을 페이지 단위로 순차적으로 yield합니다.
   *
   * likms 서버에는 심사진행상태를 좁히는 **유효한** 필터가 없다(파라미터 `srngPrgrsSttsCd`는
   * 존재하지만 값을 알 수 없다 — `agent_memories/findings` 참조). 그래서 목록을 앞에서부터
   * 스캔하며 클라이언트에서 걸러낸다. 따라서:
   * - 접수 항목이 없는 페이지는 건너뛰므로 `currentPage`는 원본 페이지 번호가 아니다.
   * - `items`는 접수 항목만이고, `total`/`totalPages`는 전체(접수 포함) 기준 원본 값이다.
   *
   * 스캔 기본 페이지 크기는 100건(사이트 지원 값)이라 `pageSize`를 주지 않으면 요청 수가 준다.
   * 스캔 범위는 `options.maxPages`로 제한한다.
   */
  public async *getAllPendingPages(
    query: Omit<ILikmsStateQuery, 'pageIndex'> = {},
    options: IBulkOptions = {},
  ): AsyncGenerator<ILikmsStateSearchResult> {
    for await (const page of this.getAllPages(
      { ...query, pageSize: query.pageSize ?? 100 },
      options,
    )) {
      const items = this.filterPending(page.items);
      if (items.length === 0) {
        continue;
      }
      yield { ...page, items };
    }
  }

  /**
   * 접수(위원회 회부 이전) 법안이 있는 첫 페이지를 반환합니다.
   *
   * 서버 필터가 없어 앞에서부터 스캔하며, `options.maxPages`(기본 10) 안에서 찾지 못하면
   * 빈 결과(`items: []`)를 반환한다. `searchPending`을 페이지 단위로 순회하려면
   * `getAllPendingPages`를 쓴다(페이지 번호가 원본과 다르므로 `pageIndex`로 건너뛸 수 없다).
   */
  public async searchPending(
    query: Omit<ILikmsStateQuery, 'pageIndex'> = {},
    options: IBulkOptions = {},
  ): Promise<ILikmsStateSearchResult> {
    for await (const page of this.getAllPendingPages(query, {
      ...options,
      maxPages: options.maxPages ?? 10,
    })) {
      return page;
    }
    return { total: 0, totalPages: 0, currentPage: 1, items: [] };
  }
}
