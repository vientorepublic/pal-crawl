import { URL } from 'url';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { Config } from './config';

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
  billNumber: string | null;
  proposer: string | null;
  proposalDate: string | null;
  committee: string | null;
  referralDate: string | null;
  noticePeriod: string | null;
  proposalSession: string | null;
}

export interface ISearchResult {
  total: number;
  totalPages: number;
  currentPage: number;
  items: ITableData[];
}

export class PalParser {
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

  /** HTML에서 입법예고 목록 테이블을 파싱하여 반환합니다. */
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

  /** HTML에서 목록 검색 결과(페이지 정보 + 아이템)를 파싱하여 반환합니다. */
  public parseSearchResult(html: string): ISearchResult {
    const $ = cheerio.load(html);
    const items = this.parseTable(html);

    let total = 0;
    let currentPage = 1;
    let totalPages = 0;

    $('span').each((_, el) => {
      const text = $(el).text();
      const m = text.match(/건 \((\d+)\/(\d+)\s*페이지\)/);
      if (m) {
        currentPage = parseInt(m[1], 10);
        totalPages = parseInt(m[2], 10);
        const strong = $(el).prevAll('strong').first();
        if (strong.length) {
          total = parseInt(strong.text().replace(/,/g, ''), 10);
        }
        return false; // break
      }
    });

    // Fallback: if the page count structure is absent but items were found
    if (totalPages === 0 && items.length > 0) {
      totalPages = 1;
      total = items.length;
    }

    return { total, totalPages, currentPage, items };
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

  private extractTableCellText(
    $: cheerio.CheerioAPI,
    cell: cheerio.Cheerio<AnyNode>,
  ): string {
    const clonedCell = cell.clone();
    clonedCell.find('.m_subject, script, style').remove();
    clonedCell.find('a.btn_sm').remove();
    return this.normalizeText($(clonedCell).text());
  }

  private parseBillInfoTable(
    $: cheerio.CheerioAPI,
  ): Pick<
    IContentData,
    | 'billNumber'
    | 'proposer'
    | 'proposalDate'
    | 'committee'
    | 'referralDate'
    | 'noticePeriod'
    | 'proposalSession'
  > {
    const table = $('.board-added table').first();
    const row = table.find('tbody > tr').first();

    if (!table.length || !row.length) {
      return {
        billNumber: null,
        proposer: null,
        proposalDate: null,
        committee: null,
        referralDate: null,
        noticePeriod: null,
        proposalSession: null,
      };
    }

    const headers = table
      .find('thead th')
      .map((_, th) => this.normalizeText($(th).text()).replace(/\s+/g, ''))
      .get();

    const values = row
      .children('td')
      .map((_, td) => this.extractTableCellText($, $(td)))
      .get();

    const valueByHeader = new Map<string, string>();
    headers.forEach((header, index) => {
      const value = values[index];
      if (value) {
        valueByHeader.set(header, value);
      }
    });

    return {
      billNumber: valueByHeader.get('의안번호') ?? null,
      proposer: valueByHeader.get('제안자') ?? null,
      proposalDate: valueByHeader.get('제안일') ?? null,
      committee: valueByHeader.get('소관위원회') ?? null,
      referralDate: valueByHeader.get('회부일') ?? null,
      noticePeriod: valueByHeader.get('입법예고기간') ?? null,
      proposalSession: valueByHeader.get('제안회기') ?? null,
    };
  }

  /** HTML에서 법률안 상세 내용을 파싱하여 반환합니다. */
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

    const billInfo = this.parseBillInfoTable($);

    return {
      title,
      proposalReason,
      billNumber: billInfo.billNumber,
      proposer: billInfo.proposer,
      proposalDate: billInfo.proposalDate,
      committee: billInfo.committee,
      referralDate: billInfo.referralDate,
      noticePeriod: billInfo.noticePeriod,
      proposalSession: billInfo.proposalSession,
    };
  }
}

// ── 국민참여입법센터 국회입법현황 (opinion.lawmaking.go.kr) ───────────────────

/** 의안원문 첨부 파일 정보 */
export interface INsmAttachment {
  filename: string;
  /** fnDownload() 호출에 사용되는 파일 ID */
  fileId: string;
}

/** 목록 페이지의 법안 한 건 */
export interface INsmBillItem {
  billName: string;
  billNo: string;
  link: string;
  proposer: string;
  proposalDate: string;
  /** 상임위원회명 (위원회 회부 전이면 빈 문자열) */
  committee: string;
  /** 소관부처 */
  ministry: string;
  /** 국회현황 (예: "발의", "위원회 회부") */
  progressStatus: string;
  /** 추진일자 */
  progressDate: string;
  /** 의결현황 (예: "원안가결") */
  resolutionStatus: string;
  /** 의결일자 */
  resolutionDate: string;
}

/** 상세 페이지의 법안 정보 */
export interface INsmBillDetail {
  title: string;
  billNo: string;
  /** 발의정보 원문 텍스트 */
  proposalInfo: string;
  proposer: string;
  proposalDate: string;
  /** 제안회기 (예: "제435회 국회(임시회)") */
  session: string;
  proposalReason: string | null;
  attachments: INsmAttachment[];
}

/** 목록 검색 결과 */
export interface INsmSearchResult {
  total: number;
  totalPages: number;
  currentPage: number;
  items: INsmBillItem[];
}

export class NsmLmStsParser {
  private normalizeText(text: string): string {
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  /** HTML에서 국회입법현황 목록을 파싱하여 반환합니다. */
  public parseList(html: string): INsmSearchResult {
    const $ = cheerio.load(html);
    const items: INsmBillItem[] = [];

    $('table tbody tr').each((_, tr) => {
      const $tr = $(tr);

      const $billNameLink = $tr.find('td[data-th="의안명"]').find('a');
      const billName = $billNameLink.text().trim();
      if (!billName) return;

      const href = $billNameLink.attr('href') ?? '';
      const link = href ? Config.NSM_DOMAIN + href : '';
      const billNoMatch = href.match(/\/(\d+)\/detailRP/);
      const billNo = billNoMatch?.[1] ?? '';

      const proposerPs = $tr
        .find('td[data-th="제안자(제안일자)"]')
        .find('p')
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(Boolean);
      const proposer = proposerPs[0] ?? '';
      const proposalDate = (proposerPs[1] ?? '').replace(/^\(|\)$/g, '').trim();

      const committeePs = $tr
        .find('td[data-th="상임위원회(소관부처)"]')
        .find('p')
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(Boolean);
      let committee = '';
      let ministry = '';
      for (const p of committeePs) {
        if (p.startsWith('(') && p.endsWith(')')) {
          ministry = p.slice(1, -1).trim();
        } else {
          committee = p;
        }
      }

      const progressPs = $tr
        .find('td[data-th="국회현황(추진일자)"]')
        .find('p')
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(Boolean);
      const progressStatus = progressPs[0] ?? '';
      const progressDate = (progressPs[1] ?? '').replace(/^\(|\)$/g, '').trim();

      const resolutionPs = $tr
        .find('td[data-th="의결현황(의결일자)"]')
        .find('p')
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(Boolean);
      const resolutionStatus = resolutionPs[0] ?? '';
      const resolutionDate = (resolutionPs[1] ?? '')
        .replace(/^\(|\)$/g, '')
        .trim();

      items.push({
        billName,
        billNo,
        link,
        proposer,
        proposalDate,
        committee,
        ministry,
        progressStatus,
        progressDate,
        resolutionStatus,
        resolutionDate,
      });
    });

    let total = 0;
    let currentPage = 1;
    let totalPages = 0;

    $('p.numBuild').each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      if (text.includes('건')) {
        total = parseInt($el.find('span').text().replace(/,/g, ''), 10) || 0;
      } else if (text.includes('쪽')) {
        currentPage =
          parseInt($el.find('em').text().replace(/,/g, ''), 10) || 1;
        totalPages =
          parseInt($el.find('span').text().replace(/,/g, ''), 10) || 0;
      }
    });

    if (totalPages === 0 && items.length > 0) {
      totalPages = 1;
      total = total || items.length;
    }

    return { total, totalPages, currentPage, items };
  }

  /** HTML에서 법안 상세 정보를 파싱하여 반환합니다. */
  public parseDetail(html: string): INsmBillDetail {
    const $ = cheerio.load(html);

    const title = $('h2')
      .filter((_, el) => $(el).text().trim().length > 5)
      .first()
      .text()
      .trim();

    // 입법 기본정보 테이블 탐색
    const $table = $('table')
      .filter((_, el) => {
        return (
          $(el)
            .find('th')
            .filter((_, th) => /발의정보/.test($(th).text())).length > 0
        );
      })
      .first();

    const proposalInfo = this.normalizeText(
      $table
        .find('th')
        .filter((_, th) => /발의정보/.test($(th).text()))
        .closest('tr')
        .find('td')
        .text(),
    );

    // "홍길동의원 등 12인, 제2219088호(2026. 5. 29.). 제435회 국회(임시회)" 파싱
    const billNoMatch = proposalInfo.match(/제(\d+)호/);
    const billNo = billNoMatch?.[1] ?? '';

    const proposalDateMatch = proposalInfo.match(/제\d+호\(([^)]+)\)/);
    const proposalDate = proposalDateMatch?.[1]?.trim() ?? '';

    const proposerMatch = proposalInfo.match(/^([^,]+),/);
    const proposer = proposerMatch?.[1]?.trim() ?? '';

    const sessionMatch = proposalInfo.match(/\.\s+(제\d+회\s*국회.*?)$/);
    const session = sessionMatch?.[1]?.trim() ?? '';

    // 의안원문 첨부파일
    const $attachTd = $table
      .find('th')
      .filter((_, th) => /의안원문/.test($(th).text()))
      .closest('tr')
      .find('td');
    const attachments: INsmAttachment[] = [];
    $attachTd.find('button[onclick*="fnDownload"]').each((_, btn) => {
      const onclick = $(btn).attr('onclick') ?? '';
      const fileIdMatch = onclick.match(/fnDownload\((\d+)\)/);
      if (fileIdMatch) {
        const $btn = $(btn).clone();
        $btn.find('span.a11y_hidden').remove();
        const filename = $btn.text().trim();
        attachments.push({ filename, fileId: fileIdMatch[1] });
      }
    });

    // 제안이유 및 주요내용
    const $reasonTd = $table
      .find('th')
      .filter((_, th) => /제안이유/.test($(th).text()))
      .closest('tr')
      .find('td');
    let proposalReason: string | null = null;
    if ($reasonTd.length) {
      const $pre = $reasonTd.find('pre');
      if ($pre.length) {
        const clone = $pre.clone();
        clone.find('br').replaceWith('\n');
        const text = this.normalizeText(clone.text());
        proposalReason = text || null;
      } else {
        const text = this.normalizeText($reasonTd.text());
        proposalReason = text || null;
      }
    }

    return {
      title,
      billNo,
      proposalInfo,
      proposer,
      proposalDate,
      session,
      proposalReason,
      attachments,
    };
  }
}
