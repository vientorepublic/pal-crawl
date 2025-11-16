import * as https from 'https';
import { URL } from 'url';
import * as cheerio from 'cheerio';
import { Config } from './config';

export interface PalCrawlConfig {
  userAgent?: string;
  timeout?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
}

export interface IAttachment {
  pdfFile: string;
  hwpFile: string;
}

export interface ITableData {
  num: number;
  subject: string;
  proposerCategory: string;
  committee: string;
  numComments: number;
  link: string;
  attachments: IAttachment;
}

export class PalCrawl {
  private userAgent: string;
  private timeout: number;
  private retryCount: number;
  private customHeaders: Record<string, string>;

  constructor(config?: PalCrawlConfig) {
    this.userAgent = config?.userAgent ?? Config.UserAgent;
    this.timeout = config?.timeout ?? 10000; // Default 10 seconds
    this.retryCount = config?.retryCount ?? 3; // Default 3 attempts
    this.customHeaders = config?.customHeaders ?? {};
  }

  private async makeRequest(): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(Config.URL, Config.DOMAIN);
      const headers = {
        'User-Agent': this.userAgent,
        ...this.customHeaders,
      };

      const options = {
        headers,
        timeout: this.timeout,
      };

      const req = https.get(url, options, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(
            new Error(
              `Invalid response: ${res.statusCode} ${res.statusMessage}`,
            ),
          );
          return;
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(this.timeout);
    });
  }

  public async getPalHTML(): Promise<string> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        return await this.makeRequest();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryCount) {
          // Exponential backoff before retrying
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  public parseTable(html: string): ITableData[] {
    const $ = cheerio.load(html);
    const body = $('body');
    const table = body.find('table > tbody > tr');
    const output: ITableData[] = [];
    table.map((i, el) => {
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
        const pdfFile = $(el)
          .find('td:nth-child(6) > a:nth-child(3)')
          .attr('href');
        const hwpFile = $(el)
          .find('td:nth-child(6) > a:nth-child(2)')
          .attr('href');
        const attachments: IAttachment = {
          pdfFile,
          hwpFile,
        };
        output.push({
          num,
          subject,
          proposerCategory,
          committee,
          numComments,
          link: boardLink,
          attachments,
        });
      }
    });
    return output;
  }

  public async get(): Promise<ITableData[]> {
    const html = await this.getPalHTML();
    const table = this.parseTable(html);
    return table;
  }
}
