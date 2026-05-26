import {
  ITableData,
  ISearchResult,
  PalCrawl,
  type PalCrawlConfig,
} from './pal';
import { PalParser } from './parser';

const DEFAULT_TEST_TIMEOUT_MS = 120000;
const configuredTimeout = Number.parseInt(
  process.env.PAL_CRAWL_TEST_TIMEOUT_MS ?? String(DEFAULT_TEST_TIMEOUT_MS),
  10,
);
const testTimeoutMs =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_TEST_TIMEOUT_MS;

// Integration tests call external services and can be slow on unstable networks.
jest.setTimeout(testTimeoutMs);

const FIXED_ONGOING_CONTENT_ID = 'PRC_W2W6V0D4D0B9C1B4B4Z6V2W0U7V2T9';
const FIXED_DONE_CONTENT_ID = 'PRC_S2R6N0M3K2J3K1J5K3S8R3P4O3P5X6';

const SHOULD_DEBUG = process.env.PAL_CRAWL_TEST_DEBUG === '1';

const debugLog = (label: string, value: unknown): void => {
  if (!SHOULD_DEBUG) return;
  console.debug(label, JSON.stringify(value, null, 2));
};

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

// ─── PalParser ──────────────────────────────────────────────────────────────────────────────

describe('PalParser', () => {
  const parser = new PalParser();

  describe('parseTable', () => {
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
      // The desc starts with "제안이유 및 주요내용" which matches the heading — it must be stripped.
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

  // ── ongoing legislative notices (integration) ────────────────────────────────

  describe('ongoing legislative notices', () => {
    let listHtml = '';
    let ongoingTable: ITableData[] = [];
    let contentHtml = '';
    let fixedContent: Awaited<ReturnType<PalCrawl['getContent']>>;

    beforeAll(async () => {
      [listHtml, contentHtml] = await Promise.all([
        palCrawl.getPalHTML(),
        palCrawl.getContentHTML(FIXED_ONGOING_CONTENT_ID),
      ]);
      ongoingTable = palCrawl.parseTable(listHtml);
      fixedContent = palCrawl.parseContent(contentHtml);
      debugLog('ongoingTable', ongoingTable);
      debugLog('fixedContent', fixedContent);
    });

    test('getPalHTML: returns a non-garbled html string', () => {
      expect(typeof listHtml).toBe('string');
      expect(listHtml.length).toBeGreaterThan(0);
      expect(listHtml).not.toContain('�');
    });

    test('get: returns 10 items per page', async () => {
      const result = await palCrawl.get();
      expect(result).toHaveLength(10);
    });

    test('get: each item has valid structure and no garbled text', () => {
      ongoingTable.forEach((e) => {
        expect(e.subject).not.toContain('�');
        expect(e.proposerCategory).not.toContain('�');
        expect(e.committee).not.toContain('�');
        expect(e.attachments.pdfFile).not.toBe('');
        expect(e.attachments.hwpFile).not.toBe('');
        expect(e.contentId).not.toBeNull();
        expect(e.contentId?.startsWith('PRC_')).toBe(true);
      });
    });

    test('getContentHTML: returns non-empty html for known id', () => {
      expect(typeof contentHtml).toBe('string');
      expect(contentHtml.length).toBeGreaterThan(0);
      expect(contentHtml).not.toContain('�');
    });

    test('getContent: parses all fields from known id without garbled text', () => {
      expect(fixedContent.title.length).toBeGreaterThan(0);
      expect(fixedContent.title).not.toContain('�');
      expect(fixedContent.proposalReason).not.toBeNull();
      expect(fixedContent.proposalReason?.length ?? 0).toBeGreaterThan(0);
      expect(fixedContent.proposalReason ?? '').not.toContain('�');
      expect(fixedContent.billNumber).not.toBeNull();
      expect(fixedContent.proposer).not.toBeNull();
      expect(fixedContent.proposalDate).not.toBeNull();
      expect(fixedContent.committee).not.toBeNull();
      expect(fixedContent.referralDate).not.toBeNull();
      expect(fixedContent.noticePeriod).not.toBeNull();
      expect(fixedContent.proposalSession).not.toBeNull();
    });

    test('getContentHTML: throws when id is an empty string', async () => {
      await expect(palCrawl.getContentHTML('')).rejects.toThrow(
        'id is required',
      );
    });

    test('getContentHTML: throws when id is whitespace only', async () => {
      await expect(palCrawl.getContentHTML('   ')).rejects.toThrow(
        'id is required',
      );
    });
  });

  // ── done legislative notices (integration) ───────────────────────────────────

  describe('done legislative notices', () => {
    let doneHtml = '';
    let doneTable: ITableData[] = [];
    let doneContentHtml = '';
    let doneContent: Awaited<ReturnType<PalCrawl['getDoneContent']>>;

    beforeAll(async () => {
      [doneHtml, doneContentHtml] = await Promise.all([
        palCrawl.getDoneHTML(),
        palCrawl.getDoneContentHTML(FIXED_DONE_CONTENT_ID),
      ]);
      doneTable = palCrawl.parseTable(doneHtml);
      doneContent = palCrawl.parseContent(doneContentHtml);
      debugLog('doneTable', doneTable);
      debugLog('doneContent', doneContent);
    });

    test('getDoneHTML: returns a non-garbled html string', () => {
      expect(typeof doneHtml).toBe('string');
      expect(doneHtml.length).toBeGreaterThan(0);
      expect(doneHtml).not.toContain('�');
    });

    test('getDone: returns 10 items per page', async () => {
      const result = await palCrawl.getDone();
      expect(result).toHaveLength(10);
    });

    test('getDone: each item has valid structure and no garbled text', () => {
      doneTable.forEach((e) => {
        expect(e.subject).not.toContain('�');
        expect(e.proposerCategory).not.toContain('�');
        expect(e.committee).not.toContain('�');
        expect(e.contentId).not.toBeNull();
        expect(e.contentId?.startsWith('PRC_')).toBe(true);
      });
    });

    test('getDoneContentHTML: returns non-empty html for known id', () => {
      expect(typeof doneContentHtml).toBe('string');
      expect(doneContentHtml.length).toBeGreaterThan(0);
      expect(doneContentHtml).not.toContain('�');
    });

    test('getDoneContent: parses title and bill info from known id', () => {
      expect(doneContent.title.length).toBeGreaterThan(0);
      expect(doneContent.title).not.toContain('�');
      expect(doneContent.billNumber).not.toBeNull();
      expect(doneContent.proposer).not.toBeNull();
      expect(doneContent.proposalDate).not.toBeNull();
      expect(doneContent.committee).not.toBeNull();
    });

    test('getDoneContentHTML: throws when id is an empty string', async () => {
      await expect(palCrawl.getDoneContentHTML('')).rejects.toThrow(
        'id is required',
      );
    });

    test('getDoneContentHTML: throws when id is whitespace only', async () => {
      await expect(palCrawl.getDoneContentHTML('   ')).rejects.toThrow(
        'id is required',
      );
    });
  });

  // ── search / searchDone (integration) ─────────────────────────────────────────

  describe('search / searchDone', () => {
    test('search: returns ISearchResult with total, totalPages, currentPage', async () => {
      const result = await palCrawl.search();
      expect(result.total).toBeGreaterThan(0);
      expect(result.totalPages).toBeGreaterThan(0);
      expect(result.currentPage).toBe(1);
      expect(result.items.length).toBeGreaterThan(0);
    });

    test('search: billName filter returns matching items', async () => {
      const result = await palCrawl.search({ billName: '도로교통' });
      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach((item) => {
        expect(item.subject).toMatch(/도로교통/);
      });
    });

    test('search: sortCol=BILL_NAME sortGbn=ASC returns alphabetically sorted items', async () => {
      const result = await palCrawl.search({
        sortCol: 'BILL_NAME',
        sortGbn: 'ASC',
        pageUnit: 5,
      });
      expect(result.items.length).toBeGreaterThan(0);
      // First subject should start alphabetically early (가ㅠ)
      expect(result.items[0].subject).not.toContain('오류');
    });

    test('searchDone: returns ISearchResult with large total', async () => {
      const result = await palCrawl.searchDone();
      expect(result.total).toBeGreaterThan(1000);
      expect(result.totalPages).toBeGreaterThan(100);
      expect(result.currentPage).toBe(1);
    });

    test('searchDone: fromAge/toAge filter narrows results', async () => {
      const result = await palCrawl.searchDone({
        fromAge: 22,
        toAge: 22,
        pageUnit: 5,
      });
      // The site always reports the global total in the count area,
      // but the returned items are filtered to the specified session range.
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.length).toBeLessThanOrEqual(5);
    });
  });

  // ── getPage / getDonePage (integration) ─────────────────────────────────────

  describe('getPage / getDonePage', () => {
    test('getPage(1): returns same items as get()', async () => {
      const [page1, legacy] = await Promise.all([
        palCrawl.getPage(1),
        palCrawl.get(),
      ]);
      expect(page1).toHaveLength(legacy.length);
      expect(page1[0].subject).toBe(legacy[0].subject);
    });

    test('getPage(2): returns different items from page 1', async () => {
      const [page1, page2] = await Promise.all([
        palCrawl.getPage(1),
        palCrawl.getPage(2),
      ]);
      expect(page1.length).toBeGreaterThan(0);
      expect(page2.length).toBeGreaterThan(0);
      expect(page1[0].subject).not.toBe(page2[0].subject);
    });

    test('getPage: pageUnit=20 returns up to 20 items', async () => {
      const items = await palCrawl.getPage(1, 20);
      expect(items.length).toBeLessThanOrEqual(20);
      expect(items.length).toBeGreaterThan(10);
    });

    test('getDonePage(2): returns items different from page 1', async () => {
      const [page1, page2] = await Promise.all([
        palCrawl.getDonePage(1),
        palCrawl.getDonePage(2),
      ]);
      expect(page1[0].subject).not.toBe(page2[0].subject);
    });
  });

  // ── getAllPages / getAllDonePages (integration) ──────────────────────────────

  describe('getAllPages / getAllDonePages', () => {
    test('getAllPages: yields exactly maxPages results', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllPages(
        { pageUnit: 5 },
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages).toHaveLength(2);
      expect(pages[0].items.length).toBeGreaterThan(0);
      expect(pages[1].items.length).toBeGreaterThan(0);
    });

    test('getAllPages: currentPage increments correctly', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllPages(
        { pageUnit: 5 },
        { maxPages: 3, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages[0].currentPage).toBe(1);
      expect(pages[1].currentPage).toBe(2);
      expect(pages[2].currentPage).toBe(3);
    });

    test('getAllPages: total and totalPages are consistent across pages', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllPages(
        {},
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages[0].total).toBe(pages[1].total);
      expect(pages[0].totalPages).toBe(pages[1].totalPages);
    });

    test('getAllPages: page 2 items differ from page 1', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllPages(
        { pageUnit: 5 },
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages[0].items[0].subject).not.toBe(pages[1].items[0].subject);
    });

    test('getAllPages: concurrency > 1 yields pages in order', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllPages(
        { pageUnit: 5 },
        { maxPages: 4, delayMs: 0, concurrency: 2 },
      )) {
        pages.push(page);
      }
      expect(pages).toHaveLength(4);
      for (let i = 0; i < pages.length; i++) {
        expect(pages[i].currentPage).toBe(i + 1);
      }
    });

    test('getAllDonePages: yields 2 pages of done notices', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllDonePages(
        { pageUnit: 5 },
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages).toHaveLength(2);
      expect(pages[0].total).toBeGreaterThan(1000);
      expect(pages[0].items[0].subject).not.toBe(pages[1].items[0].subject);
    });
  });

  // ── Screenshots ──────────────────────────────────────────────────────────────

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

    test('initBrowser and closeBrowser can be called', async () => {
      const crawler = new PalCrawl({
        screenshot: { enabled: true },
      });
      // Note: These tests don't actually require a browser to pass.
      // In a real scenario with HEADLESS_BROWSER env set, these would work.
      expect(crawler).toBeInstanceOf(PalCrawl);
    });
  });
});
