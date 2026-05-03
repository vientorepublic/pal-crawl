import { URL } from 'url';
import { Config } from './config';
import { HttpClient } from './http-client';
import {
  PalParser,
  type ITableData,
  type IContentData,
  type ISearchResult,
} from './parser';

export type {
  IAttachment,
  ITableData,
  IContentData,
  ISearchResult,
} from './parser';

export interface PalCrawlConfig {
  userAgent?: string;
  timeout?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
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

export class PalCrawl {
  private readonly httpClient: HttpClient;
  private readonly parser: PalParser;

  constructor(config?: PalCrawlConfig) {
    this.httpClient = new HttpClient({
      userAgent: config?.userAgent ?? Config.UserAgent,
      timeout: config?.timeout ?? 10000,
      retryCount: config?.retryCount ?? 3,
      customHeaders: config?.customHeaders ?? {},
    });
    this.parser = new PalParser();
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

  public async getPalHTML(): Promise<string> {
    const url = new URL(Config.LIST_URL, Config.DOMAIN);
    return this.httpClient.get(url);
  }

  public parseTable(html: string): ITableData[] {
    return this.parser.parseTable(html);
  }

  public parseContent(html: string): IContentData {
    return this.parser.parseContent(html);
  }

  public async get(): Promise<ITableData[]> {
    const html = await this.getPalHTML();
    return this.parser.parseTable(html);
  }

  public async getContentHTML(id: string): Promise<string> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('id is required');
    }

    const url = new URL(Config.CONTENT_URL, Config.DOMAIN);
    url.searchParams.set('lgsltPaid', normalizedId);
    // Keep compatibility with currently used query key on the website.
    url.searchParams.set('lgsltPaId', normalizedId);

    return this.httpClient.get(url);
  }

  public async getContent(id: string): Promise<IContentData> {
    const html = await this.getContentHTML(id);
    return this.parser.parseContent(html);
  }

  public async getDoneHTML(): Promise<string> {
    const url = new URL(Config.DONE_LIST_URL, Config.DOMAIN);
    return this.httpClient.get(url);
  }

  public async getDone(): Promise<ITableData[]> {
    const html = await this.getDoneHTML();
    return this.parser.parseTable(html);
  }

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

  public async getDoneContent(id: string): Promise<IContentData> {
    const html = await this.getDoneContentHTML(id);
    return this.parser.parseContent(html);
  }

  // ── Search / Filter ──────────────────────────────────────────────────────────

  /** Fetch ongoing notices with optional filters and return parsed result with metadata. */
  public async search(query: ISearchQuery = {}): Promise<ISearchResult> {
    const url = this.buildListUrl(Config.LIST_URL, { pageIndex: 1, ...query });
    const html = await this.httpClient.get(url);
    return this.parser.parseSearchResult(html);
  }

  /** Fetch done notices with optional filters and return parsed result with metadata. */
  public async searchDone(query: ISearchQuery = {}): Promise<ISearchResult> {
    const url = this.buildListUrl(Config.DONE_LIST_URL, {
      pageIndex: 1,
      ...query,
    });
    const html = await this.httpClient.get(url);
    return this.parser.parseSearchResult(html);
  }

  // ── Explicit page access ─────────────────────────────────────────────────────

  /** Fetch a specific page of ongoing notices. */
  public async getPage(
    pageIndex: number,
    pageUnit?: number,
  ): Promise<ITableData[]> {
    const result = await this.search({ pageIndex, pageUnit });
    return result.items;
  }

  /** Fetch a specific page of done notices. */
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
   * Async generator that yields every page of ongoing notices.
   * Respects `IBulkOptions` for rate-limiting and concurrency.
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
   * Async generator that yields every page of done notices.
   * Respects `IBulkOptions` for rate-limiting and concurrency.
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
