import { URL } from 'url';
import * as cheerio from 'cheerio';
import { Config } from './config';
import { HttpClient } from './http-client';

export interface PalCrawlConfig {
  userAgent?: string;
  timeout?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
}

export interface IAttachment {
  pdfFile: string | null;
  hwpFile: string | null;
}

export interface ITableData {
  num: number;
  subject: string;
  proposerCategory: string;
  committee: string;
  numComments: number;
  link: string;
  contentId: string | null;
  attachments: IAttachment;
}

export interface IContentData {
  title: string;
  proposalReason: string | null;
}

export class PalCrawl {
  private readonly httpClient: HttpClient;

  constructor(config?: PalCrawlConfig) {
    this.httpClient = new HttpClient({
      userAgent: config?.userAgent ?? Config.UserAgent,
      timeout: config?.timeout ?? 10000,
      retryCount: config?.retryCount ?? 3,
      customHeaders: config?.customHeaders ?? {},
    });
  }

  public async getPalHTML(): Promise<string> {
    const url = new URL(Config.LIST_URL, Config.DOMAIN);
    return this.httpClient.get(url);
  }

  private extractContentId(link: string): string | null {
    try {
      const url = new URL(link, Config.DOMAIN);
      return (
        url.searchParams.get('lgsltPaId') ?? url.searchParams.get('lgsltPaid')
      );
    } catch {
      return null;
    }
  }

  public parseTable(html: string): ITableData[] {
    const $ = cheerio.load(html);
    const body = $('body');
    const table = body.find('table > tbody > tr');
    const output: ITableData[] = [];
    table.map((_i, el) => {
      const subject = $(el).find('td.td_block > a.board_subject').text().trim();
      if (subject) {
        const link = $(el).find('td.td_block > a.board_subject').attr('href');
        const numComments = Number(
          $(el).find('td:nth-child(8)').text().replace(',', '').trim(),
        );
        const proposerCategory = $(el).find('td:nth-child(3)').text().trim();
        const committee = $(el).find('td:nth-child(4)').text().trim();
        const num = Number($(el).find('td:nth-child(1)').text().trim());
        let boardLink = '';
        if (link) {
          boardLink = Config.DOMAIN + link;
        }
        const pdfFile =
          $(el).find('td:nth-child(6) > a:nth-child(3)').attr('href') ?? null;
        const hwpFile =
          $(el).find('td:nth-child(6) > a:nth-child(2)').attr('href') ?? null;
        const attachments: IAttachment = {
          pdfFile,
          hwpFile,
        };
        const contentId = boardLink ? this.extractContentId(boardLink) : null;
        output.push({
          num,
          subject,
          proposerCategory,
          committee,
          numComments,
          link: boardLink,
          contentId,
          attachments,
        });
      }
    });
    return output;
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  public parseContent(html: string): IContentData {
    const $ = cheerio.load(html);

    const title = this.normalizeText(
      $('.legislation-heading h3').first().text() || $('h3').first().text(),
    );

    const sections: Record<string, string> = {};

    $('.card-wrap .item').each((_, item) => {
      const heading = this.normalizeText($(item).find('h4').first().text());
      if (!heading) {
        return;
      }

      const descText = this.normalizeText($(item).find('.desc').first().text());
      if (!descText) {
        sections[heading] = '';
        return;
      }

      const normalizedHeading = heading.replace(/\s+/g, '');
      const lines = descText.split('\n').filter(Boolean);
      const firstLine = lines[0]?.replace(/\s+/g, '') ?? '';

      // The first line sometimes repeats the section heading itself.
      const content =
        firstLine === normalizedHeading
          ? this.normalizeText(lines.slice(1).join('\n'))
          : descText;

      sections[heading] = content;
    });

    const proposalReasonRaw =
      Object.entries(sections).find(([heading]) =>
        heading.replace(/\s+/g, '').includes('제안이유및주요내용'),
      )?.[1] ?? null;

    const proposalReason = proposalReasonRaw
      ? this.normalizeText(proposalReasonRaw)
      : null;

    return {
      title,
      proposalReason,
    };
  }

  public async get(): Promise<ITableData[]> {
    const html = await this.getPalHTML();
    const table = this.parseTable(html);
    return table;
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
    return this.parseContent(html);
  }
}
