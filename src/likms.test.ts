import { PalCrawl } from './pal';
import { LikmsCrawler } from './likms';

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
      const reason = crawler.parseProposalReason(
        LIKMS_BILL_INFO_FRAGMENT_HTML,
      );
      expect(reason).toBe(EXPECTED_LIKMS_REASON);
    });

    test('reason does not contain the repeated section heading', () => {
      const reason = crawler.parseProposalReason(
        LIKMS_BILL_INFO_FRAGMENT_HTML,
      );
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
});

// ─── PalCrawl ↔ LikmsCrawler 연계 ─────────────────────────────────────────────

describe('PalCrawl hydrateProposalReason', () => {
  const setup = (config?: ConstructorParameters<typeof PalCrawl>[0]) => {
    const pal = new PalCrawl(config);
    const palHttp = (
      pal as unknown as { httpClient: MockableHttpClient }
    ).httpClient;
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
    jest
      .spyOn(likmsHttp, 'get')
      .mockRejectedValue(new Error('network down'));

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
