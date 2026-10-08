import { URL } from 'url';
import * as cheerio from 'cheerio';
import { Config } from './config';
import { HttpClient } from './http-client';

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

  constructor(config?: LikmsCrawlerConfig) {
    this.httpClient = new HttpClient({
      userAgent: config?.userAgent ?? Config.UserAgent,
      timeout: config?.timeout ?? 10000,
      retryCount: config?.retryCount ?? 3,
      customHeaders: config?.customHeaders ?? {},
    });
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
