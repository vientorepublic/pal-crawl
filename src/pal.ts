import { URL } from 'url';
import puppeteer, { type Browser } from 'puppeteer';
import { Config } from './config';
import { HttpClient } from './http-client';
import {
  PalParser,
  NsmLmStsParser,
  type ITableData,
  type IContentData,
  type ISearchResult,
  type INsmBillItem,
  type INsmBillDetail,
  type INsmSearchResult,
} from './parser';

export type {
  IAttachment,
  ITableData,
  IContentData,
  ISearchResult,
  INsmAttachment,
  INsmBillItem,
  INsmBillDetail,
  INsmSearchResult,
} from './parser';

export interface ScreenshotOptions {
  enabled?: boolean;
  fullPage?: boolean;
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg';
  quality?: number; // for jpeg
}

export interface PalCrawlConfig {
  userAgent?: string;
  timeout?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
  screenshot?: ScreenshotOptions;
}

export interface ISearchQuery {
  pageIndex?: number;
  pageUnit?: number;
  committeeId?: string;
  billName?: string;
  represent?: string;
  proposers?: string;
  ppslRsonMnCn?: string;
  sortCol?:
    | 'BILL_NO'
    | 'BILL_NAME'
    | 'CURR_COMMITTEE'
    | 'OPN_CNT'
    | 'LGSLT_PA_RG_DT';
  sortGbn?: 'DESC' | 'ASC';
  fromAge?: number;
  toAge?: number;
  billNo?: string;
}

export interface IBulkOptions {
  delayMs?: number;
  concurrency?: number;
  maxPages?: number;
}

/**
 * Puppeteer 기반 스크린샷 기능을 공유하는 베이스 클래스.
 * `PalCrawl`과 `NsmLmSts` 양쪽에서 상속합니다.
 */
export abstract class ScreenshotBase {
  private browser: Browser | null = null;
  protected screenshotConfig: ScreenshotOptions;

  protected constructor(screenshot?: ScreenshotOptions) {
    this.screenshotConfig = {
      enabled: screenshot?.enabled ?? false,
      fullPage: screenshot?.fullPage ?? true,
      width: screenshot?.width ?? 1920,
      height: screenshot?.height ?? 1080,
      format: screenshot?.format ?? 'png',
      quality: screenshot?.quality ?? 80,
    };
  }

  /** Puppeteer 브라우저 인스턴스를 초기화합니다. */
  public async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  /** Puppeteer 브라우저 인스턴스를 종료하고 리소스를 해제합니다. */
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /** 주어진 URL의 스크린샷을 Buffer로 반환합니다. */
  public async takeScreenshot(urlStr: string): Promise<Buffer> {
    if (!this.screenshotConfig.enabled) {
      throw new Error(
        'Screenshot feature is not enabled. Enable it in the config.',
      );
    }

    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();
    try {
      await page.setViewport({
        width: this.screenshotConfig.width ?? 1920,
        height: this.screenshotConfig.height ?? 1080,
      });

      await page.goto(urlStr, { waitUntil: 'networkidle0', timeout: 30000 });

      const screenshotBuffer = await page.screenshot({
        fullPage: this.screenshotConfig.fullPage ?? true,
        type: this.screenshotConfig.format as 'png' | 'jpeg',
        quality:
          this.screenshotConfig.format === 'jpeg'
            ? (this.screenshotConfig.quality ?? 80)
            : undefined,
      });

      return screenshotBuffer;
    } finally {
      await page.close();
    }
  }

  /** 스크린샷 설정을 업데이트합니다. */
  public updateScreenshotConfig(config: Partial<ScreenshotOptions>): void {
    this.screenshotConfig = {
      ...this.screenshotConfig,
      ...config,
    };
  }
}

export class PalCrawl extends ScreenshotBase {
  private readonly httpClient: HttpClient;
  private readonly parser: PalParser;

  constructor(config?: PalCrawlConfig) {
    super(config?.screenshot);
    this.httpClient = new HttpClient({
      userAgent: config?.userAgent ?? Config.UserAgent,
      timeout: config?.timeout ?? 10000,
      retryCount: config?.retryCount ?? 3,
      customHeaders: config?.customHeaders ?? {},
    });
    this.parser = new PalParser();
  }

  /** 진행 중인 입법예고 목록 페이지 스크린샷을 반환합니다. */
  public async getPalScreenshot(): Promise<Buffer> {
    const url = new URL(Config.LIST_URL, Config.DOMAIN);
    return this.takeScreenshot(url.toString());
  }

  /** 진행 중인 입법예고의 특정 법률안 상세 페이지 스크린샷을 반환합니다. */
  public async getContentScreenshot(id: string): Promise<Buffer> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('id is required');
    }

    const url = new URL(Config.CONTENT_URL, Config.DOMAIN);
    url.searchParams.set('lgsltPaid', normalizedId);
    url.searchParams.set('lgsltPaId', normalizedId);

    return this.takeScreenshot(url.toString());
  }

  /** 완료된 입법예고 목록 페이지 스크린샷을 반환합니다. */
  public async getDoneScreenshot(): Promise<Buffer> {
    const url = new URL(Config.DONE_LIST_URL, Config.DOMAIN);
    return this.takeScreenshot(url.toString());
  }

  /** 완료된 입법예고의 특정 법률안 상세 페이지 스크린샷을 반환합니다. */
  public async getDoneContentScreenshot(id: string): Promise<Buffer> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('id is required');
    }

    const url = new URL(Config.DONE_CONTENT_URL, Config.DOMAIN);
    url.searchParams.set('lgsltPaid', normalizedId);
    url.searchParams.set('lgsltPaId', normalizedId);

    return this.takeScreenshot(url.toString());
  }

  private buildListUrl(base: string, query: ISearchQuery): URL {
    const url = new URL(base, Config.DOMAIN);
    const entries: Array<[string, string | number | undefined]> = [
      ['pageIndex', query.pageIndex],
      ['pageUnit', query.pageUnit],
      ['committeeId', query.committeeId],
      ['billName', query.billName],
      ['represent', query.represent],
      ['proposers', query.proposers],
      ['ppslRsonMnCn', query.ppslRsonMnCn],
      ['sortCol', query.sortCol],
      ['sortGbn', query.sortGbn],
      ['fromAge', query.fromAge],
      ['toAge', query.toAge],
      ['billNo', query.billNo],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  /** 진행 중인 입법예고 목록 페이지의 HTML을 반환합니다. */
  public async getPalHTML(): Promise<string> {
    const url = new URL(Config.LIST_URL, Config.DOMAIN);
    return this.httpClient.get(url);
  }

  /** HTML에서 법률안 목록을 파싱하여 반환합니다. */
  public parseTable(html: string): ITableData[] {
    return this.parser.parseTable(html);
  }

  /** HTML에서 법률안 상세 내용을 파싱하여 반환합니다. */
  public parseContent(html: string): IContentData {
    return this.parser.parseContent(html);
  }

  /** 진행 중인 입법예고 목록의 첫 페이지를 반환합니다. */
  public async get(): Promise<ITableData[]> {
    const html = await this.getPalHTML();
    return this.parser.parseTable(html);
  }

  /** ID로 진행 중인 입법예고의 법률안 상세 페이지 HTML을 반환합니다. */
  public async getContentHTML(id: string): Promise<string> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('id is required');
    }

    const url = new URL(Config.CONTENT_URL, Config.DOMAIN);
    url.searchParams.set('lgsltPaid', normalizedId);
    // 사이트에서 현재 사용 중인 쿼리 키 호환성 유지
    url.searchParams.set('lgsltPaId', normalizedId);

    return this.httpClient.get(url);
  }

  /** ID로 진행 중인 입법예고의 법률안 상세 정보를 조회합니다. */
  public async getContent(id: string): Promise<IContentData> {
    const html = await this.getContentHTML(id);
    return this.parser.parseContent(html);
  }

  /** 완료된 입법예고 목록 페이지의 HTML을 반환합니다. */
  public async getDoneHTML(): Promise<string> {
    const url = new URL(Config.DONE_LIST_URL, Config.DOMAIN);
    return this.httpClient.get(url);
  }

  /** 완료된 입법예고 목록의 첫 페이지를 반환합니다. */
  public async getDone(): Promise<ITableData[]> {
    const html = await this.getDoneHTML();
    return this.parser.parseTable(html);
  }

  /** ID로 완료된 입법예고의 법률안 상세 페이지 HTML을 반환합니다. */
  public async getDoneContentHTML(id: string): Promise<string> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('id is required');
    }

    const url = new URL(Config.DONE_CONTENT_URL, Config.DOMAIN);
    url.searchParams.set('lgsltPaid', normalizedId);
    url.searchParams.set('lgsltPaId', normalizedId);

    return this.httpClient.get(url);
  }

  /** ID로 완료된 입법예고의 법률안 상세 정보를 조회합니다. */
  public async getDoneContent(id: string): Promise<IContentData> {
    const html = await this.getDoneContentHTML(id);
    return this.parser.parseContent(html);
  }

  // ── Search / Filter ──────────────────────────────────────────────────────────

  /** 진행 중인 입법예고를 검색합니다. 필터를 지정하지 않으면 1페이지를 반환합니다. */
  public async search(query: ISearchQuery = {}): Promise<ISearchResult> {
    const url = this.buildListUrl(Config.LIST_URL, { pageIndex: 1, ...query });
    const html = await this.httpClient.get(url);
    return this.parser.parseSearchResult(html);
  }

  /** 완료된 입법예고를 검색합니다. 필터를 지정하지 않으면 1페이지를 반환합니다. */
  public async searchDone(query: ISearchQuery = {}): Promise<ISearchResult> {
    const url = this.buildListUrl(Config.DONE_LIST_URL, {
      pageIndex: 1,
      ...query,
    });
    const html = await this.httpClient.get(url);
    return this.parser.parseSearchResult(html);
  }

  // ── Explicit page access ─────────────────────────────────────────────────────

  /** 진행 중인 입법예고의 특정 페이지 목록을 반환합니다. */
  public async getPage(
    pageIndex: number,
    pageUnit?: number,
  ): Promise<ITableData[]> {
    const result = await this.search({ pageIndex, pageUnit });
    return result.items;
  }

  /** 완료된 입법예고의 특정 페이지 목록을 반환합니다. */
  public async getDonePage(
    pageIndex: number,
    pageUnit?: number,
  ): Promise<ITableData[]> {
    const result = await this.searchDone({ pageIndex, pageUnit });
    return result.items;
  }

  // ── Bulk / pagination helpers ────────────────────────────────────────────────

  private async *_getAllPagesImpl(
    searchFn: (query: ISearchQuery) => Promise<ISearchResult>,
    query: Omit<ISearchQuery, 'pageIndex'>,
    options: IBulkOptions,
  ): AsyncGenerator<ISearchResult> {
    const delayMs = options.delayMs ?? 500;
    const concurrency = Math.max(1, options.concurrency ?? 1);

    const first = await searchFn({ ...query, pageIndex: 1 });
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
        pageNums.map((p) => searchFn({ ...query, pageIndex: p })),
      );
      for (const result of results) {
        yield result;
        if (result.items.length === 0) return;
      }
    }
  }

  /**
   * 진행 중인 입법예고 전체 페이지를 순차적으로 yield하는 async generator.
   * `IBulkOptions`로 딜레이·동시성·최대 페이지를 조절할 수 있습니다.
   */
  public getAllPages(
    query?: Omit<ISearchQuery, 'pageIndex'>,
    options?: IBulkOptions,
  ): AsyncGenerator<ISearchResult> {
    return this._getAllPagesImpl(
      (q) => this.search(q),
      query ?? {},
      options ?? {},
    );
  }

  /**
   * 완료된 입법예고 전체 페이지를 순차적으로 yield하는 async generator.
   * `IBulkOptions`로 딜레이·동시성·최대 페이지를 조절할 수 있습니다.
   */
  public getAllDonePages(
    query?: Omit<ISearchQuery, 'pageIndex'>,
    options?: IBulkOptions,
  ): AsyncGenerator<ISearchResult> {
    return this._getAllPagesImpl(
      (q) => this.searchDone(q),
      query ?? {},
      options ?? {},
    );
  }
}

// ── 국민참여입법센터 국회입법현황 ─────────────────────────────────────────────

/**
 * 국회현황 코드
 * - 900101: 발의 (위원회 회부 이전 대기 상태 포함)
 * - 900102: 위원회 회부
 * - 900103: 위원회 상정
 * - 900104: 위원회 법안소위
 * - 900105: 위원회 전체회의
 * - 900106: 법사위 심사
 * - 900107: 본회의 심의
 * - 900108: 정부이송
 * - 900109: 공포
 */
export type NsmProgressStatus =
  | '900101'
  | '900102'
  | '900103'
  | '900104'
  | '900105'
  | '900106'
  | '900107'
  | '900108'
  | '900109';

/**
 * 발의구분 코드
 * - 900201: 정부
 * - 900202: 의원
 * - 900203: 위원장
 */
export type NsmProposerType = '900201' | '900202' | '900203';

/**
 * 의결현황 코드
 * - 902911: 수정가결
 * - 902912: 원안가결
 * - 902913: 부결
 * - 902914: 대안반영폐기
 * - 902915: 폐기
 * - 902916: 임기만료폐기
 * - 902917: 철회
 */
export type NsmResolutionStatus =
  | '902911'
  | '902912'
  | '902913'
  | '902914'
  | '902915'
  | '902916'
  | '902917';

export interface INsmSearchQuery {
  pageIndex?: number;
  /** 페이지당 건수 (10 | 20 | 50 | 100) */
  pageSize?: number;
  /** 제안대수 시작 (예: "22" → 제22대) */
  sugCd?: string;
  /** 제안대수 끝 */
  endSugCd?: string;
  /** 발의구분 */
  sgtCls?: NsmProposerType;
  /** 소관부처 코드 */
  cptOfiOrgCd?: string;
  /** 국회현황 */
  rslRsltNmL?: NsmProgressStatus;
  /** 의결현황 */
  rslRsltNmR?: NsmResolutionStatus;
  /** 상임위 (예: "법제사법위원회") */
  scCptPpostCmt?: string;
  /** 제안일자 시작 (YYYY-MM-DD) */
  searchStDtNew?: string;
  /** 제안일자 종료 (YYYY-MM-DD) */
  searchEdDtNew?: string;
  /** 제안자 */
  scPpsUsr?: string;
  /** 규제 신설·강화 해당 여지 법안만 조회 */
  issLawitmYn?: 'Y';
  /** 추진일자 시작 (YYYY-MM-DD) */
  stDt?: string;
  /** 추진일자 종료 (YYYY-MM-DD) */
  edDt?: string;
  /** 의안번호 또는 의안명 */
  scBlNmSct?: string;
  sortCol?: string;
  sortOrder?: 'DESC' | 'ASC';
}

export class NsmLmSts extends ScreenshotBase {
  private readonly httpClient: HttpClient;
  private readonly parser: NsmLmStsParser;

  constructor(config?: PalCrawlConfig) {
    super(config?.screenshot);
    this.httpClient = new HttpClient({
      userAgent: config?.userAgent ?? Config.UserAgent,
      timeout: config?.timeout ?? 10000,
      retryCount: config?.retryCount ?? 3,
      customHeaders: config?.customHeaders ?? {},
    });
    this.parser = new NsmLmStsParser();
  }

  private buildListUrl(query: INsmSearchQuery): URL {
    const url = new URL(Config.NSM_LIST_URL, Config.NSM_DOMAIN);
    const entries: Array<[string, string | number | undefined]> = [
      ['pageIndex', query.pageIndex],
      ['pageSize', query.pageSize],
      ['sugCd', query.sugCd],
      ['endSugCd', query.endSugCd],
      ['sgtCls', query.sgtCls],
      ['cptOfiOrgCd', query.cptOfiOrgCd],
      ['rslRsltNmL', query.rslRsltNmL],
      ['rslRsltNmR', query.rslRsltNmR],
      ['scCptPpostCmt', query.scCptPpostCmt],
      ['searchStDtNew', query.searchStDtNew],
      ['searchEdDtNew', query.searchEdDtNew],
      ['scPpsUsr', query.scPpsUsr],
      ['issLawitmYn', query.issLawitmYn],
      ['stDt', query.stDt],
      ['edDt', query.edDt],
      ['sortCol', query.sortCol],
      ['sortOrder', query.sortOrder],
    ];
    if (query.scBlNmSct) {
      url.searchParams.set('scBlNm', 'scBlNm_blNm');
      entries.push(['scBlNmSct', query.scBlNmSct]);
    }
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  /** 목록 페이지 HTML 반환 */
  public async getListHTML(query: INsmSearchQuery = {}): Promise<string> {
    const url = this.buildListUrl({ pageIndex: 1, ...query });
    return this.httpClient.get(url);
  }

  /** HTML에서 법안 목록 검색 결과를 파싱하여 반환합니다. */
  public parseList(html: string): INsmSearchResult {
    return this.parser.parseList(html);
  }

  /** HTML에서 법안 상세 정보를 파싱하여 반환합니다. */
  public parseDetail(html: string): INsmBillDetail {
    return this.parser.parseDetail(html);
  }

  /** 목록 검색 (필터 지원) */
  public async search(query: INsmSearchQuery = {}): Promise<INsmSearchResult> {
    const html = await this.getListHTML(query);
    return this.parser.parseList(html);
  }

  /**
   * 위원회 회부 이전 발의 상태인 법안만 조회 (rslRsltNmL=900101 고정).
   * 소관부처·제안대수·날짜 등 나머지 필터는 그대로 적용됩니다.
   */
  public async searchPending(
    query: Omit<INsmSearchQuery, 'rslRsltNmL'> = {},
  ): Promise<INsmSearchResult> {
    return this.search({ ...query, rslRsltNmL: '900101' });
  }

  /** 상세 페이지 HTML 반환 */
  public async getDetailHTML(billNo: string): Promise<string> {
    const normalized = billNo.trim();
    if (!normalized) throw new Error('billNo is required');
    const url = new URL(
      `${Config.NSM_LIST_URL}/${normalized}/detailRP`,
      Config.NSM_DOMAIN,
    );
    return this.httpClient.get(url);
  }

  /** 법안 상세 정보 조회 */
  public async getDetail(billNo: string): Promise<INsmBillDetail> {
    const html = await this.getDetailHTML(billNo);
    return this.parser.parseDetail(html);
  }

  /** 특정 페이지의 법안 목록 조회 */
  public async getPage(
    pageIndex: number,
    query: Omit<INsmSearchQuery, 'pageIndex'> = {},
  ): Promise<INsmBillItem[]> {
    const result = await this.search({ ...query, pageIndex });
    return result.items;
  }

  private async *_getAllPagesImpl(
    query: Omit<INsmSearchQuery, 'pageIndex'>,
    options: IBulkOptions,
  ): AsyncGenerator<INsmSearchResult> {
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
   * 전체 페이지를 순차적으로 yield하는 async generator.
   * `IBulkOptions`로 딜레이·동시성·최대 페이지를 조절할 수 있습니다.
   */
  public getAllPages(
    query?: Omit<INsmSearchQuery, 'pageIndex'>,
    options?: IBulkOptions,
  ): AsyncGenerator<INsmSearchResult> {
    return this._getAllPagesImpl(query ?? {}, options ?? {});
  }

  /**
   * 발의 상태(위원회 회부 전) 법안 전체를 페이지 단위로 yield합니다.
   */
  public getAllPendingPages(
    query?: Omit<INsmSearchQuery, 'pageIndex' | 'rslRsltNmL'>,
    options?: IBulkOptions,
  ): AsyncGenerator<INsmSearchResult> {
    return this._getAllPagesImpl(
      { ...query, rslRsltNmL: '900101' },
      options ?? {},
    );
  }

  /** 국회입법현황 목록 페이지 스크린샷 */
  public async getNsmListScreenshot(
    query: Omit<INsmSearchQuery, 'pageIndex'> = {},
  ): Promise<Buffer> {
    const url = this.buildListUrl({ pageIndex: 1, ...query });
    return this.takeScreenshot(url.toString());
  }

  /** 법안 상세 페이지 스크린샷 */
  public async getDetailScreenshot(billNo: string): Promise<Buffer> {
    const normalized = billNo.trim();
    if (!normalized) throw new Error('billNo is required');
    const url = new URL(
      `${Config.NSM_LIST_URL}/${normalized}/detailRP`,
      Config.NSM_DOMAIN,
    );
    return this.takeScreenshot(url.toString());
  }
}
