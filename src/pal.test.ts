import { ITableData, PalCrawl, type PalCrawlConfig } from './pal';
import { PalParser } from './parser';

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

// ─── PalParser ────────────────────────────────────────────────────────────────

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
});
