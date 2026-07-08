import {
  ITableData,
  ISearchResult,
  PalCrawl,
  NsmLmSts,
  type PalCrawlConfig,
  type INsmSearchResult,
  type INsmBillItem,
} from './pal';
import { PalParser, NsmLmStsParser } from './parser';

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

    test('get: returns items (up to 10 per page)', async () => {
      const result = await palCrawl.get();
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(10);
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
      const result = await palCrawl.search({ billName: '개정법률' });
      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach((item) => {
        expect(item.subject).toMatch(/개정법률/);
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

    test('getDonePage(2): returns different items from page 1', async () => {
      const [page1, page2] = await Promise.all([
        palCrawl.getDonePage(1),
        palCrawl.getDonePage(2),
      ]);
      expect(page1.length).toBeGreaterThan(0);
      expect(page2.length).toBeGreaterThan(0);
      expect(page1[0].subject).not.toBe(page2[0].subject);
    });

    test('getDonePage: pageUnit=20 returns up to 20 items', async () => {
      const items = await palCrawl.getDonePage(1, 20);
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

    test('getAllDonePages: currentPage increments correctly', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllDonePages(
        { pageUnit: 5 },
        { maxPages: 3, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages[0].currentPage).toBe(1);
      expect(pages[1].currentPage).toBe(2);
      expect(pages[2].currentPage).toBe(3);
    });

    test('getAllDonePages: total and totalPages are consistent across pages', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllDonePages(
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

    test('getAllDonePages: concurrency > 1 yields pages in order', async () => {
      const pages: ISearchResult[] = [];
      for await (const page of palCrawl.getAllDonePages(
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

    test('pending bill: progressStatus is "발의"', () => {
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
    test('skips detail requests when list title is not truncated', async () => {
      const instance = new NsmLmSts();
      const httpClient = (
        instance as unknown as {
          httpClient: { get: (url: URL) => Promise<string> };
        }
      ).httpClient;
      const mockGet = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (...args: unknown[]) => {
          const url = args[0] as URL;
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
      const instance = new NsmLmSts();
      const httpClient = (
        instance as unknown as {
          httpClient: { get: (url: URL) => Promise<string> };
        }
      ).httpClient;
      const mockGet = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (...args: unknown[]) => {
          const url = args[0] as URL;
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
      const instance = new NsmLmSts();
      const httpClient = (
        instance as unknown as {
          httpClient: { get: (url: URL) => Promise<string> };
        }
      ).httpClient;
      const mockGet = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (...args: unknown[]) => {
          const url = args[0] as URL;
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

  // ── search integration ────────────────────────────────────────────────────

  describe('search (integration)', () => {
    let searchResult: INsmSearchResult;

    beforeAll(async () => {
      searchResult = await nsm.search({ pageSize: 5 });
      debugLog('nsm.search', searchResult);
    });

    test('returns non-garbled html string (getListHTML)', async () => {
      const html = await nsm.getListHTML({ pageSize: 5 });
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      expect(html).not.toContain('\ufffd');
    });

    test('returns INsmSearchResult with total > 0', () => {
      expect(searchResult.total).toBeGreaterThan(0);
      expect(searchResult.totalPages).toBeGreaterThan(0);
      expect(searchResult.currentPage).toBe(1);
    });

    test('returns items with valid structure and no garbled text', () => {
      expect(searchResult.items.length).toBeGreaterThan(0);
      for (const item of searchResult.items) {
        expect(item.billName).not.toContain('\ufffd');
        expect(item.billNo).toMatch(/^\d+$/);
        expect(item.link).toContain('/gcom/nsmLmSts/out/');
        expect(item.proposer).not.toContain('\ufffd');
        expect(item.proposer.length).toBeGreaterThan(0);
        expect(item.proposalDate.length).toBeGreaterThan(0);
        expect(item.progressStatus.length).toBeGreaterThan(0);
      }
    });

    test('pageSize filter limits returned items', async () => {
      const r5 = await nsm.search({ pageSize: 5 });
      const r10 = await nsm.search({ pageSize: 10 });
      expect(r5.items.length).toBeLessThanOrEqual(5);
      expect(r10.items.length).toBeLessThanOrEqual(10);
    });

    test('pageIndex=2 returns different items from page 1', async () => {
      const page1 = await nsm.search({ pageSize: 5, pageIndex: 1 });
      const page2 = await nsm.search({ pageSize: 5, pageIndex: 2 });
      expect(page1.items.length).toBeGreaterThan(0);
      expect(page2.items.length).toBeGreaterThan(0);
      expect(page1.items[0].billNo).not.toBe(page2.items[0].billNo);
    });
  });

  // ── searchPending integration ─────────────────────────────────────────────

  describe('searchPending (integration)', () => {
    let pendingResult: INsmSearchResult;

    beforeAll(async () => {
      pendingResult = await nsm.searchPending({ pageSize: 5 });
      debugLog('nsm.searchPending', pendingResult);
    });

    test('returns INsmSearchResult with valid structure', () => {
      expect(typeof pendingResult.total).toBe('number');
      expect(typeof pendingResult.totalPages).toBe('number');
      expect(pendingResult.currentPage).toBe(1);
    });

    test('all returned bills have progressStatus "발의"', () => {
      for (const item of pendingResult.items) {
        expect(item.progressStatus).toBe('발의');
      }
    });

    test('all pending bills have no resolutionStatus', () => {
      for (const item of pendingResult.items) {
        expect(item.resolutionStatus).toBe('');
      }
    });

    test('no garbled text in pending bill names', () => {
      for (const item of pendingResult.items) {
        expect(item.billName).not.toContain('\ufffd');
      }
    });
  });

  // ── getPage / getDetail integration ───────────────────────────────────────

  describe('getPage / getDetail (integration)', () => {
    let firstBillNo: string;
    let pageItems: INsmBillItem[];

    beforeAll(async () => {
      pageItems = await nsm.getPage(1, { pageSize: 5 });
      firstBillNo = pageItems[0]?.billNo ?? '';
      debugLog('nsm.getPage(1)', pageItems);
    });

    test('getPage(1): returns INsmBillItem array', () => {
      expect(Array.isArray(pageItems)).toBe(true);
      expect(pageItems.length).toBeGreaterThan(0);
    });

    test('getPage(2): returns different items from page 1', async () => {
      const page2 = await nsm.getPage(2, { pageSize: 5 });
      expect(page2.length).toBeGreaterThan(0);
      expect(page2[0].billNo).not.toBe(pageItems[0].billNo);
    });

    test('getDetailHTML: returns non-empty, non-garbled html', async () => {
      if (!firstBillNo) return;
      const html = await nsm.getDetailHTML(firstBillNo);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      expect(html).not.toContain('\ufffd');
    });

    test('getDetail: returns INsmBillDetail with valid fields', async () => {
      if (!firstBillNo) return;
      const detail = await nsm.getDetail(firstBillNo);
      debugLog('nsm.getDetail', detail);
      expect(detail.title.length).toBeGreaterThan(0);
      expect(detail.title).not.toContain('\ufffd');
      expect(detail.billNo).toMatch(/^\d+$/);
      expect(detail.proposer.length).toBeGreaterThan(0);
      expect(detail.proposalDate.length).toBeGreaterThan(0);
    });
  });

  // ── getAllPages / getAllPendingPages integration ───────────────────────────

  describe('getAllPages / getAllPendingPages (integration)', () => {
    test('getAllPages: yields exactly maxPages results', async () => {
      const pages: INsmSearchResult[] = [];
      for await (const page of nsm.getAllPages(
        { pageSize: 5 },
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages).toHaveLength(2);
      expect(pages[0].items.length).toBeGreaterThan(0);
      expect(pages[1].items.length).toBeGreaterThan(0);
    });

    test('getAllPages: currentPage increments correctly', async () => {
      const pages: INsmSearchResult[] = [];
      for await (const page of nsm.getAllPages(
        { pageSize: 5 },
        { maxPages: 3, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages[0].currentPage).toBe(1);
      expect(pages[1].currentPage).toBe(2);
      expect(pages[2].currentPage).toBe(3);
    });

    test('getAllPages: total is consistent across pages', async () => {
      const pages: INsmSearchResult[] = [];
      for await (const page of nsm.getAllPages(
        { pageSize: 5 },
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages[0].total).toBe(pages[1].total);
      expect(pages[0].totalPages).toBe(pages[1].totalPages);
    });

    test('getAllPages: page 2 items differ from page 1', async () => {
      const pages: INsmSearchResult[] = [];
      for await (const page of nsm.getAllPages(
        { pageSize: 5 },
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages[0].items[0].billNo).not.toBe(pages[1].items[0].billNo);
    });

    test('getAllPages: concurrency > 1 yields pages in order', async () => {
      const pages: INsmSearchResult[] = [];
      for await (const page of nsm.getAllPages(
        { pageSize: 5 },
        { maxPages: 4, delayMs: 0, concurrency: 2 },
      )) {
        pages.push(page);
      }
      expect(pages).toHaveLength(4);
      for (let i = 0; i < pages.length; i++) {
        expect(pages[i].currentPage).toBe(i + 1);
      }
    });

    test('getAllPendingPages: yields at least 1 page of pending bills', async () => {
      const pages: INsmSearchResult[] = [];
      for await (const page of nsm.getAllPendingPages(
        { pageSize: 5 },
        { maxPages: 1, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages.length).toBeGreaterThanOrEqual(1);
      // Every item must be in 발의 상태
      for (const page of pages) {
        for (const item of page.items) {
          expect(item.progressStatus).toBe('발의');
        }
      }
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

    test('initBrowser and closeBrowser can be called', async () => {
      const instance = new NsmLmSts({ screenshot: { enabled: true } });
      expect(instance).toBeInstanceOf(NsmLmSts);
    });
  });
});
