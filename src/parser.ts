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
          $(el).find('td:nth-child(8)').text().replace(/,/g, '').trim(),
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
          num: Number.isFinite(num) ? num : 0,
          subject,
          proposerCategory,
          committee,
          numComments: Number.isFinite(numComments) ? numComments : 0,
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
          total = parseInt(strong.text().replace(/,/g, ''), 10) || 0;
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
  private normalizeText(
    text: string,
    options?: { preserveLineBreaks?: boolean },
  ): string {
    const normalized = text.replace(/\u00a0/g, ' ').replace(/\r/g, '');

    const lines = normalized
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim());

    if (options?.preserveLineBreaks) {
      return lines.join('\n');
    }

    return lines.filter(Boolean).join('\n');
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
        const text = this.normalizeText(clone.text(), {
          preserveLineBreaks: true,
        });
        proposalReason = text || null;
      } else {
        const text = this.normalizeText($reasonTd.text(), {
          preserveLineBreaks: true,
        });
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

// ── 국회 의안정보시스템 의안현황 > 계류의안 (likms.assembly.go.kr) ──────────────

/** 계류의안 목록의 법안 한 건 */
export interface ILikmsStateBillItem {
  /** 의안번호 (예: "2221880") */
  billNo: string;
  /** 의안정보시스템의 의안 ID (예: "PRC_..."), PAL contentId와 동일 */
  billId: string;
  /** 의안명 (대표발의자 포함, 예: "국가재정법 일부개정법률안(장종태의원 등 10인)") */
  billName: string;
  /** 의안명 끝 괄호에서 추출한 발의자 (없으면 빈 문자열) */
  proposer: string;
  /** 제안자구분 (예: "의원", "정부", "위원장") */
  proposerKind: string;
  /** 제안일자 (YYYY-MM-DD) */
  proposalDate: string;
  /** 소관위원회 (위원회 회부 전이면 빈 문자열) */
  committee: string;
  /** 심사진행상태 (예: "접수", "위원회 심사") */
  progressStatus: string;
  /** 목록에서 제안이유 팝업(openSummaryPopup) 링크가 노출되는지 여부 */
  hasProposalReason: boolean;
  /**
   * 제안이유 및 주요내용.
   * 목록 HTML에는 들어 있지 않으므로 파서는 항상 `null`을 넣고,
   * `LikmsStateCrawler`의 보정 옵션(`hydrateProposalReason`)이 켜진 경우에만
   * 의안상세 조회로 채워진다(보정 실패 시 `null` 유지).
   */
  proposalReason: string | null;
  /** 의안상세 페이지 URL */
  link: string;
}

/** 계류의안 목록 검색 결과 */
export interface ILikmsStateSearchResult {
  total: number;
  totalPages: number;
  currentPage: number;
  items: ILikmsStateBillItem[];
}

/**
 * 동명이인 선택 팝업의 후보 한 건.
 * 같은 이름이 같은 대수에 둘 이상일 수도 있어(예: 21대 이수진 2인) `hanja`/`party`가
 * 사람을 구분하는 단서가 된다.
 */
export interface ILikmsRepresentCandidate {
  /** `representId`로 그대로 쓸 수 있는 의원 ID (예: "GJK57930") */
  membId: string;
  /** 의원명 (한글, 목록의 발의자 표기와 같은 이름) */
  name: string;
  /** 대수 라벨 (예: "22대") */
  age: string;
  /** 한자명 (없으면 빈 문자열) */
  hanja: string;
  /** 정당명 (없으면 빈 문자열) */
  party: string;
}

/**
 * 의안현황 검색조건의 소관위원회 한 건 (`/bi/bill/sch/findAgeCmt.do`).
 *
 * 대수 범위에 따라 구성이 달라지고, 범위를 넓히면 **같은 이름이 여러 코드**로
 * 존재할 수 있다(예: `보건복지위원회(18대~22대)` = 9700341 / `보건복지위원회(14대~17대)` = 9700041).
 * 그래서 검색 파라미터(`ageCmtId`)에는 이름이 아니라 코드를 넣어야 한다.
 */
export interface ILikmsCommittee {
  /** `ageCmtId`에 넣는 소관위 코드 (예: "9700006") */
  comCd: string;
  /** 위원회명 (예: "법제사법위원회") */
  comCdName: string;
  /** 사이트 정렬 순서 (결측이면 `null`) */
  cdOrd: number | null;
}

export class LikmsStateParser {
  private normalizeText(text: string): string {
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  /** 의안명 끝 괄호를 발의자로 추출합니다 (예: "...(장종태의원 등 10인)" → "장종태의원 등 10인"). */
  private extractProposer(billName: string): string {
    const match = billName.match(/\(([^()]*)\)\s*$/);
    return match?.[1]?.trim() ?? '';
  }

  private buildDetailLink(billId: string): string {
    if (!billId) {
      return '';
    }
    return `${Config.LIKMS_DOMAIN}${Config.LIKMS_DETAIL_PAGE_URL}?billId=${encodeURIComponent(billId)}`;
  }

  /**
   * 계류의안 목록 조각(AJAX 응답) HTML을 파싱하여 반환합니다.
   * 잘못된 HTML·빈 결과에서는 빈 배열과 0을 반환하며 예외를 던지지 않습니다.
   */
  public parseList(html: string): ILikmsStateSearchResult {
    const $ = cheerio.load(html);
    const items: ILikmsStateBillItem[] = [];

    const rowSelector = $('#state-list tbody tr').length
      ? '#state-list tbody tr'
      : 'table tbody tr';

    $(rowSelector).each((_, tr) => {
      const $tr = $(tr);
      const $anchor = $tr.find('td.align_left a[data-bill-id]').first();
      const billId = ($anchor.attr('data-bill-id') ?? '').trim();
      if (!billId) {
        // "조회된 데이터가 없습니다" 등 데이터 행이 아닌 경우 건너뜀
        return;
      }

      const rawBillNo =
        $tr.find('td.billNo').attr('title') ?? $tr.find('td.billNo').text();
      const billNo = (rawBillNo ?? $anchor.attr('data-bill_no') ?? '').trim();

      const anchorText = $anchor.clone();
      anchorText.find('i').remove();
      const billName =
        this.normalizeText(anchorText.text()) ||
        this.normalizeText(
          ($anchor.attr('title') ?? '').replace(/\s*\(새창 열림\)\s*$/, ''),
        );

      const proposerKind = (
        $tr.find('td.proposerKindName').attr('title') ??
        $tr.find('td.proposerKindName').text()
      ).trim();
      const proposalDate = (
        $tr.find('td.proposeDt').attr('title') ??
        $tr.find('td.proposeDt').text()
      ).trim();
      const committee = $tr.find('td.currCmt').text().trim();
      const progressStatus = (
        $tr.find('td.procStageName').attr('title') ??
        $tr.find('td.procStageName').text()
      ).trim();
      const hasProposalReason =
        $tr.find('a[onclick*="openSummaryPopup"]').length > 0;

      items.push({
        billNo,
        billId,
        billName,
        proposer: this.extractProposer(billName),
        proposerKind,
        proposalDate,
        committee,
        progressStatus,
        hasProposalReason,
        // 목록 HTML에는 제안이유 본문이 없다(필요하면 크롤러가 상세에서 보정).
        proposalReason: null,
        link: this.buildDetailLink(billId),
      });
    });

    const countText = $('#pager_count_text').attr('value') ?? '';
    let total = parseInt(countText.replace(/[^0-9]/g, ''), 10) || 0;

    let currentPage = 1;
    let totalPages = 0;

    // 예: " (1/1,595 페이지)" — 전체 페이지 수에 천 단위 구분 쉼표가 들어간다.
    const pagesText = $('#pager_pages_text').attr('value') ?? '';
    const pagesMatch = pagesText.match(/\(([\d,]+)\s*\/\s*([\d,]+)\s*페이지\)/);
    if (pagesMatch) {
      currentPage = parseInt(pagesMatch[1].replace(/,/g, ''), 10) || 1;
      totalPages = parseInt(pagesMatch[2].replace(/,/g, ''), 10) || 0;
    }

    if (totalPages === 0 && items.length > 0) {
      totalPages = 1;
      total = total || items.length;
    }

    return { total, totalPages, currentPage, items };
  }

  /**
   * 동명이인 선택 팝업(`/bi/popup/selSameNmMemb.do`)의 후보 목록을 파싱합니다.
   *
   * 표는 한 행이 후보 한 명이고 컬럼은 대수·의원명·한자명·정당명입니다. 각 행의
   * `data-mem-id`가 `representId`에 그대로 넣는 의원 ID이며, 1번째 셀은 모바일용
   * 목록(`ul.m_list`)과 대수 라벨을 함께 담고 있어 데스크톱 컬럼을 우선 사용합니다.
   *
   * 데이터가 없거나(“조회된 데이터가 없습니다”) 잘못된 HTML이면 빈 배열을 반환합니다.
   */
  public parseSameNameCandidates(html: string): ILikmsRepresentCandidate[] {
    const $ = cheerio.load(html);
    const candidates: ILikmsRepresentCandidate[] = [];

    const rowSelector = $('#data_sect tr').length
      ? '#data_sect tr'
      : 'tbody tr';

    $(rowSelector).each((_, tr) => {
      const $tr = $(tr);
      const membId = (
        $tr.find('[data-mem-id]').first().attr('data-mem-id') ?? ''
      ).trim();
      if (!membId) {
        // 데이터 행이 아니거나(빈 결과 안내) ID가 없는 행
        return;
      }

      const cells = $tr.find('td');
      const mobileItems = cells.first().find('ul.m_list li');
      const cellText = (index: number): string =>
        this.normalizeText(cells.eq(index).text());
      const mobileText = (index: number): string =>
        this.normalizeText(mobileItems.eq(index).text());

      candidates.push({
        membId,
        name: cellText(1) || mobileText(0),
        age: this.normalizeText(cells.first().find('span').first().text()),
        hanja: cellText(2) || mobileText(1),
        party: cellText(3) || mobileText(2),
      });
    });

    return candidates;
  }

  /**
   * 소관위원회 목록 JSON(`/bi/bill/sch/findAgeCmt.do`)을 파싱합니다.
   *
   * 응답은 `{ "ageCmtList": [{ "comCd", "comCdName", "cdOrd" }] }` 형태이며,
   * JSON이 아니거나 목록이 비면 빈 배열을 반환합니다(예외를 던지지 않습니다).
   */
  public parseCommittees(raw: string): ILikmsCommittee[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Parsing malformed input must not expose exceptions to consumers.
      return [];
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('ageCmtList' in parsed)
    ) {
      return [];
    }
    const list = parsed.ageCmtList;
    if (!Array.isArray(list)) {
      return [];
    }

    const committees: ILikmsCommittee[] = [];
    const entries: unknown[] = list;
    for (const entry of entries) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('comCd' in entry) ||
        !('comCdName' in entry)
      ) {
        continue;
      }
      const comCd = typeof entry.comCd === 'string' ? entry.comCd.trim() : '';
      const comCdName =
        typeof entry.comCdName === 'string' ? entry.comCdName.trim() : '';
      if (!comCd || !comCdName) {
        continue;
      }

      committees.push({
        comCd,
        comCdName,
        cdOrd:
          'cdOrd' in entry &&
          typeof entry.cdOrd === 'number' &&
          Number.isFinite(entry.cdOrd)
            ? entry.cdOrd
            : null,
      });
    }

    return committees;
  }
}

// ── 국회 의안정보시스템 의안상세 (billDetailPage.do + billInfo.do) ─────────────

/** 의안상세의 문서(의안원문 등) 다운로드 링크 */
export interface ILikmsDocAttachment {
  /** 표시명 (예: "의안원문.hwp") */
  filename: string;
  /** 다운로드 URL (절대 URL) */
  url: string;
}

/**
 * 국회 의안정보시스템 의안상세에서 파싱한 정보.
 *
 * likms 의안상세는 한 번의 응답으로 끝나지 않는다(클래스 JSDoc 참조).
 * - 상세 페이지(`billDetailPage.do`): 제목(`h3.detailh3`), 의안번호(`#form`)
 * - 심사정보 탭 조각(`billInfo.do`): 접수정보(제안일자·제안자·제안회기), 제안이유, 문서
 *
 * 따라서 각 필드는 **전달된 HTML에 들어 있는 값만** 채워진다(없으면 빈 문자열·`null`·빈 배열).
 */
export interface ILikmsDetailInfo {
  /** 의안명 — `[2221883] ` 접두는 제거하고 발의자 괄호는 유지한다 */
  title: string;
  billNo: string;
  /** 제안자 (예: "주진우의원 등 10인") */
  proposer: string;
  /** 제안일자 (YYYY-MM-DD). NSM의 "2026. 5. 1." 형식과 다르다 */
  proposalDate: string;
  /** 제안회기 (예: "제22대(2024~2028)제439회") */
  session: string;
  proposalReason: string | null;
  attachments: ILikmsDocAttachment[];
}

/**
 * 국회 의안정보시스템 의안상세 파서.
 *
 * 상세 페이지 HTML과 심사정보 탭 조각 HTML을 **둘 다** 받을 수 있고, 들어 있는 값만
 * 채우며 잘못된 HTML이면 빈 값을 반환한다(예외를 던지지 않는다).
 * 사이트가 두 응답으로 나뉘어 있어 호출부는 `LikmsCrawler`/`LikmsStateCrawler`로
 * 두 HTML을 모은 뒤 이 파서에 넘긴다.
 */
export class LikmsDetailParser {
  /** NBSP 제거 + 줄 단위 공백 축약(빈 줄 제거) */
  private normalizeText(text: string): string {
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  /** 셀 텍스트의 라벨(`<i>의안번호</i>`)을 떼고 값만 남긴다 */
  private cellText(value: string): string {
    return this.normalizeText(value).trim();
  }

  /**
   * `javascript: goDownload('/filegate/...')`에서 경로를 뽑아 절대 URL로 만든다.
   * 다운로드 대상이 아닌 링크(`javascript:;` 미리보기 등)면 `null`.
   */
  private extractDownloadUrl(rawHref: string): string | null {
    const href = rawHref.trim();
    if (!href || href === 'javascript:;' || href === '#') {
      return null;
    }

    if (href.startsWith('javascript:')) {
      const path = href.match(/['"]([^'"]+)['"]/)?.[1]?.trim();
      if (!path) {
        return null;
      }
      return this.toAbsoluteUrl(path);
    }

    return this.toAbsoluteUrl(href);
  }

  private toAbsoluteUrl(path: string): string {
    if (/^https?:\/\//.test(path)) {
      return path;
    }
    return `${Config.LIKMS_DOMAIN}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /** 파일 제목/링크 텍스트에서 확장자를 뽑는다 */
  private extractFileExtension(text: string): string {
    if (/hwp|한글/i.test(text)) {
      return 'hwp';
    }
    if (/pdf/i.test(text)) {
      return 'pdf';
    }
    return '';
  }

  private parseAttachments(
    $: cheerio.CheerioAPI,
    selector: string,
  ): ILikmsDocAttachment[] {
    const attachments: ILikmsDocAttachment[] = [];

    $(selector).each((_, el) => {
      const $a = $(el);
      const url = this.extractDownloadUrl($a.attr('href') ?? '');
      if (!url) {
        return;
      }

      const title = this.cellText($a.attr('title') ?? '');
      const base = this.cellText(
        title
          .replace(/\([^)]*다운로드\)\s*$/, '')
          .replace(/^의안접수정보\s*/, ''),
      );
      const filename = base || this.cellText($a.text());
      if (!filename) {
        return;
      }

      const extension = this.extractFileExtension(title || $a.text());
      attachments.push({
        filename: extension ? `${filename}.${extension}` : filename,
        url,
      });
    });

    return attachments;
  }

  /**
   * 심사정보 탭 조각의 `#prntSummary`에서 제안이유 및 주요내용을 추출합니다.
   * `#prntSummary`가 없거나 비어 있으면 `null`을 반환합니다.
   */
  public parseProposalReason(fragmentHtml: string): string | null {
    const $ = cheerio.load(fragmentHtml);
    const pre = $('#prntSummary').first();
    if (!pre.length) {
      return null;
    }

    const clone = pre.clone();
    clone.find('br').replaceWith('\n');

    const lines = clone
      .text()
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    // 첫 줄이 섹션 제목("제안이유 및 주요내용")을 반복하는 경우 제거
    if (lines[0]?.replace(/\s+/g, '') === '제안이유및주요내용') {
      lines.shift();
    }

    const text = lines.join('\n');
    return text || null;
  }

  /**
   * 의안상세 페이지 HTML 또는 심사정보 탭 조각 HTML을 파싱합니다.
   * 두 HTML을 모두 넘길 수 있으며, 들어 있는 값만 채웁니다.
   */
  public parseDetail(html: string): ILikmsDetailInfo {
    const $ = cheerio.load(html);

    const rawTitle = (
      $('h3.detailh3').first().attr('title') ?? $('h3.detailh3').first().text()
    ).trim();
    const title = this.normalizeText(rawTitle)
      .replace(/^\[\d+\]\s*/, '')
      .trim();

    const pageBillNo = (
      $('#form input[name="billNo"]').attr('value') ?? ''
    ).trim();
    const titleBillNo = rawTitle.match(/^\s*\[(\d+)\]/)?.[1] ?? '';

    const billNo =
      this.cellText($('#insc-rcp-row td.billNo span').first().text()) ||
      pageBillNo ||
      titleBillNo;

    return {
      title,
      billNo,
      proposer: this.cellText(
        $('#insc-rcp-row td.proposer span').first().text(),
      ),
      proposalDate: this.cellText(
        $('#insc-rcp-row td.proposeDt span').first().text(),
      ),
      session: this.cellText(
        $('#insc-rcp-row td.sessionTitle span').first().text(),
      ),
      proposalReason: this.parseProposalReason(html),
      attachments: this.parseAttachments($, '#insc-rcp-row td.doc a'),
    };
  }
}
