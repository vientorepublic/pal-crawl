import * as https from 'https';
import { URL } from 'url';
import * as cheerio from 'cheerio';
import { Config } from './config';

export interface ITableData {
  num: number;
  subject: string;
  proposerCategory: string;
  committee: string;
  numComments: number;
  link: string;
}

export class PalCrawl {
  public async getPalHTML(): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(Config.URL, Config.DOMAIN);
      const options = {
        headers: {
          'User-Agent': Config.UserAgent,
        },
      };

      https
        .get(url, options, (res) => {
          if (
            res.statusCode &&
            (res.statusCode < 200 || res.statusCode >= 300)
          ) {
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
        })
        .on('error', (err) => {
          reject(err);
        });
    });
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
        output.push({
          num,
          subject,
          proposerCategory,
          committee,
          numComments,
          link: boardLink,
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
