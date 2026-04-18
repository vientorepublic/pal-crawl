import { ITableData, PalCrawl, type PalCrawlConfig } from './pal';

const FIXED_CONTENT_ID = 'PRC_W2W6V0D4D0B9C1B4B4Z6V2W0U7V2T9';
const SHOULD_DEBUG = process.env.PAL_CRAWL_TEST_DEBUG === '1';

const debugLog = (label: string, value: unknown): void => {
  if (!SHOULD_DEBUG) {
    return;
  }
  console.debug(label, JSON.stringify(value, null, 2));
};

let table: ITableData[];
let listHtml = '';
let contentHtml = '';
let fixedContent: Awaited<ReturnType<PalCrawl['getContent']>>;

describe('PalCrawl', () => {
  const palCrawl = new PalCrawl();

  beforeAll(async () => {
    [listHtml, contentHtml] = await Promise.all([
      palCrawl.getPalHTML(),
      palCrawl.getContentHTML(FIXED_CONTENT_ID),
    ]);
    table = palCrawl.parseTable(listHtml);
    fixedContent = palCrawl.parseContent(contentHtml);
    debugLog('table', table);
    debugLog('content', fixedContent);
  });

  test('getPalHTML: should be return string', () => {
    expect(typeof listHtml).toBe('string');
    expect(listHtml).not.toContain('�');
  });
  test('constructor: should use custom userAgent when provided in config', async () => {
    const config: PalCrawlConfig = {
      userAgent: 'Custom User Agent',
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use default userAgent when config is empty', async () => {
    const palCrawl = new PalCrawl({});
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use default userAgent when no config provided', async () => {
    const palCrawl = new PalCrawl();
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('parseTable: array length should be 0 when invalid html', () => {
    const palCrawl = new PalCrawl();
    const table = palCrawl.parseTable('asdf');
    expect(table).toHaveLength(0);
  });
  test('parseContent: should parse title, reason, and bill information table fields', () => {
    const palCrawl = new PalCrawl();
    const html = `
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

    const content = palCrawl.parseContent(html);

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
  test('getContentHTML: should prefetch real content html by fixed id', () => {
    expect(typeof contentHtml).toBe('string');
    expect(contentHtml.length).toBeGreaterThan(0);
  });

  test('getContent: should parse prefetched content html by fixed id', () => {
    const content = fixedContent;

    expect(content.title.length).toBeGreaterThan(0);
    expect(content.proposalReason).not.toBeNull();
    expect(content.proposalReason?.length ?? 0).toBeGreaterThan(0);
    expect(content.billNumber).not.toBeNull();
    expect(content.proposer).not.toBeNull();
    expect(content.proposalDate).not.toBeNull();
    expect(content.committee).not.toBeNull();
    expect(content.referralDate).not.toBeNull();
    expect(content.noticePeriod).not.toBeNull();
    expect(content.proposalSession).not.toBeNull();
    expect(content.title).not.toContain('�');
    expect(content.proposalReason ?? '').not.toContain('�');
  });
  test('get: array length should be 10', async () => {
    expect(table).toHaveLength(10);
  });
  test('get: URL string of the attachment object should not be empty', () => {
    table.forEach((e) => {
      expect(e.attachments.pdfFile).not.toBe('');
      expect(e.attachments.hwpFile).not.toBe('');
      expect(e.subject).not.toContain('�');
      expect(e.proposerCategory).not.toContain('�');
      expect(e.committee).not.toContain('�');
      expect(e.contentId).not.toBeNull();
      expect(e.contentId?.startsWith('PRC_')).toBe(true);
    });
  });
  test('constructor: should use custom timeout when provided', () => {
    const config: PalCrawlConfig = {
      timeout: 5000,
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use custom retryCount when provided', () => {
    const config: PalCrawlConfig = {
      retryCount: 5,
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use custom headers when provided', () => {
    const config: PalCrawlConfig = {
      customHeaders: {
        'Accept-Language': 'ko-KR',
        'Custom-Header': 'test-value',
      },
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use all custom config options', () => {
    const config: PalCrawlConfig = {
      userAgent: 'Custom Agent',
      timeout: 15000,
      retryCount: 2,
      customHeaders: {
        Accept: 'application/json',
      },
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
});
