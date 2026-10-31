import { URL } from 'url';
import https from 'https';
import { Config } from './config';
import {
  type ISearchResult,
  PalCrawl,
  NsmLmSts,
  type PalCrawlConfig,
  type INsmSearchResult,
} from './pal';
import { PalParser, NsmLmStsParser } from './parser';

// Fail immediately if a fixture test accidentally reaches the real transport.
beforeEach(() => {
  jest.spyOn(https, 'request').mockImplementation(() => {
    throw new Error('Unexpected external request in offline tests');
  });
});
afterEach(() => jest.restoreAllMocks());

const getHttpClient = (
  instance: PalCrawl | NsmLmSts,
): {
  get: (url: URL) => Promise<string>;
} =>
  (
    instance as unknown as {
      httpClient: { get: (url: URL) => Promise<string> };
    }
  ).httpClient;

// ─── HTML Fixtures ────────────────────────────────────────────────────────────

const TABLE_ROW_HTML = `
<table>
  <tbody>
    <tr>
      <td>42</td>
      <td class="td_block">
        <a href="/napal/lgsltpa/lgsltpaOngoing/view.do?lgsltPaId=PRC_TEST000" class="board_subject">테스트 법률안 (홍길동의원 등 5인)</a>
      </td>
      <td>의원</td>
      <td>법제사법위원회</td>
      <td></td>
      <td>
        <a href="#">버튼</a>
        <a href="https://example.com/file.hwp">hwp</a>
        <a href="https://example.com/file.pdf">pdf</a>
      </td>
      <td></td>
      <td>1,234</td>
      <td></td>
    </tr>
  </tbody>
</table>
`;

const TABLE_ROW_NO_LINK_HTML = `
<table>
  <tbody>
    <tr>
      <td>1</td>
      <td class="td_block">
        <a class="board_subject">링크없는 법률안</a>
      </td>
      <td>정부</td>
      <td>기획재정위원회</td>
      <td></td>
      <td></td>
      <td></td>
      <td>0</td>
      <td></td>
    </tr>
  </tbody>
</table>
`;

const CONTENT_HTML = `
<div class="legislation-heading">
  <h3>[2218288] 조세특례제한법 일부개정법률안(윤한홍의원 등 10인)</h3>
</div>
<div class="board01 pr td_center board-added">
  <table>
    <thead>
      <tr>
        <th scope="col">의안번호</th>
        <th scope="col">제안자</th>
        <th scope="col">제안일</th>
        <th scope="col">소관위원회</th>
        <th scope="col">회부일</th>
        <th scope="col">입법예고기간</th>
        <th scope="col">법률안원문</th>
        <th scope="col">제안회기</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2218288</td>
        <td>
          윤한홍의원 등 10인
          <a class="btn_sm" href="#">제안자목록</a>
        </td>
        <td>2026-04-01</td>
        <td class="td_block">
          기획재정위원회
          <div class="m_subject">
            <ul class="m_date">
              <li>입법예고기간 : 2026-04-02~2026-04-11</li>
            </ul>
          </div>
        </td>
        <td>2026-04-02</td>
        <td>2026-04-02~2026-04-11</td>
        <td><a href="#">미리보기</a></td>
        <td>제22대(2024~2028) 제433회</td>
      </tr>
    </tbody>
  </table>
</div>
<div class="card-wrap">
  <div class="item">
    <h4>제안이유 및 주요내용</h4>
    <div class="desc">
      제안이유 및 주요내용
      <br/>첫 번째 문장
      <br/>두 번째 문장
    </div>
  </div>
  <div class="item">
    <h4>의견제출 방법</h4>
    <div class="desc">국회 재정경제기획위원회</div>
  </div>
  <div class="item item-means">
    <div class="desc">제출방법: 상단 의견등록 탭 사용</div>
  </div>
</div>
`;

const SEARCH_RESULT_HTML = `
<div class="board_count">
  <span>전체</span>
  <strong>143</strong>
  <span>건 (2/15 페이지)</span>
</div>
<table>
  <tbody>
    <tr>
      <td>42</td>
      <td class="td_block">
        <a href="/napal/lgsltpa/lgsltpaOngoing/view.do?lgsltPaId=PRC_TEST000" class="board_subject">테스트 법률안 (홍길동의원 등 5인)</a>
      </td>
      <td>의원</td>
      <td>법제사법위원회</td>
      <td></td>
      <td>
        <a href="#">버튼</a>
        <a href="https://example.com/file.hwp">hwp</a>
        <a href="https://example.com/file.pdf">pdf</a>
      </td>
      <td></td>
      <td>1,234</td>
      <td></td>
    </tr>
  </tbody>
</table>
`;

// ─── NSM HTML Fixtures ────────────────────────────────────────────────────────

/** 위원회에 배속된 법안 한 건 + 페이지네이션 */
const NSM_LIST_HTML = `
<p class="numBuild">총 <span>3,142</span>건</p>
<p class="numBuild">현재 <em>2</em>/<span>315</span>쪽</p>
<table>
  <tbody>
    <tr>
      <td data-th="의안명">
        <a href="/gcom/nsmLmSts/out/2219088/detailRP">인공지능 기본법 일부개정법률안</a>
      </td>
      <td data-th="제안자(제안일자)">
        <p>홍길동의원 등 10인</p>
        <p>(2026.05.01.)</p>
      </td>
      <td data-th="상임위원회(소관부처)">
        <p>과학기술정보방송통신위원회</p>
        <p>(과학기술정보통신부)</p>
      </td>
      <td data-th="국회현황(추진일자)">
        <p>위원회 회부</p>
        <p>(2026.05.03.)</p>
      </td>
      <td data-th="의결현황(의결일자)">
        <p>원안가결</p>
        <p>(2026.05.20.)</p>
      </td>
    </tr>
  </tbody>
</table>
`;

/** 위원회 회부 이전 발의 상태 법안 (committee 빈 문자열) */
const NSM_LIST_HTML_PENDING = `
<p class="numBuild">총 <span>87</span>건</p>
<p class="numBuild">현재 <em>1</em>/<span>9</span>쪽</p>
<table>
  <tbody>
    <tr>
      <td data-th="의안명">
        <a href="/gcom/nsmLmSts/out/2219200/detailRP">개인정보 보호법 일부개정법률안</a>
      </td>
      <td data-th="제안자(제안일자)">
        <p>김철수의원 등 5인</p>
        <p>(2026.05.28.)</p>
      </td>
      <td data-th="상임위원회(소관부처)">
        <p>(개인정보보호위원회)</p>
      </td>
      <td data-th="국회현황(추진일자)">
        <p>발의</p>
        <p>(2026.05.28.)</p>
      </td>
      <td data-th="의결현황(의결일자)"></td>
    </tr>
  </tbody>
</table>
`;

/** 목록에서 제목이 잘린 케이스 */
const NSM_LIST_HTML_TRUNCATED_TITLE = `
<p class="numBuild">총 <span>1</span>건</p>
<p class="numBuild">현재 <em>1</em>/<span>1</span>쪽</p>
<table>
  <tbody>
    <tr>
      <td data-th="의안명">
        <a href="/gcom/nsmLmSts/out/2219088/detailRP">인공지능 기본법 일부개정...</a>
      </td>
      <td data-th="제안자(제안일자)">
        <p>홍길동의원 등 10인</p>
        <p>(2026.05.01.)</p>
      </td>
      <td data-th="상임위원회(소관부처)">
        <p>과학기술정보방송통신위원회</p>
        <p>(과학기술정보통신부)</p>
      </td>
      <td data-th="국회현황(추진일자)">
        <p>위원회 회부</p>
        <p>(2026.05.03.)</p>
      </td>
      <td data-th="의결현황(의결일자)">
        <p>원안가결</p>
        <p>(2026.05.20.)</p>
      </td>
    </tr>
  </tbody>
</table>
`;

/** 상세 페이지 */
const NSM_DETAIL_HTML = `
<h2></h2>
<h2>인공지능 기본법 일부개정법률안</h2>
<h3>기본정보</h3>
<h3>국회입법현황</h3>
<table>
  <tbody>
    <tr>
      <th>발의정보</th>
      <td>홍길동의원 등 10인, 제2219088호(2026. 5. 1.). 제435회 국회(임시회)</td>
    </tr>
    <tr>
      <th>의안원문</th>
      <td>
        <button onclick="fnDownload(99001)">인공지능기본법안.hwp<span class="a11y_hidden">다운로드</span></button>
        <button onclick="fnDownload(99002)">인공지능기본법안검토보고서.pdf<span class="a11y_hidden">다운로드</span></button>
      </td>
    </tr>
    <tr>
      <th>제안이유 및 주요내용</th>
      <td>
        <pre>인공지능 기술의 발전에 따라<br/>규제 체계를 정비하고자 함</pre>
      </td>
    </tr>
  </tbody>
</table>
`;

/** 상세 페이지 - 제안이유 없음 (pre 태그 없는 경우) */
const NSM_DETAIL_HTML_NO_REASON = `
<h2>최소 법률안</h2>
<table>
  <tbody>
    <tr>
      <th>발의정보</th>
      <td>이영희의원, 제2200001호(2026. 1. 5.). 제433회 국회(임시회)</td>
    </tr>
    <tr>
      <th>의안원문</th>
      <td></td>
    </tr>
  </tbody>
</table>
`;

// ─── PalParser ──────────────────────────────────────────────────────────────────────────────

describe('PalParser', () => {
  const parser = new PalParser();

  describe('parseTable', () => {
    test('returns zero for malformed numeric fields', () => {
      const html = TABLE_ROW_HTML.replace(
        '<td>42</td>',
        '<td>unknown</td>',
      ).replace('1,234', 'unknown');
      const [row] = parser.parseTable(html);
      expect(row.num).toBe(0);
      expect(row.numComments).toBe(0);
    });

    test('parses multiple thousands separators in comment counts', () => {
      const [row] = parser.parseTable(
        TABLE_ROW_HTML.replace('1,234', '1,234,567'),
      );
      expect(row.numComments).toBe(1234567);
    });

    test('returns [] for invalid html', () => {
      expect(parser.parseTable('asdf')).toHaveLength(0);
    });

    test('returns [] for empty string', () => {
      expect(parser.parseTable('')).toHaveLength(0);
    });

    test('parses all fields from a valid table row', () => {
      const rows = parser.parseTable(TABLE_ROW_HTML);
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.num).toBe(42);
      expect(row.subject).toBe('테스트 법률안 (홍길동의원 등 5인)');
      expect(row.proposerCategory).toBe('의원');
      expect(row.committee).toBe('법제사법위원회');
      expect(row.numComments).toBe(1234);
      expect(row.link).toContain('PRC_TEST000');
      expect(row.contentId).toBe('PRC_TEST000');
      expect(row.attachments.hwpFile).toBe('https://example.com/file.hwp');
      expect(row.attachments.pdfFile).toBe('https://example.com/file.pdf');
    });

    test('sets link to empty string and contentId to null when anchor has no href', () => {
      const rows = parser.parseTable(TABLE_ROW_NO_LINK_HTML);
      expect(rows).toHaveLength(1);
      expect(rows[0].link).toBe('');
      expect(rows[0].contentId).toBeNull();
    });

    test('parses numComments with comma formatting as a plain number', () => {
      const rows = parser.parseTable(TABLE_ROW_HTML);
      expect(rows[0].numComments).toBe(1234);
    });
  });

  describe('parseContent', () => {
    test('parses all fields from a full fixture', () => {
      const content = parser.parseContent(CONTENT_HTML);
      expect(content.title).toContain('조세특례제한법 일부개정법률안');
      expect(content.proposalReason).toBe('첫 번째 문장\n두 번째 문장');
      expect(content.billNumber).toBe('2218288');
      expect(content.proposer).toBe('윤한홍의원 등 10인');
      expect(content.proposalDate).toBe('2026-04-01');
      expect(content.committee).toBe('기획재정위원회');
      expect(content.referralDate).toBe('2026-04-02');
      expect(content.noticePeriod).toBe('2026-04-02~2026-04-11');
      expect(content.proposalSession).toBe('제22대(2024~2028) 제433회');
    });

    test('strips the repeated heading line from proposal reason', () => {
      const content = parser.parseContent(CONTENT_HTML);
      // The desc starts with "제안이유 및 주요내용" which matches the heading - it must be stripped.
      expect(content.proposalReason).not.toMatch(/제안이유/);
    });

    test('returns empty title and all nulls for empty html', () => {
      const content = parser.parseContent('');
      expect(content.title).toBe('');
      expect(content.proposalReason).toBeNull();
      expect(content.billNumber).toBeNull();
      expect(content.proposer).toBeNull();
      expect(content.proposalDate).toBeNull();
      expect(content.committee).toBeNull();
      expect(content.referralDate).toBeNull();
      expect(content.noticePeriod).toBeNull();
      expect(content.proposalSession).toBeNull();
    });

    test('falls back to h3 when .legislation-heading h3 is absent', () => {
      const content = parser.parseContent('<h3>대체 제목</h3>');
      expect(content.title).toBe('대체 제목');
    });

    test('returns null for all bill info fields when .board-added table is absent', () => {
      const content = parser.parseContent(
        '<div class="legislation-heading"><h3>제목</h3></div>',
      );
      expect(content.billNumber).toBeNull();
      expect(content.proposer).toBeNull();
      expect(content.proposalDate).toBeNull();
      expect(content.committee).toBeNull();
      expect(content.referralDate).toBeNull();
      expect(content.noticePeriod).toBeNull();
      expect(content.proposalSession).toBeNull();
    });

    test('returns null proposalReason when desc is empty', () => {
      const content = parser.parseContent(`
        <div class="card-wrap">
          <div class="item">
            <h4>제안이유 및 주요내용</h4>
            <div class="desc"></div>
          </div>
        </div>
      `);
      expect(content.proposalReason).toBeNull();
    });

    test('keeps proposal reason as-is when first line does not repeat the heading', () => {
      const content = parser.parseContent(`
        <div class="card-wrap">
          <div class="item">
            <h4>제안이유 및 주요내용</h4>
            <div class="desc">
              본문 첫 줄
              <br/>본문 두 번째 줄
            </div>
          </div>
        </div>
      `);
      expect(content.proposalReason).toBe('본문 첫 줄\n본문 두 번째 줄');
    });

    test('ignores items without an h4 heading', () => {
      expect(() =>
        parser.parseContent(`
          <div class="card-wrap">
            <div class="item">
              <div class="desc">heading 없는 항목</div>
            </div>
          </div>
        `),
      ).not.toThrow();
    });
  });
  describe('parseSearchResult', () => {
    test('returns zero when the reported total is malformed', () => {
      const result = parser.parseSearchResult(
        SEARCH_RESULT_HTML.replace(
          '<strong>143</strong>',
          '<strong>unknown</strong>',
        ),
      );
      expect(result.total).toBe(0);
    });

    test('parses total, totalPages, currentPage, and items from fixture', () => {
      const result = parser.parseSearchResult(SEARCH_RESULT_HTML);
      expect(result.total).toBe(143);
      expect(result.totalPages).toBe(15);
      expect(result.currentPage).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].subject).toBe('테스트 법률안 (홍길동의원 등 5인)');
    });

    test('returns zero total and empty items for empty html', () => {
      const result = parser.parseSearchResult('');
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.currentPage).toBe(1);
      expect(result.items).toHaveLength(0);
    });

    test('falls back to items.length when count structure is absent', () => {
      const result = parser.parseSearchResult(TABLE_ROW_HTML);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
    });
  });
});

// ─── PalCrawl ─────────────────────────────────────────────────────────────────

describe('PalCrawl', () => {
  const palCrawl = new PalCrawl();

  // ── constructor ──────────────────────────────────────────────────────────────

  describe('constructor', () => {
    test('creates instance without config', () => {
      expect(new PalCrawl()).toBeInstanceOf(PalCrawl);
    });

    test('creates instance with empty config object', () => {
      expect(new PalCrawl({})).toBeInstanceOf(PalCrawl);
    });

    test('accepts custom userAgent', () => {
      expect(new PalCrawl({ userAgent: 'Custom Agent' })).toBeInstanceOf(
        PalCrawl,
      );
    });

    test('accepts custom timeout', () => {
      expect(new PalCrawl({ timeout: 5000 })).toBeInstanceOf(PalCrawl);
    });

    test('accepts custom retryCount', () => {
      expect(new PalCrawl({ retryCount: 5 })).toBeInstanceOf(PalCrawl);
    });

    test('accepts custom headers', () => {
      expect(
        new PalCrawl({ customHeaders: { 'Accept-Language': 'ko-KR' } }),
      ).toBeInstanceOf(PalCrawl);
    });

    test('accepts all config options together', () => {
      const config: PalCrawlConfig = {
        userAgent: 'Custom Agent',
        timeout: 15000,
        retryCount: 2,
        customHeaders: { Accept: 'application/json' },
      };
      expect(new PalCrawl(config)).toBeInstanceOf(PalCrawl);
    });
  });

  // ── parseTable / parseContent (delegation) ───────────────────────────────────

  describe('parseTable', () => {
    test('returns [] for invalid html', () => {
      expect(palCrawl.parseTable('asdf')).toHaveLength(0);
    });

    test('delegates to PalParser and returns parsed rows', () => {
      const rows = palCrawl.parseTable(TABLE_ROW_HTML);
      expect(rows).toHaveLength(1);
      expect(rows[0].num).toBe(42);
      expect(rows[0].subject).toBe('테스트 법률안 (홍길동의원 등 5인)');
      expect(rows[0].contentId).toBe('PRC_TEST000');
    });
  });

  describe('parseContent', () => {
    test('delegates to PalParser and returns parsed content', () => {
      const content = palCrawl.parseContent(CONTENT_HTML);
      expect(content.title).toContain('조세특례제한법 일부개정법률안');
      expect(content.billNumber).toBe('2218288');
      expect(content.proposer).toBe('윤한홍의원 등 10인');
    });
  });

  describe('fixture-backed requests', () => {
    let mockGet: jest.SpyInstance<Promise<string>, [URL]>;

    beforeEach(() => {
      mockGet = jest.spyOn(getHttpClient(palCrawl), 'get');
    });

    test.each([
      ['ongoing', Config.LIST_URL],
      ['done', Config.DONE_LIST_URL],
    ])('requests and parses the %s notice list', async (kind, path) => {
      mockGet.mockResolvedValue(TABLE_ROW_HTML);
      const items =
        kind === 'ongoing' ? await palCrawl.get() : await palCrawl.getDone();
      expect(items).toEqual(palCrawl.parseTable(TABLE_ROW_HTML));
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet.mock.calls[0][0].pathname).toBe(path);
    });

    test.each([
      ['ongoing', Config.CONTENT_URL],
      ['done', Config.DONE_CONTENT_URL],
    ])(
      'requests and parses %s notice details with both identifier keys',
      async (kind, path) => {
        mockGet.mockResolvedValue(CONTENT_HTML);
        const detail =
          kind === 'ongoing'
            ? await palCrawl.getContent(' PRC_TEST000 ')
            : await palCrawl.getDoneContent(' PRC_TEST000 ');
        expect(detail.proposalReason).toBe('첫 번째 문장\n두 번째 문장');
        const [url] = mockGet.mock.calls[0];
        expect(url.pathname).toBe(path);
        expect(url.searchParams.get('lgsltPaid')).toBe('PRC_TEST000');
        expect(url.searchParams.get('lgsltPaId')).toBe('PRC_TEST000');
      },
    );

    test.each(['', '   '])(
      'rejects blank detail identifiers before transport (%j)',
      async (id) => {
        await expect(palCrawl.getContentHTML(id)).rejects.toThrow(
          'id is required',
        );
        await expect(palCrawl.getDoneContentHTML(id)).rejects.toThrow(
          'id is required',
        );
        expect(mockGet).not.toHaveBeenCalled();
      },
    );

    test('passes notice search filters without altering their values', async () => {
      mockGet.mockResolvedValue(SEARCH_RESULT_HTML);
      const query = {
        billName: '개정법률',
        fromAge: 22,
        toAge: 22,
        pageUnit: 5,
        pageIndex: 2,
        sortCol: 'BILL_NAME',
        sortGbn: 'ASC',
      } satisfies Parameters<PalCrawl['search']>[0];
      const result = await palCrawl.search(query);
      expect(result).toMatchObject({
        total: 143,
        totalPages: 15,
        currentPage: 2,
      });
      expect(result.items).toEqual(palCrawl.parseTable(SEARCH_RESULT_HTML));
      const [url] = mockGet.mock.calls[0];
      for (const [name, value] of Object.entries(query)) {
        expect(url.searchParams.get(name)).toBe(String(value));
      }
    });

    test('passes explicit completed-page pagination to the site', async () => {
      mockGet.mockResolvedValue(SEARCH_RESULT_HTML);
      const items = await palCrawl.getDonePage(2, 20);
      expect(items).toHaveLength(1);
      const [url] = mockGet.mock.calls[0];
      expect(url.pathname).toBe(Config.DONE_LIST_URL);
      expect(url.searchParams.get('pageIndex')).toBe('2');
      expect(url.searchParams.get('pageUnit')).toBe('20');
    });

    test('preserves request failures instead of returning an empty list', async () => {
      mockGet.mockRejectedValue(new Error('transport unavailable'));
      await expect(palCrawl.search()).rejects.toThrow('transport unavailable');
      await expect(palCrawl.getDoneContent('PRC_TEST000')).rejects.toThrow(
        'transport unavailable',
      );
    });

    test.each(['ongoing', 'done'])(
      'yields %s pages in order and respects the explicit page limit',
      async (kind) => {
        mockGet.mockImplementation(async (url) =>
          SEARCH_RESULT_HTML.replace(
            '(2/15',
            `(${url.searchParams.get('pageIndex')}/15`,
          ),
        );
        const pages: ISearchResult[] = [];
        const iterator =
          kind === 'ongoing'
            ? palCrawl.getAllPages(
                {},
                { maxPages: 3, delayMs: 0, concurrency: 2 },
              )
            : palCrawl.getAllDonePages(
                {},
                { maxPages: 3, delayMs: 0, concurrency: 2 },
              );
        for await (const page of iterator) pages.push(page);
        expect(pages.map((page) => page.currentPage)).toEqual([1, 2, 3]);
        expect(mockGet).toHaveBeenCalledTimes(3);
      },
    );

    test('stops pagination at an empty page', async () => {
      mockGet.mockResolvedValueOnce(SEARCH_RESULT_HTML).mockResolvedValue('');
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllPages({}, { delayMs: 0 }))
        pages.push(page);
      expect(pages).toHaveLength(2);
      expect(pages[1].items).toEqual([]);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  // ── Screenshot functionality ─────────────────────────────────────────────────

  describe('Screenshot functionality', () => {
    test('creates instance with screenshot config', () => {
      const config: PalCrawlConfig = {
        screenshot: {
          enabled: true,
          fullPage: true,
          width: 1920,
          height: 1080,
          format: 'png',
        },
      };
      expect(new PalCrawl(config)).toBeInstanceOf(PalCrawl);
    });

    test('throws error when screenshot is disabled', async () => {
      const crawler = new PalCrawl({ screenshot: { enabled: false } });
      await expect(
        crawler.takeScreenshot('https://example.com'),
      ).rejects.toThrow('Screenshot feature is not enabled');
    });

    test('accepts jpeg format with quality option', () => {
      const config: PalCrawlConfig = {
        screenshot: {
          enabled: true,
          format: 'jpeg',
          quality: 90,
        },
      };
      expect(new PalCrawl(config)).toBeInstanceOf(PalCrawl);
    });

    test('updateScreenshotConfig modifies screenshot settings', () => {
      const crawler = new PalCrawl({
        screenshot: { enabled: true, format: 'png' },
      });
      crawler.updateScreenshotConfig({ format: 'jpeg', quality: 75 });
      expect(crawler).toBeInstanceOf(PalCrawl);
    });

    test('closes an unused crawler without starting a browser', async () => {
      const crawler = new PalCrawl({ screenshot: { enabled: true } });
      await crawler.closeBrowser();
      expect(crawler.browser).toBeNull();
    });
  });
});

// ─── NsmLmStsParser ──────────────────────────────────────────────────────────

describe('NsmLmStsParser', () => {
  const parser = new NsmLmStsParser();

  // ── parseList ──────────────────────────────────────────────────────────────

  describe('parseList', () => {
    test('returns empty result for empty string', () => {
      const result = parser.parseList('');
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.currentPage).toBe(1);
      expect(result.items).toHaveLength(0);
    });

    test('returns empty result for invalid html', () => {
      const result = parser.parseList('not html at all');
      expect(result.items).toHaveLength(0);
    });

    test('parses pagination: total, totalPages, currentPage', () => {
      const result = parser.parseList(NSM_LIST_HTML);
      expect(result.total).toBe(3142);
      expect(result.totalPages).toBe(315);
      expect(result.currentPage).toBe(2);
    });

    test('parses bill name and link', () => {
      const result = parser.parseList(NSM_LIST_HTML);
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.billName).toBe('인공지능 기본법 일부개정법률안');
      expect(item.billNo).toBe('2219088');
      expect(item.link).toContain('2219088/detailRP');
    });

    test('parses proposer and proposalDate (strips parentheses)', () => {
      const item = parser.parseList(NSM_LIST_HTML).items[0];
      expect(item.proposer).toBe('홍길동의원 등 10인');
      expect(item.proposalDate).toBe('2026.05.01.');
    });

    test('parses committee and ministry', () => {
      const item = parser.parseList(NSM_LIST_HTML).items[0];
      expect(item.committee).toBe('과학기술정보방송통신위원회');
      expect(item.ministry).toBe('과학기술정보통신부');
    });

    test('parses progressStatus and progressDate', () => {
      const item = parser.parseList(NSM_LIST_HTML).items[0];
      expect(item.progressStatus).toBe('위원회 회부');
      expect(item.progressDate).toBe('2026.05.03.');
    });

    test('parses resolutionStatus and resolutionDate', () => {
      const item = parser.parseList(NSM_LIST_HTML).items[0];
      expect(item.resolutionStatus).toBe('원안가결');
      expect(item.resolutionDate).toBe('2026.05.20.');
    });

    test('pending bill: committee is empty string, ministry is set', () => {
      const item = parser.parseList(NSM_LIST_HTML_PENDING).items[0];
      expect(item.committee).toBe('');
      expect(item.ministry).toBe('개인정보보호위원회');
    });

    test('pending bill: resolutionStatus and resolutionDate are empty strings', () => {
      const item = parser.parseList(NSM_LIST_HTML_PENDING).items[0];
      expect(item.resolutionStatus).toBe('');
      expect(item.resolutionDate).toBe('');
    });

    test('returns the introduced status for a pending bill', () => {
      const item = parser.parseList(NSM_LIST_HTML_PENDING).items[0];
      expect(item.progressStatus).toBe('발의');
    });

    test('falls back to items.length when pagination markup is absent', () => {
      const minimalHtml = `
        <table><tbody>
          <tr>
            <td data-th="의안명"><a href="/gcom/nsmLmSts/out/1/detailRP">A</a></td>
            <td data-th="제안자(제안일자)"><p>홍길동</p><p>(2026.01.01.)</p></td>
            <td data-th="상임위원회(소관부처)"></td>
            <td data-th="국회현황(추진일자)"><p>발의</p></td>
            <td data-th="의결현황(의결일자)"></td>
          </tr>
        </tbody></table>`;
      const result = parser.parseList(minimalHtml);
      expect(result.totalPages).toBe(1);
      expect(result.total).toBe(1);
      expect(result.currentPage).toBe(1);
    });

    test('skips rows without a bill name', () => {
      const htmlNoName = `
        <table><tbody>
          <tr>
            <td data-th="의안명"><a href="/gcom/nsmLmSts/out/1/detailRP"></a></td>
            <td data-th="제안자(제안일자)"></td>
            <td data-th="상임위원회(소관부처)"></td>
            <td data-th="국회현황(추진일자)"></td>
            <td data-th="의결현황(의결일자)"></td>
          </tr>
        </tbody></table>`;
      expect(parser.parseList(htmlNoName).items).toHaveLength(0);
    });
  });

  // ── parseDetail ────────────────────────────────────────────────────────────

  describe('parseDetail', () => {
    test('returns default empty object for empty string', () => {
      const detail = parser.parseDetail('');
      expect(detail.title).toBe('');
      expect(detail.billNo).toBe('');
      expect(detail.proposer).toBe('');
      expect(detail.proposalDate).toBe('');
      expect(detail.session).toBe('');
      expect(detail.proposalInfo).toBe('');
      expect(detail.proposalReason).toBeNull();
      expect(detail.attachments).toHaveLength(0);
    });

    test('picks title h2 (skips empty h2; h3 elements are section headers)', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML);
      expect(detail.title).toBe('인공지능 기본법 일부개정법률안');
    });

    test('parses proposalInfo raw text', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML);
      expect(detail.proposalInfo).toContain('제2219088호');
      expect(detail.proposalInfo).toContain('제435회 국회(임시회)');
    });

    test('extracts billNo from proposalInfo', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML);
      expect(detail.billNo).toBe('2219088');
    });

    test('extracts proposer from proposalInfo', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML);
      expect(detail.proposer).toBe('홍길동의원 등 10인');
    });

    test('extracts proposalDate from proposalInfo', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML);
      expect(detail.proposalDate).toBe('2026. 5. 1.');
    });

    test('extracts session from proposalInfo', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML);
      expect(detail.session).toBe('제435회 국회(임시회)');
    });

    test('parses attachments: fileId and filename (strips a11y_hidden span)', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML);
      expect(detail.attachments).toHaveLength(2);
      expect(detail.attachments[0].fileId).toBe('99001');
      expect(detail.attachments[0].filename).toBe('인공지능기본법안.hwp');
      expect(detail.attachments[1].fileId).toBe('99002');
      expect(detail.attachments[1].filename).toBe(
        '인공지능기본법안검토보고서.pdf',
      );
    });

    test('parses proposalReason from pre tag (br → newline)', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML);
      expect(detail.proposalReason).toBe(
        '인공지능 기술의 발전에 따라\n규제 체계를 정비하고자 함',
      );
    });

    test('preserves blank lines in proposalReason', () => {
      const html = `
        <table>
          <tbody>
            <tr>
              <th>발의정보</th>
              <td>홍길동의원 등 10인, 제2219088호(2026. 5. 1.). 제435회 국회(임시회)</td>
            </tr>
            <tr>
              <th>제안이유</th>
              <td><pre>첫 번째 문장

두 번째 문장</pre></td>
            </tr>
          </tbody>
        </table>
      `;
      const detail = parser.parseDetail(html);
      expect(detail.proposalReason).toBe('첫 번째 문장\n\n두 번째 문장');
    });

    test('preserves missing reason and attachments in a newly received bill', () => {
      const html = `
        <h2>인공지능 데이터센터 산업 진흥에 관한 특별법 일부개정법률안</h2>
        <table><tbody>
          <tr><th>발의정보</th><td>한정애의원 등 11인, 제2222359호(2026. 10. 30.). 제439회 국회(정기회)</td></tr>
          <tr><th>의안원문</th><td><ul><li class="null">첨부파일이 없습니다.</li></ul></td></tr>
          <tr><th>제안이유 및 주요내용</th><td><pre></pre></td></tr>
        </tbody></table>
      `;
      expect(parser.parseDetail(html)).toMatchObject({
        billNo: '2222359',
        proposer: '한정애의원 등 11인',
        proposalReason: null,
        attachments: [],
      });
    });

    test('returns null proposalReason when pre tag is absent', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML_NO_REASON);
      expect(detail.proposalReason).toBeNull();
    });

    test('returns empty attachments when no buttons are present', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML_NO_REASON);
      expect(detail.attachments).toHaveLength(0);
    });

    test('single-proposer format parses without crash', () => {
      const detail = parser.parseDetail(NSM_DETAIL_HTML_NO_REASON);
      expect(detail.proposer).toBe('이영희의원');
      expect(detail.billNo).toBe('2200001');
      expect(detail.session).toBe('제433회 국회(임시회)');
    });
  });
});

// ─── NsmLmSts ─────────────────────────────────────────────────────────────────

describe('NsmLmSts', () => {
  const nsm = new NsmLmSts();

  describe('search title hydration', () => {
    test('hydrates truncated titles sequentially by default', async () => {
      const instance = new NsmLmSts({ hydrateTruncatedTitles: true });
      const httpClient = (
        instance as unknown as {
          httpClient: { get: (url: URL) => Promise<string> };
        }
      ).httpClient;
      let activeRequests = 0;
      let maxActiveRequests = 0;
      const mockGet = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (url) => {
          if (!url.pathname.endsWith('/detailRP')) {
            return (
              NSM_LIST_HTML_TRUNCATED_TITLE +
              NSM_LIST_HTML_TRUNCATED_TITLE.replace(/2219088/g, '2219089')
            );
          }
          activeRequests++;
          maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
          await Promise.resolve();
          activeRequests--;
          return NSM_DETAIL_HTML;
        });
      try {
        const result = await instance.search();
        expect(result.items).toHaveLength(2);
        expect(
          result.items.every((item) => !item.billName.includes('...')),
        ).toBe(true);
        expect(maxActiveRequests).toBe(1);
      } finally {
        mockGet.mockRestore();
      }
    });

    test('skips detail requests when list title is not truncated', async () => {
      const instance = new NsmLmSts();
      const httpClient = (
        instance as unknown as {
          httpClient: { get: (url: URL) => Promise<string> };
        }
      ).httpClient;
      const mockGet = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (url) => {
          const urlString = url.toString();
          if (urlString.includes('/detailRP')) {
            throw new Error('detail should not be requested for full title');
          }
          return NSM_LIST_HTML;
        });

      const result = await instance.search({ pageSize: 1 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].billName).toBe('인공지능 기본법 일부개정법률안');
      expect(mockGet).toHaveBeenCalledTimes(1);
      mockGet.mockRestore();
    });

    test('uses detail html title when list title is truncated', async () => {
      const instance = new NsmLmSts({ hydrateTruncatedTitles: true });
      const httpClient = (
        instance as unknown as {
          httpClient: { get: (url: URL) => Promise<string> };
        }
      ).httpClient;
      const mockGet = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (url) => {
          const urlString = url.toString();
          if (urlString.includes('/detailRP')) {
            return NSM_DETAIL_HTML;
          }
          return NSM_LIST_HTML_TRUNCATED_TITLE;
        });

      const result = await instance.search({ pageSize: 1 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].billName).toBe('인공지능 기본법 일부개정법률안');
      mockGet.mockRestore();
    });

    test('keeps list title when detail request fails', async () => {
      const instance = new NsmLmSts({ hydrateTruncatedTitles: true });
      const httpClient = (
        instance as unknown as {
          httpClient: { get: (url: URL) => Promise<string> };
        }
      ).httpClient;
      const mockGet = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (url) => {
          const urlString = url.toString();
          if (urlString.includes('/detailRP')) {
            throw new Error('detail fetch failed');
          }
          return NSM_LIST_HTML_TRUNCATED_TITLE;
        });

      const result = await instance.search({ pageSize: 1 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].billName).toBe('인공지능 기본법 일부개정...');
      mockGet.mockRestore();
    });

    test('does not fetch details for truncated titles by default', async () => {
      const instance = new NsmLmSts();
      const httpClient = (
        instance as unknown as {
          httpClient: { get: (url: URL) => Promise<string> };
        }
      ).httpClient;
      const mockGet = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (url) => {
          expect(url.toString()).not.toContain('/detailRP');
          return NSM_LIST_HTML_TRUNCATED_TITLE;
        });

      const result = await instance.search({ pageSize: 1 });

      expect(result.items[0]?.billName).toBe('인공지능 기본법 일부개정...');
      expect(mockGet).toHaveBeenCalledTimes(1);
      mockGet.mockRestore();
    });
  });

  // ── constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    test('creates instance without config', () => {
      expect(new NsmLmSts()).toBeInstanceOf(NsmLmSts);
    });

    test('creates instance with empty config object', () => {
      expect(new NsmLmSts({})).toBeInstanceOf(NsmLmSts);
    });

    test('accepts custom userAgent', () => {
      expect(new NsmLmSts({ userAgent: 'Custom Agent' })).toBeInstanceOf(
        NsmLmSts,
      );
    });

    test('accepts custom timeout and retryCount', () => {
      expect(new NsmLmSts({ timeout: 5000, retryCount: 2 })).toBeInstanceOf(
        NsmLmSts,
      );
    });

    test('accepts custom headers', () => {
      expect(
        new NsmLmSts({ customHeaders: { 'Accept-Language': 'ko-KR' } }),
      ).toBeInstanceOf(NsmLmSts);
    });
  });

  // ── parseList / parseDetail (delegation) ──────────────────────────────────

  describe('parseList (delegation)', () => {
    test('delegates to NsmLmStsParser and returns INsmSearchResult', () => {
      const result = nsm.parseList(NSM_LIST_HTML);
      expect(result.total).toBe(3142);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].billName).toBe('인공지능 기본법 일부개정법률안');
    });

    test('returns empty result for empty html', () => {
      const result = nsm.parseList('');
      expect(result.items).toHaveLength(0);
    });
  });

  describe('parseDetail (delegation)', () => {
    test('delegates to NsmLmStsParser and returns INsmBillDetail', () => {
      const detail = nsm.parseDetail(NSM_DETAIL_HTML);
      expect(detail.title).toBe('인공지능 기본법 일부개정법률안');
      expect(detail.billNo).toBe('2219088');
      expect(detail.attachments).toHaveLength(2);
    });
  });

  // ── getDetailHTML validation ───────────────────────────────────────────────

  describe('getDetailHTML input validation', () => {
    test('throws when billNo is empty string', async () => {
      await expect(nsm.getDetailHTML('')).rejects.toThrow('billNo is required');
    });

    test('throws when billNo is whitespace only', async () => {
      await expect(nsm.getDetailHTML('   ')).rejects.toThrow(
        'billNo is required',
      );
    });
  });

  describe('fixture-backed requests', () => {
    let mockGet: jest.SpyInstance<Promise<string>, [URL]>;

    beforeEach(() => {
      mockGet = jest.spyOn(getHttpClient(nsm), 'get');
    });

    test('passes search filters and parses the returned page', async () => {
      mockGet.mockResolvedValue(NSM_LIST_HTML);
      const query = {
        pageSize: 5,
        pageIndex: 2,
        scBlNmSct: '인공지능',
        sortOrder: 'ASC',
      } satisfies Parameters<NsmLmSts['search']>[0];
      const result = await nsm.search(query);
      expect(result).toEqual(nsm.parseList(NSM_LIST_HTML));
      const [url] = mockGet.mock.calls[0];
      expect(url.pathname).toBe(Config.NSM_LIST_URL);
      expect(url.searchParams.get('scBlNm')).toBe('scBlNm_blNm');
      for (const [name, value] of Object.entries(query))
        expect(url.searchParams.get(name)).toBe(String(value));
    });

    test('applies the pending-status filter while retaining other filters', async () => {
      mockGet.mockResolvedValue(NSM_LIST_HTML_PENDING);
      const result = await nsm.searchPending({ pageSize: 5, sugCd: '22' });
      expect(result.items[0].progressStatus).toBe('발의');
      const [url] = mockGet.mock.calls[0];
      expect(url.searchParams.get('rslRsltNmL')).toBe('900101');
      expect(url.searchParams.get('sugCd')).toBe('22');
      expect(url.searchParams.get('pageSize')).toBe('5');
    });

    test('parses a requested detail page without a second list request', async () => {
      mockGet.mockResolvedValue(NSM_DETAIL_HTML);
      const detail = await nsm.getDetail(' 2219088 ');
      expect(detail.billNo).toBe('2219088');
      expect(detail.title).toBe('인공지능 기본법 일부개정법률안');
      expect(detail.attachments).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet.mock.calls[0][0].pathname).toBe(
        '/gcom/nsmLmSts/out/2219088/detailRP',
      );
    });

    test('requests explicit page numbers and returns their parsed items', async () => {
      mockGet.mockResolvedValue(NSM_LIST_HTML);
      const result = await nsm.getPage(2, { pageSize: 5 });
      expect(result).toEqual(nsm.parseList(NSM_LIST_HTML).items);
      const [url] = mockGet.mock.calls[0];
      expect(url.searchParams.get('pageIndex')).toBe('2');
      expect(url.searchParams.get('pageSize')).toBe('5');
    });

    test('propagates required list and detail request errors', async () => {
      mockGet.mockRejectedValue(new Error('transport unavailable'));
      await expect(nsm.search()).rejects.toThrow('transport unavailable');
      await expect(nsm.getDetail('2219088')).rejects.toThrow(
        'transport unavailable',
      );
    });

    test.each(['all', 'pending'])(
      'yields %s pages in order with the requested filters',
      async (kind) => {
        mockGet.mockImplementation(async (url) => {
          const page = url.searchParams.get('pageIndex');
          return NSM_LIST_HTML_PENDING.replace(
            '<em>1</em>',
            `<em>${page}</em>`,
          );
        });
        const pages: INsmSearchResult[] = [];
        const iterator =
          kind === 'all'
            ? nsm.getAllPages({}, { maxPages: 3, delayMs: 0, concurrency: 2 })
            : nsm.getAllPendingPages(
                {},
                { maxPages: 3, delayMs: 0, concurrency: 2 },
              );
        for await (const page of iterator) pages.push(page);
        expect(pages.map((page) => page.currentPage)).toEqual([1, 2, 3]);
        expect(mockGet).toHaveBeenCalledTimes(3);
        if (kind === 'pending') {
          for (const [url] of mockGet.mock.calls)
            expect(url.searchParams.get('rslRsltNmL')).toBe('900101');
        }
      },
    );

    test('stops pagination when the next page is empty', async () => {
      mockGet.mockResolvedValueOnce(NSM_LIST_HTML).mockResolvedValue('');
      const pages: INsmSearchResult[] = [];
      for await (const page of nsm.getAllPages({}, { delayMs: 0 }))
        pages.push(page);
      expect(pages).toHaveLength(2);
      expect(pages[1].items).toEqual([]);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  // ── Screenshot functionality ──────────────────────────────────────────────

  describe('Screenshot functionality', () => {
    test('creates instance with screenshot config', () => {
      const instance = new NsmLmSts({
        screenshot: {
          enabled: true,
          fullPage: true,
          width: 1280,
          height: 800,
          format: 'png',
        },
      });
      expect(instance).toBeInstanceOf(NsmLmSts);
    });

    test('throws error when screenshot is disabled', async () => {
      const instance = new NsmLmSts({ screenshot: { enabled: false } });
      await expect(
        instance.takeScreenshot('https://example.com'),
      ).rejects.toThrow('Screenshot feature is not enabled');
    });

    test('accepts jpeg format with quality option', () => {
      const instance = new NsmLmSts({
        screenshot: { enabled: true, format: 'jpeg', quality: 85 },
      });
      expect(instance).toBeInstanceOf(NsmLmSts);
    });

    test('updateScreenshotConfig modifies screenshot settings', () => {
      const instance = new NsmLmSts({
        screenshot: { enabled: true, format: 'png' },
      });
      instance.updateScreenshotConfig({ format: 'jpeg', quality: 70 });
      expect(instance).toBeInstanceOf(NsmLmSts);
    });

    test('closes an unused crawler without starting a browser', async () => {
      const instance = new NsmLmSts({ screenshot: { enabled: true } });
      await instance.closeBrowser();
      expect(instance.browser).toBeNull();
    });
  });
});
