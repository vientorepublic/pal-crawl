import { URL } from 'url';
import { Config } from './config';
import { HttpClient } from './http-client';
import { PalParser, type ITableData, type IContentData } from './parser';

export type { IAttachment, ITableData, IContentData } from './parser';

export interface PalCrawlConfig {
  userAgent?: string;
  timeout?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
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
}
