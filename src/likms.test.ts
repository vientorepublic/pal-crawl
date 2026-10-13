import { PalCrawl } from './pal';
import { LikmsCrawler, LikmsStateCrawler } from './likms';
import {
  LikmsDetailParser,
  LikmsStateParser,
  type ILikmsStateBillItem,
  type ILikmsStateSearchResult,
} from './parser';

// ─── HTML Fixtures (실제 캡처 구조를 축약) ─────────────────────────────────────

const LIKMS_DETAIL_PAGE_HTML = `
<div class="content" id="content">
  <div class="page_title">
    <h3 class="detailh3">[2221798] 유아교육법 일부개정법률안(김문수의원 등 12인)</h3>
  </div>
  <div class="content">
    <form id="form" name="form">
      <input type="hidden" id="billId" name="billId" value="PRC_G2G6E0D9E2Z3A1Y7Z5X1Y0W4E9E6D5">
      <input type="hidden" id="billNo" name="billNo" value="2221798">
      <input type="hidden" id="billKindCd" name="billKindCd" value="BKC_0004">
      <input type="hidden" id="currCmtName" name="currCmtName" value="위원회 심사">
      <input type="hidden" id="reexamYn" name="reexamYn" value="N">
      <input type="hidden" id="mainUpdateBillYn" name="mainUpdateBillYn" value="N">
      <input type="hidden" id="billGbnCd" name="billGbnCd" value="">
      <input type="hidden" id="tmprAnYn" name="tmprAnYn" value="N">
      <input type="hidden" id="headMemo" name="headMemo" value="Y">
      <input type="hidden" id="headMemoInfo" name="headMemoInfo" value="비용추계요구서 제출됨.">
      <input type="hidden" id="withdrawCnt" name="withdrawCnt" value="0">
      <input type="hidden" id="intrsBillCnt" name="intrsBillCnt" value="0">
      <input type="hidden" id="stageMemo" name="stageMemo" value="N"/>
    </form>
  </div>
</div>
`;

const LIKMS_BILL_INFO_FRAGMENT_HTML = `
<div id="tab_billInfo_sect">
    <div class="container bill_info" id="container" style="height: auto;">
        <form id="billInfoForm">
            <div class="bill_info_div div_on" id="stage_list">
                <div class="theme_title_wrap"><h3>심사진행단계</h3></div>
            </div>
            <div id="rcp_list" class="theme_area bill_info_div">
                <div class="theme_list">
                    <h3>접수정보</h3>
                    <div>
                        <h4>의안접수정보</h4>
                        <table class="align_center">
                            <tbody id="insc-rcp-row">
                            <tr>
                                <td class="billNo"><i>의안번호</i><span>2221798</span></td>
                                <td class="proposeDt"><i>제안일자</i><span>2026-10-06</span></td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="theme_list" id="prntsummary-sect">
                    <div>
                        <h4>제안이유 및 주요내용</h4>
                        <pre id="prntSummary" class="theme_list_summary" style="height: 130px;">
제안이유 및 주요내용

  현행 「유아교육법」은 원장 등 교원의 유아생활지도에 관한 근거를 두고 있으며, 정당한 유아생활지도에 대해서는 「아동복지법」상 신체적 학대행위로 보지 아니하도록 규정하고 있음.
  그런데 정서적 학대 및 방임의 개념이 포괄적으로 규정되어 있어 유치원에서 이루어지는 정당한 교육활동이나 생활지도까지 아동학대로 신고ㆍ조사되는 등 교육활동이 위축되고 있다는 지적이 있음.
  이에 「아동복지법」 제17조제2항에 따라 원장과 교원이 교육활동 과정에서 하여서는 아니 되는 행위를 구체적으로 규정하여 정당한 교육활동을 보장하고 유아를 보호하려는 것임(안 제21조의3제4항 신설).


참고사항

  이 법률안은 김문수의원이 대표발의한 「아동복지법 일부개정법률안」(의안번호 제21797호)의 의결을 전제로 하는 것이므로 같은 법률안이 의결되지 아니하거나 수정의결되는 경우에는 이에 맞추어 조정되어야 할 것임.</pre>
                    </div>
                    <div class="member_list_more">
                        <a href="javascript:;" id="btnPrntSummaryMore" class="closed">+더보기</a>
                    </div>
                </div>
            </div>
        </form>
    </div>
</div>
`;

/** 심사정보 탭 조각 - 접수정보(제안자·제안회기·문서) 포함 */
const LIKMS_BILL_INFO_FRAGMENT_FULL_HTML = `
<div id="tab_billInfo_sect">
  <div id="rcp_list" class="theme_area bill_info_div">
    <div class="theme_list">
      <h3>접수정보</h3>
      <div>
        <h4>의안접수정보</h4>
        <table class="align_center">
          <tbody id="insc-rcp-row">
          <tr>
            <td class="billNo"><i>의안번호</i><span>2221883</span></td>
            <td class="proposeDt"><i>제안일자</i><span>2026-10-13</span></td>
            <td class="proposer"><i>제안자</i><span>주진우의원 등 10인</span><a href="javascript:;">제안자 목록</a></td>
            <td class="sessionTitle"><i>제안회기</i><span>제22대(2024~2028)제439회</span></td>
            <td class="doc align_left">
              <i>문서</i>
              <div class="report">
                <a class="icon_hwp" href="javascript: goDownload('/filegate/servlet/FileGate?bookId=abc&amp;type=0')" title="의안접수정보 의안원문  (HWP 파일 다운로드)">한글</a>
                <a class="icon_pdf" href="/filegate/servlet/FileGate?bookId=abc&amp;type=1" title="의안접수정보 의안원문  (PDF 파일 다운로드)">PDF</a>
                <a class="icon_preview" href="javascript:;" data-url="/bi/common/preview/pdfPreview.do?bookId=abc" title="의안접수정보 의안원문 미리보기(새창 열림)"></a>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="theme_list" id="prntsummary-sect">
      <pre id="prntSummary">제안이유 및 주요내용

  현행법은 특별검사 임명 절차를 두고 있지 않음.</pre>
    </div>
  </div>
</div>
`;

const LIKMS_BILL_INFO_FRAGMENT_NO_REASON_HTML = `
<div id="tab_billInfo_sect">
    <div id="rcp_list" class="theme_area bill_info_div">
        <div class="theme_list">
            <h3>접수정보</h3>
        </div>
    </div>
</div>
`;

const PAL_CONTENT_HTML_EMPTY_REASON = `
<div class="card-wrap">
    <div class="item">
        <h4>제안이유 및 주요내용</h4>
        <div class="desc">

        </div>
    </div>
    <div class="item">
        <h4>의견제출 방법</h4>
        <div class="desc">
            서울시 영등포구 의사당대로 1(여의도동) 교육위원회
        </div>
    </div>
</div>
`;

const PAL_CONTENT_HTML_WITH_REASON = `
<div class="card-wrap">
    <div class="item">
        <h4>제안이유 및 주요내용</h4>
        <div class="desc">
            현행법은 과태료 처분 기준이 없어 문제라는 지적이 있음.
            이에 과태료 부과 기준을 신설하려는 것임.
        </div>
    </div>
</div>
`;

const EXPECTED_LIKMS_REASON = [
  '현행 「유아교육법」은 원장 등 교원의 유아생활지도에 관한 근거를 두고 있으며, 정당한 유아생활지도에 대해서는 「아동복지법」상 신체적 학대행위로 보지 아니하도록 규정하고 있음.',
  '그런데 정서적 학대 및 방임의 개념이 포괄적으로 규정되어 있어 유치원에서 이루어지는 정당한 교육활동이나 생활지도까지 아동학대로 신고ㆍ조사되는 등 교육활동이 위축되고 있다는 지적이 있음.',
  '이에 「아동복지법」 제17조제2항에 따라 원장과 교원이 교육활동 과정에서 하여서는 아니 되는 행위를 구체적으로 규정하여 정당한 교육활동을 보장하고 유아를 보호하려는 것임(안 제21조의3제4항 신설).',
  '참고사항',
  '이 법률안은 김문수의원이 대표발의한 「아동복지법 일부개정법률안」(의안번호 제21797호)의 의결을 전제로 하는 것이므로 같은 법률안이 의결되지 아니하거나 수정의결되는 경우에는 이에 맞추어 조정되어야 할 것임.',
].join('\n');

const TEST_BILL_ID = 'PRC_G2G6E0D9E2Z3A1Y7Z5X1Y0W4E9E6D5';

type MockableHttpClient = {
  get: (url: URL) => Promise<string>;
  post: (url: URL, body: string) => Promise<string>;
};

const getLikmsHttpClient = (crawler: LikmsCrawler): MockableHttpClient =>
  (crawler as unknown as { httpClient: MockableHttpClient }).httpClient;

// ─── LikmsCrawler ─────────────────────────────────────────────────────────────

describe('LikmsCrawler', () => {
  describe('parseDetailFormParams', () => {
    const crawler = new LikmsCrawler();

    test('extracts hidden form params from detail page', () => {
      const params = crawler.parseDetailFormParams(LIKMS_DETAIL_PAGE_HTML);
      expect(params.billId).toBe(TEST_BILL_ID);
      expect(params.billNo).toBe('2221798');
      expect(params.billKindCd).toBe('BKC_0004');
      expect(params.tmprAnYn).toBe('N');
      expect(params.reexamYn).toBe('N');
      expect(params.withdrawCnt).toBe('0');
    });

    test('keeps empty-valued params (rendering condition)', () => {
      const params = crawler.parseDetailFormParams(LIKMS_DETAIL_PAGE_HTML);
      expect(params.billGbnCd).toBe('');
    });

    test('returns empty object when form is absent', () => {
      expect(crawler.parseDetailFormParams('<div>no form</div>')).toEqual({});
    });
  });

  describe('parseProposalReason', () => {
    const crawler = new LikmsCrawler();

    test('extracts reason from #prntSummary and strips repeated heading', () => {
      const reason = crawler.parseProposalReason(LIKMS_BILL_INFO_FRAGMENT_HTML);
      expect(reason).toBe(EXPECTED_LIKMS_REASON);
    });

    test('reason does not contain the repeated section heading', () => {
      const reason = crawler.parseProposalReason(LIKMS_BILL_INFO_FRAGMENT_HTML);
      expect(reason).not.toMatch(/^제안이유/);
      expect(reason).not.toContain('의안접수정보');
    });

    test('returns null when fragment has no #prntSummary', () => {
      expect(
        crawler.parseProposalReason(LIKMS_BILL_INFO_FRAGMENT_NO_REASON_HTML),
      ).toBeNull();
    });

    test('returns null when #prntSummary is empty', () => {
      expect(crawler.parseProposalReason('<pre id="prntSummary"></pre>')).toBe(
        null,
      );
    });

    test('returns null when #prntSummary contains only the heading', () => {
      expect(
        crawler.parseProposalReason(
          '<pre id="prntSummary">제안이유 및 주요내용</pre>',
        ),
      ).toBeNull();
    });

    test('converts <br> tags to newlines', () => {
      const reason = crawler.parseProposalReason(
        '<pre id="prntSummary">제안이유 및 주요내용\n첫 줄<br>두 줄</pre>',
      );
      expect(reason).toBe('첫 줄\n두 줄');
    });
  });

  describe('getProposalReason', () => {
    const crawler = new LikmsCrawler();

    test('fetches detail page then posts fragment endpoint', async () => {
      const httpClient = getLikmsHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_BILL_INFO_FRAGMENT_HTML);

      const reason = await crawler.getProposalReason(`  ${TEST_BILL_ID}  `);

      expect(reason).toBe(EXPECTED_LIKMS_REASON);

      const getUrl = getSpy.mock.calls[0][0];
      expect(getUrl.toString()).toContain(
        'https://likms.assembly.go.kr/bill/bi/billDetailPage.do',
      );
      expect(getUrl.searchParams.get('billId')).toBe(TEST_BILL_ID);
      expect(getUrl.searchParams.get('currMenuNo')).toBe('2600044');

      const [postUrl, postBody] = postSpy.mock.calls[0];
      expect(postUrl.toString()).toContain(
        'https://likms.assembly.go.kr/bill/bi/bill/detail/billInfo.do',
      );
      expect(postBody).toContain(`billId=${TEST_BILL_ID}`);
      expect(postBody).toContain('billNo=2221798');
      expect(postBody).toContain('billKindCd=BKC_0004');

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('returns null when fragment has no proposal reason', async () => {
      const httpClient = getLikmsHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_BILL_INFO_FRAGMENT_NO_REASON_HTML);

      await expect(crawler.getProposalReason(TEST_BILL_ID)).resolves.toBeNull();

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('never throws when detail page fetch fails', async () => {
      const httpClient = getLikmsHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockRejectedValue(new Error('network down'));

      await expect(crawler.getProposalReason(TEST_BILL_ID)).resolves.toBeNull();

      getSpy.mockRestore();
    });

    test('never throws when fragment post fails', async () => {
      const httpClient = getLikmsHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockRejectedValue(new Error('Bad Request'));

      await expect(crawler.getProposalReason(TEST_BILL_ID)).resolves.toBeNull();

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('returns null for empty billId without network calls', async () => {
      const httpClient = getLikmsHttpClient(crawler);
      const getSpy = jest.spyOn(httpClient, 'get');
      const postSpy = jest.spyOn(httpClient, 'post');

      await expect(crawler.getProposalReason('')).resolves.toBeNull();
      await expect(crawler.getProposalReason('   ')).resolves.toBeNull();
      expect(getSpy).not.toHaveBeenCalled();
      expect(postSpy).not.toHaveBeenCalled();

      getSpy.mockRestore();
      postSpy.mockRestore();
    });
  });

  describe('getDetailPageHTML', () => {
    const crawler = new LikmsCrawler();

    test('throws when billId is empty', async () => {
      await expect(crawler.getDetailPageHTML('')).rejects.toThrow(
        'billId is required',
      );
    });
  });

  describe('resolveBillId', () => {
    test('returns the billId from the JSON payload', async () => {
      const crawler = new LikmsCrawler();
      const getSpy = jest
        .spyOn(getLikmsHttpClient(crawler), 'get')
        .mockResolvedValue(
          JSON.stringify({ data: { billNo: '2221798', billId: TEST_BILL_ID } }),
        );

      await expect(crawler.resolveBillId('2221798')).resolves.toBe(
        TEST_BILL_ID,
      );
      expect(getSpy.mock.calls[0][0].pathname).toBe(
        '/bill/bi/common/findBillDetail.do',
      );
      expect(getSpy.mock.calls[0][0].searchParams.get('billNo')).toBe(
        '2221798',
      );

      jest.restoreAllMocks();
    });

    test('returns null when the payload has no billId', async () => {
      const crawler = new LikmsCrawler();
      jest
        .spyOn(getLikmsHttpClient(crawler), 'get')
        .mockResolvedValue('{"data":{}}');

      await expect(crawler.resolveBillId('2221798')).resolves.toBeNull();
      jest.restoreAllMocks();
    });

    test('returns null for a non-JSON response', async () => {
      const crawler = new LikmsCrawler();
      jest
        .spyOn(getLikmsHttpClient(crawler), 'get')
        .mockResolvedValue('<html>error</html>');

      await expect(crawler.resolveBillId('2221798')).resolves.toBeNull();
      jest.restoreAllMocks();
    });

    test('returns null for empty input without a request', async () => {
      const crawler = new LikmsCrawler();
      const getSpy = jest.spyOn(getLikmsHttpClient(crawler), 'get');

      await expect(crawler.resolveBillId('  ')).resolves.toBeNull();
      expect(getSpy).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    test('propagates network errors', async () => {
      const crawler = new LikmsCrawler();
      jest
        .spyOn(getLikmsHttpClient(crawler), 'get')
        .mockRejectedValue(
          new Error('Invalid response: 500 Internal Server Error'),
        );

      await expect(crawler.resolveBillId('2221798')).rejects.toThrow(
        'Invalid response: 500',
      );
      jest.restoreAllMocks();
    });
  });
});

// ─── LikmsDetailParser ────────────────────────────────────────────────────────

describe('LikmsDetailParser', () => {
  const parser = new LikmsDetailParser();

  describe('parseDetail', () => {
    test('parses title and billNo from the detail page html', () => {
      const detail = parser.parseDetail(LIKMS_DETAIL_PAGE_HTML);

      // `[2221798] ` 접두는 떼고 발의자 괄호는 유지한다.
      expect(detail.title).toBe(
        '유아교육법 일부개정법률안(김문수의원 등 12인)',
      );
      expect(detail.billNo).toBe('2221798');
      // 상세 페이지에는 접수정보가 없다.
      expect(detail.proposer).toBe('');
      expect(detail.proposalDate).toBe('');
      expect(detail.session).toBe('');
      expect(detail.attachments).toHaveLength(0);
    });

    test('parses 접수정보 and the proposal reason from the billInfo fragment', () => {
      const detail = parser.parseDetail(LIKMS_BILL_INFO_FRAGMENT_HTML);

      expect(detail.title).toBe('');
      expect(detail.billNo).toBe('2221798');
      expect(detail.proposalDate).toBe('2026-10-06');
      expect(detail.proposalReason).toBe(EXPECTED_LIKMS_REASON);
    });

    test('reads proposer, session and documents', () => {
      const detail = parser.parseDetail(LIKMS_BILL_INFO_FRAGMENT_FULL_HTML);

      expect(detail.billNo).toBe('2221883');
      expect(detail.proposalDate).toBe('2026-10-13');
      expect(detail.proposer).toBe('주진우의원 등 10인');
      expect(detail.session).toBe('제22대(2024~2028)제439회');
      // 미리보기(javascript:;) 링크는 제외하고 파일명에 확장자를 붙인다.
      expect(detail.attachments).toEqual([
        {
          filename: '의안원문.hwp',
          url: 'https://likms.assembly.go.kr/filegate/servlet/FileGate?bookId=abc&type=0',
        },
        {
          filename: '의안원문.pdf',
          url: 'https://likms.assembly.go.kr/filegate/servlet/FileGate?bookId=abc&type=1',
        },
      ]);
    });

    test('returns empty values for invalid html without throwing', () => {
      const detail = parser.parseDetail('asdf');

      expect(detail.title).toBe('');
      expect(detail.billNo).toBe('');
      expect(detail.proposer).toBe('');
      expect(detail.proposalReason).toBeNull();
      expect(detail.attachments).toHaveLength(0);
    });
  });
});

// ─── PalCrawl ↔ LikmsCrawler 연계 ─────────────────────────────────────────────

describe('PalCrawl hydrateProposalReason', () => {
  const setup = (config?: ConstructorParameters<typeof PalCrawl>[0]) => {
    const pal = new PalCrawl(config);
    const palHttp = (pal as unknown as { httpClient: MockableHttpClient })
      .httpClient;
    const likms = (
      pal as unknown as { likms: { httpClient: MockableHttpClient } }
    ).likms;
    return { pal, palHttp, likmsHttp: likms.httpClient };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fills empty proposalReason from likms (getContent)', async () => {
    const { pal, palHttp, likmsHttp } = setup();
    jest.spyOn(palHttp, 'get').mockResolvedValue(PAL_CONTENT_HTML_EMPTY_REASON);
    jest.spyOn(likmsHttp, 'get').mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
    jest
      .spyOn(likmsHttp, 'post')
      .mockResolvedValue(LIKMS_BILL_INFO_FRAGMENT_HTML);

    const content = await pal.getContent(TEST_BILL_ID);

    expect(content.proposalReason).toBe(EXPECTED_LIKMS_REASON);
  });

  test('fills empty proposalReason from likms (getDoneContent)', async () => {
    const { pal, palHttp, likmsHttp } = setup();
    jest.spyOn(palHttp, 'get').mockResolvedValue(PAL_CONTENT_HTML_EMPTY_REASON);
    jest.spyOn(likmsHttp, 'get').mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
    jest
      .spyOn(likmsHttp, 'post')
      .mockResolvedValue(LIKMS_BILL_INFO_FRAGMENT_HTML);

    const content = await pal.getDoneContent(TEST_BILL_ID);

    expect(content.proposalReason).toBe(EXPECTED_LIKMS_REASON);
  });

  test('skips likms when PAL proposalReason already exists', async () => {
    const { pal, palHttp, likmsHttp } = setup();
    jest.spyOn(palHttp, 'get').mockResolvedValue(PAL_CONTENT_HTML_WITH_REASON);
    const getSpy = jest.spyOn(likmsHttp, 'get');
    const postSpy = jest.spyOn(likmsHttp, 'post');

    const content = await pal.getContent(TEST_BILL_ID);

    expect(content.proposalReason).toContain('과태료 부과 기준');
    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('skips likms when hydrateProposalReason is false', async () => {
    const { pal, palHttp, likmsHttp } = setup({ hydrateProposalReason: false });
    jest.spyOn(palHttp, 'get').mockResolvedValue(PAL_CONTENT_HTML_EMPTY_REASON);
    const getSpy = jest.spyOn(likmsHttp, 'get');
    const postSpy = jest.spyOn(likmsHttp, 'post');

    const content = await pal.getContent(TEST_BILL_ID);

    expect(content.proposalReason).toBeNull();
    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('keeps null proposalReason when likms lookup fails', async () => {
    const { pal, palHttp, likmsHttp } = setup();
    jest.spyOn(palHttp, 'get').mockResolvedValue(PAL_CONTENT_HTML_EMPTY_REASON);
    jest.spyOn(likmsHttp, 'get').mockRejectedValue(new Error('network down'));

    const content = await pal.getContent(TEST_BILL_ID);

    expect(content.proposalReason).toBeNull();
    expect(content.title).toBe('');
  });

  test('keeps null proposalReason when likms has no reason either', async () => {
    const { pal, palHttp, likmsHttp } = setup();
    jest.spyOn(palHttp, 'get').mockResolvedValue(PAL_CONTENT_HTML_EMPTY_REASON);
    jest.spyOn(likmsHttp, 'get').mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
    jest
      .spyOn(likmsHttp, 'post')
      .mockResolvedValue(LIKMS_BILL_INFO_FRAGMENT_NO_REASON_HTML);

    const content = await pal.getContent(TEST_BILL_ID);

    expect(content.proposalReason).toBeNull();
  });
});

// ─── 계류의안 (의안현황) Fixtures ──────────────────────────────────────────────

/** mooringBillPage.do — CSRF 메타 태그 + 숨김 폼 */
const LIKMS_STATE_PAGE_HTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>의안현황|계류의안</title>
  <meta name="_csrf" content="06901d35-9512-4752-8282-f0233bf6a9ff">
</head>
<body>
  <form id="form" name="form" method="post" action="/bi/bill/state/mooringBillPage.do">
    <input type="hidden" name="_csrf" value="06901d35-9512-4752-8282-f0233bf6a9ff"/>
    <input type="hidden" name="page" value="1"/>
    <input type="hidden" name="stateId" id="stateId" value="mooring">
    <input type="hidden" name="stateDtlDivCd" id="stateDtlDivCd" value="all">
  </form>
</body>
</html>
`;

const TEST_CSRF_TOKEN = '06901d35-9512-4752-8282-f0233bf6a9ff';

/** searchBillStatePaging.do — 목록 조각 (2건 + 페이지 정보) */
const LIKMS_STATE_FRAGMENT_HTML = `
<div id="state-list">
  <div class="theme_board_list link_ico">
    <table class="align_center mobile_layout_auto fix_tb">
      <caption>계류의안-의안번호, 의안명, 제안자구분, 제안일자, 제안이유, 소관위원회, 심사진행상태</caption>
      <tbody>
        <tr>
          <td class="billNo mnone" title="2221880">2221880</td>
          <td class="align_left">
            <a href="javascript:;" data-bill_no="2221880" data-bill-id="PRC_EC79D21C54024C16A5D06122914938"
               onclick="goDetailPage(this);" title="국가재정법 일부개정법률안(장종태의원 등 10인) (새창 열림)">
              <i class="ico_kye">계류의안</i>
              국가재정법 일부개정법률안(장종태의원 등 10인)
            </a>
            <ul class="mobile_board_date">
              <li>2221880</li>
              <li>의원</li>
              <li>2026-10-13</li>
              <li>위원회 심사</li>
            </ul>
          </td>
          <td class="proposerKindName mnone" title="의원">의원</td>
          <td class="proposeDt mnone" title="2026-10-13">2026-10-13</td>
          <td>
            <a href="javascript:;" data-bill-id="PRC_EC79D21C54024C16A5D06122914938"
               onclick="openSummaryPopup(this);" title="제안이유(새창열림)">
              <img src="/bill/static/img/bi/icon_preview.png" alt="미리보기">
            </a>
          </td>
          <td class="currCmt mnone">법제사법위원회</td>
          <td class="procStageName mnone" title="위원회 심사">위원회 심사</td>
        </tr>
        <tr>
          <td class="billNo mnone" title="2221879">2221879</td>
          <td class="align_left">
            <a href="javascript:;" data-bill_no="2221879" data-bill-id="PRC_J2K6S0S9Q2R2Q1O3O1W0W5V4W8U8U7"
               onclick="goDetailPage(this);" title="지방세특례제한법 일부개정법률안(문진석의원 등 11인) (새창 열림)">
              <i class="ico_kye">계류의안</i>
              지방세특례제한법 일부개정법률안(문진석의원 등 11인)
            </a>
          </td>
          <td class="proposerKindName mnone" title="의원">의원</td>
          <td class="proposeDt mnone" title="2026-10-13">2026-10-13</td>
          <td></td>
          <td class="currCmt mnone"></td>
          <td class="procStageName mnone" title="접수">접수</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div id="list-pager">
    <input type="hidden" id="pager_count_text" value="15,947">
    <input type="hidden" id="pager_pages_text" value=" (2/319 페이지)">
    <div class="paging-navigation"></div>
  </div>
</div>
`;

/** 접수(위원회 회부 이전) 법안이 없는 조각 — 심사 단계만 있다 */
const LIKMS_STATE_FRAGMENT_NO_PENDING_HTML = `
<div id="state-list">
  <table>
    <tbody>
      <tr>
        <td class="billNo mnone" title="2221880">2221880</td>
        <td class="align_left">
          <a href="javascript:;" data-bill_no="2221880" data-bill-id="PRC_EC79D21C54024C16A5D06122914938"
             title="국가재정법 일부개정법률안(장종태의원 등 10인) (새창 열림)">
            국가재정법 일부개정법률안(장종태의원 등 10인)
          </a>
        </td>
        <td class="proposerKindName mnone" title="의원">의원</td>
        <td class="proposeDt mnone" title="2026-10-13">2026-10-13</td>
        <td></td>
        <td class="currCmt mnone">법제사법위원회</td>
        <td class="procStageName mnone" title="소관위심사">소관위심사</td>
      </tr>
    </tbody>
  </table>
  <div id="list-pager">
    <input type="hidden" id="pager_count_text" value="15,947">
    <input type="hidden" id="pager_pages_text" value=" (1/319 페이지)">
  </div>
</div>
`;

/** 조회 결과 없음 */
const LIKMS_STATE_NO_DATA_HTML = `
<div id="state-list">
  <table><tbody>
    <tr><td id="nodataTr">조회된 데이터가 없습니다.</td></tr>
  </tbody></table>
</div>
`;

/** #state-list 래퍼 없이 표만 오는 경우 */
const LIKMS_STATE_TABLE_ONLY_HTML = `
<table>
  <tbody>
    <tr>
      <td class="billNo" title="2221878">2221878</td>
      <td class="align_left">
        <a href="javascript:;" data-bill_no="2221878" data-bill-id="PRC_6C1C9C69EEAE4989810098458E18E8"
           title="대체역의 편입 및 복무 등에 관한 법률 일부개정법률안(박선원의원 등 10인) (새창 열림)">
          대체역의 편입 및 복무 등에 관한 법률 일부개정법률안(박선원의원 등 10인)
        </a>
      </td>
      <td class="proposerKindName" title="의원">의원</td>
      <td class="proposeDt" title="2026-10-13">2026-10-13</td>
      <td></td>
      <td class="currCmt"></td>
      <td class="procStageName" title="접수">접수</td>
    </tr>
  </tbody>
</table>
`;

/** 페이지 수에 천 단위 구분 쉼표가 들어간 경우 (`rows=10`처럼 페이지가 1,000을 넘을 때) */
const LIKMS_STATE_FRAGMENT_COMMA_PAGES_HTML = `
<div id="state-list">
  <table>
    <tbody>
      <tr>
        <td class="billNo" title="2221880">2221880</td>
        <td class="align_left">
          <a href="javascript:;" data-bill_no="2221880" data-bill-id="PRC_EC79D21C54024C16A5D06122914938"
             title="국가재정법 일부개정법률안(장종태의원 등 10인) (새창 열림)">
            국가재정법 일부개정법률안(장종태의원 등 10인)
          </a>
        </td>
        <td class="proposerKindName" title="의원">의원</td>
        <td class="proposeDt" title="2026-10-13">2026-10-13</td>
        <td></td>
        <td class="currCmt"></td>
        <td class="procStageName" title="접수">접수</td>
      </tr>
    </tbody>
  </table>
  <div id="list-pager">
    <input type="hidden" id="pager_count_text" value="15,947">
    <input type="hidden" id="pager_pages_text" value=" (1/1,595 페이지)">
  </div>
</div>
`;

/** 동명이인 선택 팝업(`/bi/popup/selSameNmMemb.do`) 캡처 축약 — 같은 이름이 대수별로 2명 */
const LIKMS_SAME_NM_POPUP_HTML = `
<div class="theme_board_list">
  <table class="align_center">
    <thead>
    <th scope="col" style="width:15%;">대수</th>
    <th scope="col" style="width:20%;">의원명</th>
    <th scope="col" style="width:20%;">한자명</th>
    <th scope="col" style="width:45%;">정당명</th>
    </thead>
    <tbody id="data_sect">
    <tr>
      <td>
        <span>22대</span>
        <ul class="m_list">
          <li data-mem-id="GJK57930" onclick="setRepresntId(this);" style="cursor: pointer">주진우</li>
          <li>朱晋佑</li>
          <li>국민의힘</li>
        </ul>
      </td>
      <td>
        <a href="javascript:;" data-mem-id="GJK57930" onclick="setRepresntId(this);">
          주진우
        </a>
      </td>
      <td>朱晋佑</td>
      <td>국민의힘</td>
    </tr>
    <tr>
      <td>
        <span>16대</span>
        <ul class="m_list">
          <li data-mem-id="IRT9826E" onclick="setRepresntId(this);" style="cursor: pointer">주진우</li>
          <li>朱鎭旴</li>
          <li>한나라당</li>
        </ul>
      </td>
      <td>
        <a href="javascript:;" data-mem-id="IRT9826E" onclick="setRepresntId(this);">주진우</a>
      </td>
      <td>朱鎭旴</td>
      <td>한나라당</td>
    </tr>
    </tbody>
  </table>
</div>
`;

/** 같은 이름이 같은 대수에 둘 이상인 경우 (21대 이수진 2인 — 정당·한자명으로만 구분) */
const LIKMS_SAME_NM_SAME_AGE_POPUP_HTML = `
<table class="align_center">
  <tbody id="data_sect">
  <tr>
    <td>
      <span>21대</span>
      <ul class="m_list">
        <li data-mem-id="D4L60530" onclick="setRepresntId(this);">이수진</li>
        <li>李秀眞</li>
        <li>무소속</li>
      </ul>
    </td>
    <td><a href="javascript:;" data-mem-id="D4L60530">이수진</a></td>
    <td>李秀眞</td>
    <td>무소속</td>
  </tr>
  <tr>
    <td>
      <span>21대</span>
      <ul class="m_list">
        <li data-mem-id="0R68099X" onclick="setRepresntId(this);">이수진</li>
        <li>李壽珍</li>
        <li>더불어민주당</li>
      </ul>
    </td>
    <td><a href="javascript:;" data-mem-id="0R68099X">이수진</a></td>
    <td>李壽珍</td>
    <td>더불어민주당</td>
  </tr>
  </tbody>
</table>
`;

/** 후보 없음 (서버가 안내 행만 돌려주는 경우) */
const LIKMS_SAME_NM_POPUP_NO_DATA_HTML = `
<table class="align_center">
  <tbody id="data_sect">
    <tr><td>조회된 데이터가 없습니다.</td></tr>
  </tbody>
</table>
`;

type MockableStateHttpClient = {
  get: (url: URL, headers?: Record<string, string>) => Promise<string>;
  post: (
    url: URL,
    body: string,
    headers?: Record<string, string>,
  ) => Promise<string>;
};

/** 소관위원회 목록 JSON (`/bi/bill/sch/findAgeCmt.do`) — 실측 응답을 축약 */
const LIKMS_COMMITTEE_JSON = JSON.stringify({
  ageCmtList: [
    { comCd: '1000000', comCdName: '본회의', cdOrd: 1 },
    { comCd: '9700006', comCdName: '법제사법위원회', cdOrd: 3002 },
    { comCd: '9700585', comCdName: '기후에너지환경노동위원회', cdOrd: 3017 },
  ],
});

const getLikmsStateHttpClient = (
  crawler: LikmsStateCrawler,
): MockableStateHttpClient =>
  (crawler as unknown as { httpClient: MockableStateHttpClient }).httpClient;

/** 제안이유 보정에 쓰이는 의안상세 크롤러의 httpClient (테스트용 접근) */
const getLikmsStateDetailHttpClient = (
  crawler: LikmsStateCrawler,
): MockableHttpClient =>
  (
    crawler as unknown as {
      detailCrawler: { httpClient: MockableHttpClient };
    }
  ).detailCrawler.httpClient;

// ─── LikmsStateParser ─────────────────────────────────────────────────────────

describe('LikmsStateParser', () => {
  const parser = new LikmsStateParser();

  describe('parseCommittees', () => {
    test('parses the committee json payload', () => {
      const committees = parser.parseCommittees(LIKMS_COMMITTEE_JSON);

      expect(committees).toHaveLength(3);
      expect(committees[1]).toEqual({
        comCd: '9700006',
        comCdName: '법제사법위원회',
        cdOrd: 3002,
      });
    });

    test('returns [] for invalid json', () => {
      expect(parser.parseCommittees('<html></html>')).toEqual([]);
      expect(parser.parseCommittees('{"ageCmtList":"nope"}')).toEqual([]);
      expect(parser.parseCommittees('{}')).toEqual([]);
    });

    test('skips entries without a code or a name', () => {
      const committees = parser.parseCommittees(
        JSON.stringify({
          ageCmtList: [
            { comCd: '9700006', comCdName: '법제사법위원회' },
            { comCd: '', comCdName: '이름만' },
            { comCd: '9700007', comCdName: '  ' },
            'not-an-object',
          ],
        }),
      );

      expect(committees).toEqual([
        { comCd: '9700006', comCdName: '법제사법위원회', cdOrd: null },
      ]);
    });
  });

  describe('parseList', () => {
    test('returns an empty result for invalid html', () => {
      const result = parser.parseList('asdf');
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.currentPage).toBe(1);
    });

    test('parses a data row with all fields', () => {
      const result = parser.parseList(LIKMS_STATE_FRAGMENT_HTML);
      expect(result.total).toBe(15947);
      expect(result.totalPages).toBe(319);
      expect(result.currentPage).toBe(2);
      expect(result.items).toHaveLength(2);

      const item = result.items[0];
      expect(item.billNo).toBe('2221880');
      expect(item.billId).toBe('PRC_EC79D21C54024C16A5D06122914938');
      expect(item.billName).toBe(
        '국가재정법 일부개정법률안(장종태의원 등 10인)',
      );
      expect(item.proposer).toBe('장종태의원 등 10인');
      expect(item.proposerKind).toBe('의원');
      expect(item.proposalDate).toBe('2026-10-13');
      expect(item.committee).toBe('법제사법위원회');
      expect(item.progressStatus).toBe('위원회 심사');
      expect(item.hasProposalReason).toBe(true);
      expect(item.link).toBe(
        'https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_EC79D21C54024C16A5D06122914938',
      );
    });

    test('flags rows without a proposal reason link', () => {
      const item = parser.parseList(LIKMS_STATE_FRAGMENT_HTML).items[1];
      expect(item.hasProposalReason).toBe(false);
      expect(item.committee).toBe('');
      expect(item.progressStatus).toBe('접수');
      expect(item.proposer).toBe('문진석의원 등 11인');
    });

    test('skips the "no data" row', () => {
      const result = parser.parseList(LIKMS_STATE_NO_DATA_HTML);
      expect(result.items).toHaveLength(0);
      expect(result.currentPage).toBe(1);
    });

    test('falls back to a plain table when #state-list is absent', () => {
      const result = parser.parseList(LIKMS_STATE_TABLE_ONLY_HTML);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].billId).toBe('PRC_6C1C9C69EEAE4989810098458E18E8');
      expect(result.totalPages).toBe(1);
    });

    test('parses totalPages that contain a thousands separator', () => {
      const result = parser.parseList(LIKMS_STATE_FRAGMENT_COMMA_PAGES_HTML);
      expect(result.total).toBe(15947);
      expect(result.totalPages).toBe(1595);
      expect(result.currentPage).toBe(1);
    });
  });

  describe('parseSameNameCandidates', () => {
    test('returns an empty array for invalid html', () => {
      expect(parser.parseSameNameCandidates('asdf')).toHaveLength(0);
    });

    test('parses one candidate per row with 대수, 한자명 and 정당명', () => {
      const candidates = parser.parseSameNameCandidates(
        LIKMS_SAME_NM_POPUP_HTML,
      );

      expect(candidates).toEqual([
        {
          membId: 'GJK57930',
          name: '주진우',
          age: '22대',
          hanja: '朱晋佑',
          party: '국민의힘',
        },
        {
          membId: 'IRT9826E',
          name: '주진우',
          age: '16대',
          hanja: '朱鎭旴',
          party: '한나라당',
        },
      ]);
    });

    test('keeps same-대수 candidates distinct by 정당 and 한자명', () => {
      const candidates = parser.parseSameNameCandidates(
        LIKMS_SAME_NM_SAME_AGE_POPUP_HTML,
      );

      expect(candidates.map((candidate) => candidate.age)).toEqual([
        '21대',
        '21대',
      ]);
      expect(candidates.map((candidate) => candidate.membId)).toEqual([
        'D4L60530',
        '0R68099X',
      ]);
      expect(candidates.map((candidate) => candidate.party)).toEqual([
        '무소속',
        '더불어민주당',
      ]);
    });

    test('returns an empty array when the popup has no candidate', () => {
      expect(
        parser.parseSameNameCandidates(LIKMS_SAME_NM_POPUP_NO_DATA_HTML),
      ).toHaveLength(0);
    });

    test('falls back to the mobile list when the desktop cells are absent', () => {
      const html = `
        <table><tbody id="data_sect"><tr><td>
          <span>22대</span>
          <ul class="m_list">
            <li data-mem-id="GJK57930">주진우</li>
            <li>朱晋佑</li>
            <li>국민의힘</li>
          </ul>
        </td></tr></tbody></table>
      `;

      expect(parser.parseSameNameCandidates(html)).toEqual([
        {
          membId: 'GJK57930',
          name: '주진우',
          age: '22대',
          hanja: '朱晋佑',
          party: '국민의힘',
        },
      ]);
    });
  });
});

// ─── LikmsStateCrawler ────────────────────────────────────────────────────────

describe('LikmsStateCrawler', () => {
  describe('extractCsrfToken', () => {
    const crawler = new LikmsStateCrawler();

    test('extracts the token from the meta tag', () => {
      expect(crawler.extractCsrfToken(LIKMS_STATE_PAGE_HTML)).toBe(
        TEST_CSRF_TOKEN,
      );
    });

    test('returns null when the meta tag is absent', () => {
      expect(crawler.extractCsrfToken('<html></html>')).toBeNull();
      expect(
        crawler.extractCsrfToken('<meta name="_csrf" content="">'),
      ).toBeNull();
    });
  });

  describe('parseStateFormParams', () => {
    const crawler = new LikmsStateCrawler();

    test('extracts the hidden form fields without the CSRF token', () => {
      const params = crawler.parseStateFormParams(LIKMS_STATE_PAGE_HTML);
      expect(params.stateId).toBe('mooring');
      expect(params.stateDtlDivCd).toBe('all');
      expect(params.page).toBe('1');
      expect(params._csrf).toBeUndefined();
    });

    test('returns an empty object for invalid html', () => {
      expect(crawler.parseStateFormParams('asdf')).toEqual({});
    });
  });

  describe('findRepresentCandidates', () => {
    test('fetches the popup with the name and the default age range', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_SAME_NM_POPUP_HTML);

      const candidates = await crawler.findRepresentCandidates('주진우');

      // 팝업은 GET 1회면 끝난다(CSRF·세션 페이지 조회가 필요 없다).
      expect(getSpy).toHaveBeenCalledTimes(1);
      const [url] = getSpy.mock.calls[0];
      expect(url.pathname).toBe('/bill/bi/popup/selSameNmMemb.do');
      expect(url.searchParams.get('memName')).toBe('주진우');
      // 서버가 ageFrom/ageTo를 필수로 받으므로 생략 시 전체 범위를 보낸다.
      expect(url.searchParams.get('ageFrom')).toBe('01');
      expect(url.searchParams.get('ageTo')).toBe('99');
      expect(url.searchParams.get('classId')).toBe('bill');

      expect(candidates).toHaveLength(2);
      expect(candidates[0].membId).toBe('GJK57930');
      expect(candidates[0].party).toBe('국민의힘');
      expect(candidates[1].age).toBe('16대');
    });

    test('passes the age range through when given', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_SAME_NM_SAME_AGE_POPUP_HTML);

      const candidates = await crawler.findRepresentCandidates(
        '이수진',
        21,
        21,
      );

      const [url] = getSpy.mock.calls[0];
      expect(url.searchParams.get('ageFrom')).toBe('21');
      expect(url.searchParams.get('ageTo')).toBe('21');
      expect(candidates.map((candidate) => candidate.party)).toEqual([
        '무소속',
        '더불어민주당',
      ]);
    });

    test('returns an empty array when the name is not in the roster', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_SAME_NM_POPUP_NO_DATA_HTML);

      expect(await crawler.findRepresentCandidates('없는이름')).toEqual([]);
    });

    test('throws when the name is empty without a request', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest.spyOn(httpClient, 'get');

      await expect(crawler.findRepresentCandidates('   ')).rejects.toThrow(
        'represent name is required',
      );
      expect(getSpy).not.toHaveBeenCalled();
    });
  });

  describe('getStateListHTML', () => {
    test('fetches the state page then posts with the CSRF header', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      const html = await crawler.getStateListHTML();

      expect(html).toBe(LIKMS_STATE_FRAGMENT_HTML);

      const getUrl = getSpy.mock.calls[0][0];
      expect(getUrl.toString()).toContain(
        'https://likms.assembly.go.kr/bill/bi/bill/state/mooringBillPage.do',
      );
      expect(getUrl.searchParams.get('stateId')).toBe('mooring');

      const [postUrl, body, headers] = postSpy.mock.calls[0];
      expect(postUrl.toString()).toContain(
        'https://likms.assembly.go.kr/bill/bi/bill/state/searchBillStatePaging.do',
      );
      expect(headers?.['X-CSRF-TOKEN']).toBe(TEST_CSRF_TOKEN);
      expect(body).toContain('page=1');
      expect(body).toContain('stateId=mooring');
      expect(body).toContain('stateDtlDivCd=all');

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('includes the 소관위 처리결과와 공동발의 filters in the posted body', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      await crawler.getStateListHTML({
        ageCmtId: '9700006',
        cmtResultCd: 'PRC_0000',
        jntPrpslYn: 'Y',
      });

      const body = new URLSearchParams(postSpy.mock.calls[0][1]);
      expect(body.get('ageCmtId')).toBe('9700006');
      expect(body.get('cmtResultCd')).toBe('PRC_0000');
      expect(body.get('jntPrpslYn')).toBe('Y');

      jest.restoreAllMocks();
      getSpy.mockRestore();
    });

    test('includes filters in the posted body', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      await crawler.getPage(4, {
        billNm: '국가재정법',
        ageFrom: '22',
        ageTo: '22',
        ordCd: 'DESC',
      });

      const body = postSpy.mock.calls[0][1];
      expect(body).toContain('page=4');
      expect(body).toContain(`billNm=${encodeURIComponent('국가재정법')}`);
      expect(body).toContain('ageFrom=22');
      expect(body).toContain('ageTo=22');
      expect(body).toContain('ordCd=DESC');

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('sends the page hidden form fields as the request base', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      await crawler.getStateListHTML();

      // 브라우저처럼 폼 숨김 필드를 깔고 보낸다(발의자 필터가 이 필드들에 의존).
      const body = new URLSearchParams(postSpy.mock.calls[0][1]);
      expect(body.get('stateId')).toBe('mooring');
      expect(body.get('stateDtlDivCd')).toBe('all');
      expect(body.has('_csrf')).toBe(false);

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('defaults representKindCd to 전체 when only representId is given', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      jest.spyOn(httpClient, 'get').mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      // 발의자 필터는 ID와 발의구분이 셋트여야 서버가 적용한다(ID만 보내면 무시됨).
      await crawler.getStateListHTML({ representId: '4U29186R' });

      const body = new URLSearchParams(postSpy.mock.calls[0][1]);
      expect(body.get('representId')).toBe('4U29186R');
      expect(body.get('representKindCd')).toBe('전체');
      // 서버도 크롤러도 이름을 해석하지 않는다 — 이름 파라미터는 보내지 않는다.
      expect(body.has('represent')).toBe(false);
    });

    test('caches the CSRF token across calls (single page fetch)', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      await crawler.getStateListHTML();
      await crawler.getStateListHTML({ pageIndex: 2 });

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledTimes(2);

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('refreshes an expired token once and retries the POST', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest.spyOn(httpClient, 'post');

      // First call caches the token.
      postSpy.mockResolvedValueOnce(LIKMS_STATE_FRAGMENT_HTML);
      await crawler.getStateListHTML();
      expect(getSpy).toHaveBeenCalledTimes(1);

      // The cached token expires -> refresh the session and retry once.
      postSpy.mockRejectedValueOnce(
        new Error('Invalid response: 403 Forbidden'),
      );
      postSpy.mockResolvedValueOnce(LIKMS_STATE_FRAGMENT_HTML);
      const html = await crawler.getStateListHTML();

      expect(html).toBe(LIKMS_STATE_FRAGMENT_HTML);
      expect(getSpy).toHaveBeenCalledTimes(2);

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('does not refetch the session on a non-session error', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest.spyOn(httpClient, 'post');

      // Cache the token first.
      postSpy.mockResolvedValueOnce(LIKMS_STATE_FRAGMENT_HTML);
      await crawler.getStateListHTML();

      // A plain network failure must surface without an extra page fetch.
      postSpy.mockRejectedValueOnce(new Error('network down'));
      await expect(crawler.getStateListHTML()).rejects.toThrow('network down');
      expect(getSpy).toHaveBeenCalledTimes(1);

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('throws when the CSRF meta tag is missing', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue('<html><body>no meta</body></html>');
      const postSpy = jest.spyOn(httpClient, 'post');

      await expect(crawler.getStateListHTML()).rejects.toThrow(
        'CSRF token is missing',
      );
      expect(postSpy).not.toHaveBeenCalled();

      getSpy.mockRestore();
      postSpy.mockRestore();
    });

    test('does not retry when the initial page fetch fails', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockRejectedValue(new Error('network down'));
      const postSpy = jest.spyOn(httpClient, 'post');

      await expect(crawler.getStateListHTML()).rejects.toThrow('network down');
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).not.toHaveBeenCalled();

      getSpy.mockRestore();
      postSpy.mockRestore();
    });
  });

  describe('search', () => {
    test('returns the parsed search result', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      const result = await crawler.search();

      expect(result.total).toBe(15947);
      expect(result.totalPages).toBe(319);
      expect(result.items).toHaveLength(2);

      getSpy.mockRestore();
      postSpy.mockRestore();
    });
  });

  describe('getAllPages', () => {
    test('yields up to maxPages results', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      const pages: ILikmsStateSearchResult[] = [];
      for await (const page of crawler.getAllPages(
        {},
        { maxPages: 3, delayMs: 0 },
      )) {
        pages.push(page);
      }

      expect(pages).toHaveLength(3);
      expect(pages[0].items).toHaveLength(2);

      getSpy.mockRestore();
      postSpy.mockRestore();
    });
  });

  describe('findCommittees', () => {
    test('requests the committee list for the given age range', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_COMMITTEE_JSON);

      const committees = await crawler.findCommittees('22', '22');

      expect(committees).toEqual([
        { comCd: '1000000', comCdName: '본회의', cdOrd: 1 },
        { comCd: '9700006', comCdName: '법제사법위원회', cdOrd: 3002 },
        {
          comCd: '9700585',
          comCdName: '기후에너지환경노동위원회',
          cdOrd: 3017,
        },
      ]);

      const url = getSpy.mock.calls[0][0];
      expect(url.pathname).toBe('/bill/bi/bill/sch/findAgeCmt.do');
      expect(url.searchParams.get('ageFrom')).toBe('22');
      expect(url.searchParams.get('ageTo')).toBe('22');

      getSpy.mockRestore();
    });

    test('omits the age params to fetch the whole list', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue(LIKMS_COMMITTEE_JSON);

      await crawler.findCommittees();

      const url = getSpy.mock.calls[0][0];
      expect(url.searchParams.has('ageFrom')).toBe(false);
      expect(url.searchParams.has('ageTo')).toBe(false);
      // 범위를 주지 않으면 사이트가 전체 대수를 합친 목록을 준다(꼬리표로 구분).
      expect(url.searchParams.has('ageSch')).toBe(false);

      getSpy.mockRestore();
    });

    test('throws when only one end of the age range is given', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest.spyOn(httpClient, 'get');

      // 서버는 한쪽만 주면 범위를 무시하고 전체 목록을 돌려주므로 먼저 막는다.
      await expect(crawler.findCommittees('22')).rejects.toThrow(
        'ageFrom and ageTo are required together',
      );
      await expect(crawler.findCommittees(undefined, '22')).rejects.toThrow(
        'ageFrom and ageTo are required together',
      );
      expect(getSpy).not.toHaveBeenCalled();

      getSpy.mockRestore();
    });

    test('returns [] when the response is not JSON', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockResolvedValue('<html>not json</html>');

      await expect(crawler.findCommittees()).resolves.toEqual([]);

      getSpy.mockRestore();
    });
  });

  describe('filterPending', () => {
    test('keeps only items whose progressStatus is 접수', () => {
      const crawler = new LikmsStateCrawler();
      const items = new LikmsStateParser().parseList(
        LIKMS_STATE_FRAGMENT_HTML,
      ).items;
      expect(items).toHaveLength(2);

      const pending = crawler.filterPending(items);

      expect(pending).toHaveLength(1);
      expect(pending[0].billNo).toBe('2221879');
      expect(pending[0].progressStatus).toBe('접수');
    });

    test('returns [] when there is no pending item', () => {
      const crawler = new LikmsStateCrawler();
      const items = new LikmsStateParser().parseList(
        LIKMS_STATE_FRAGMENT_NO_PENDING_HTML,
      ).items;

      expect(crawler.filterPending(items)).toEqual([]);
    });
  });

  describe('getAllPendingPages', () => {
    test('scans with rows=100 and keeps the unfiltered totals', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      jest.spyOn(httpClient, 'get').mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);

      const pages: ILikmsStateSearchResult[] = [];
      for await (const page of crawler.getAllPendingPages(
        {},
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0].items).toHaveLength(1);
      expect(pages[0].items[0].progressStatus).toBe('접수');
      // total/totalPages는 필터링 전 원본 페이지 값이다.
      expect(pages[0].total).toBe(15947);
      // 기본 스캔 페이지 크기는 100건(서버 지원 값).
      expect(new URLSearchParams(postSpy.mock.calls[0][1]).get('rows')).toBe(
        '100',
      );

      jest.restoreAllMocks();
    });

    test('skips pages that contain no pending item', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      jest.spyOn(httpClient, 'get').mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      jest
        .spyOn(httpClient, 'post')
        .mockImplementation(async (_url: URL, body: string) =>
          new URLSearchParams(body).get('page') === '1'
            ? LIKMS_STATE_FRAGMENT_NO_PENDING_HTML
            : LIKMS_STATE_FRAGMENT_HTML,
        );

      const pages: ILikmsStateSearchResult[] = [];
      for await (const page of crawler.getAllPendingPages(
        {},
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }

      expect(pages).toHaveLength(1);
      expect(pages[0].items[0].billNo).toBe('2221879');

      jest.restoreAllMocks();
    });
  });

  describe('searchPending', () => {
    test('returns the first scanned page that contains pending items', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      jest.spyOn(httpClient, 'get').mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockImplementation(async (_url: URL, body: string) =>
          new URLSearchParams(body).get('page') === '1'
            ? LIKMS_STATE_FRAGMENT_NO_PENDING_HTML
            : LIKMS_STATE_FRAGMENT_HTML,
        );

      const result = await crawler.searchPending({}, { delayMs: 0 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].billNo).toBe('2221879');
      expect(result.items[0].progressStatus).toBe('접수');
      expect(result.currentPage).toBe(2);
      // 페이지 1부터 순차 스캔한다.
      expect(
        postSpy.mock.calls.map(([, body]) =>
          new URLSearchParams(body).get('page'),
        ),
      ).toEqual(['1', '2']);

      jest.restoreAllMocks();
    });

    test('returns an empty result when nothing pending is found within maxPages', async () => {
      const crawler = new LikmsStateCrawler();
      const httpClient = getLikmsStateHttpClient(crawler);
      jest.spyOn(httpClient, 'get').mockResolvedValue(LIKMS_STATE_PAGE_HTML);
      jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_STATE_FRAGMENT_NO_PENDING_HTML);

      const result = await crawler.searchPending(
        {},
        { maxPages: 1, delayMs: 0 },
      );

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);

      jest.restoreAllMocks();
    });
  });
});

// ─── 제안이유 보정 (LikmsStateCrawler → LikmsCrawler) ─────────────────────────

describe('LikmsStateCrawler hydrateProposalReasons', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** 계류의안 목록 응답(1건은 제안이유 링크 있음, 1건은 없음) */
  const mockStateList = (crawler: LikmsStateCrawler): void => {
    const httpClient = getLikmsStateHttpClient(crawler);
    jest.spyOn(httpClient, 'get').mockResolvedValue(LIKMS_STATE_PAGE_HTML);
    jest.spyOn(httpClient, 'post').mockResolvedValue(LIKMS_STATE_FRAGMENT_HTML);
  };

  const mockDetail = (crawler: LikmsStateCrawler) => {
    const httpClient = getLikmsStateDetailHttpClient(crawler);
    const getSpy = jest
      .spyOn(httpClient, 'get')
      .mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
    const postSpy = jest
      .spyOn(httpClient, 'post')
      .mockResolvedValue(LIKMS_BILL_INFO_FRAGMENT_HTML);
    return { getSpy, postSpy };
  };

  const makeItem = (
    billId: string,
    hasProposalReason: boolean,
  ): ILikmsStateBillItem => ({
    billNo: '2221880',
    billId,
    billName: '국가재정법 일부개정법률안(장종태의원 등 10인)',
    proposer: '장종태의원 등 10인',
    proposerKind: '의원',
    proposalDate: '2026-10-13',
    committee: '',
    progressStatus: '접수',
    hasProposalReason,
    proposalReason: null,
    link: '',
  });

  test('leaves proposalReason null when the option is off', async () => {
    const crawler = new LikmsStateCrawler();
    mockStateList(crawler);
    const detail = mockDetail(crawler);

    const result = await crawler.search();

    expect(result.items[0].hasProposalReason).toBe(true);
    expect(result.items[0].proposalReason).toBeNull();
    expect(detail.getSpy).not.toHaveBeenCalled();
    expect(detail.postSpy).not.toHaveBeenCalled();
  });

  test('fills the reason for hasProposalReason items only', async () => {
    const crawler = new LikmsStateCrawler({ hydrateProposalReason: true });
    mockStateList(crawler);
    const detail = mockDetail(crawler);

    const result = await crawler.search();

    expect(result.items[0].proposalReason).toBe(EXPECTED_LIKMS_REASON);
    // 두 번째 행은 목록에 제안이유 링크가 없어 조회하지 않는다.
    expect(result.items[1].hasProposalReason).toBe(false);
    expect(result.items[1].proposalReason).toBeNull();
    expect(detail.getSpy).toHaveBeenCalledTimes(1);
    expect(detail.postSpy).toHaveBeenCalledTimes(1);
  });

  test('skips the detail endpoint for items without a proposal reason link', async () => {
    const crawler = new LikmsStateCrawler();
    const detail = mockDetail(crawler);

    const hydrated = await crawler.hydrateProposalReasons(
      [makeItem('PRC_A', false), makeItem('PRC_B', true)],
      { delayMs: 0 },
    );

    expect(detail.getSpy).toHaveBeenCalledTimes(1);
    expect(hydrated[0].proposalReason).toBeNull();
    expect(hydrated[1].proposalReason).toBe(EXPECTED_LIKMS_REASON);
  });

  test('keeps the existing value when a detail lookup fails', async () => {
    const crawler = new LikmsStateCrawler();
    const httpClient = getLikmsStateDetailHttpClient(crawler);
    const getSpy = jest.spyOn(httpClient, 'get');
    getSpy.mockRejectedValueOnce(new Error('network down'));
    getSpy.mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
    jest
      .spyOn(httpClient, 'post')
      .mockResolvedValue(LIKMS_BILL_INFO_FRAGMENT_HTML);

    const hydrated = await crawler.hydrateProposalReasons(
      [makeItem('PRC_FAIL', true), makeItem('PRC_OK', true)],
      { delayMs: 0 },
    );

    expect(hydrated[0].proposalReason).toBeNull();
    expect(hydrated[1].proposalReason).toBe(EXPECTED_LIKMS_REASON);
  });

  test('returns an empty reason as null when the fragment has none', async () => {
    const crawler = new LikmsStateCrawler();
    const httpClient = getLikmsStateDetailHttpClient(crawler);
    jest.spyOn(httpClient, 'get').mockResolvedValue(LIKMS_DETAIL_PAGE_HTML);
    jest
      .spyOn(httpClient, 'post')
      .mockResolvedValue(LIKMS_BILL_INFO_FRAGMENT_NO_REASON_HTML);

    const hydrated = await crawler.hydrateProposalReasons(
      [makeItem('PRC_A', true)],
      {
        delayMs: 0,
      },
    );

    expect(hydrated[0].proposalReason).toBeNull();
  });

  test('returns copies and does not mutate the input', async () => {
    const crawler = new LikmsStateCrawler();
    mockDetail(crawler);
    const input = [makeItem('PRC_A', true)];

    const hydrated = await crawler.hydrateProposalReasons(input, {
      delayMs: 0,
    });

    expect(hydrated).not.toBe(input);
    expect(input[0].proposalReason).toBeNull();
    expect(hydrated[0].proposalReason).toBe(EXPECTED_LIKMS_REASON);
  });

  test('honours concurrency and delay options', async () => {
    const crawler = new LikmsStateCrawler();
    const detail = mockDetail(crawler);
    const items = [
      makeItem('PRC_A', true),
      makeItem('PRC_B', true),
      makeItem('PRC_C', true),
    ];

    const hydrated = await crawler.hydrateProposalReasons(items, {
      concurrency: 2,
      delayMs: 0,
    });

    // 동시성은 요청 수를 바꾸지 않는다(대상 3건 → 3회).
    expect(detail.getSpy).toHaveBeenCalledTimes(3);
    expect(hydrated.every((item) => item.proposalReason)).toBe(true);
  });

  test('hydrates items from getAllPages as well', async () => {
    const crawler = new LikmsStateCrawler({ hydrateProposalReason: true });
    mockStateList(crawler);
    const detail = mockDetail(crawler);

    const pages: ILikmsStateSearchResult[] = [];
    for await (const page of crawler.getAllPages(
      {},
      { maxPages: 2, delayMs: 0 },
    )) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2);
    expect(pages[0].items[0].proposalReason).toBe(EXPECTED_LIKMS_REASON);
    expect(detail.getSpy).toHaveBeenCalledTimes(2); // 페이지마다 1건씩
  });
});
