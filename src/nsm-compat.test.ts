import {
  NsmLmSts,
  type INsmBillDetail,
  type INsmSearchQuery,
  type INsmSearchResult,
  type PalCrawlConfig,
} from './pal';
import type { LikmsStateCrawlerConfig } from './likms';
import {
  LikmsNsmAdapter,
  type INsmDetailCrawler,
  type INsmListCrawler,
} from './nsm-compat';

// ─── Fixtures (실제 캡처 구조를 축약) ──────────────────────────────────────────

const STATE_PAGE_HTML = `
<!DOCTYPE html>
<html lang="ko">
<head><meta name="_csrf" content="test-csrf-token"></head>
<body></body>
</html>
`;

const STATE_FRAGMENT_HTML = `
<div id="state-list">
  <table>
    <tbody>
      <tr>
        <td class="billNo mnone" title="2221880">2221880</td>
        <td class="align_left">
          <a href="javascript:;" data-bill_no="2221880" data-bill-id="PRC_EC79D21C54024C16A5D06122914938"
             title="국가재정법 일부개정법률안(장종태의원 등 10인) (새창 열림)">
            <i class="ico_kye">계류의안</i>
            국가재정법 일부개정법률안(장종태의원 등 10인)
          </a>
        </td>
        <td class="proposerKindName mnone" title="의원">의원</td>
        <td class="proposeDt mnone" title="2026-10-13">2026-10-13</td>
        <td>
          <a href="javascript:;" data-bill-id="PRC_EC79D21C54024C16A5D06122914938"
             onclick="openSummaryPopup(this);" title="제안이유(새창열림)">미리보기</a>
        </td>
        <td class="currCmt mnone">법제사법위원회</td>
        <td class="procStageName mnone" title="위원회 심사">위원회 심사</td>
      </tr>
    </tbody>
  </table>
  <div id="list-pager">
    <input type="hidden" id="pager_count_text" value="15,947">
    <input type="hidden" id="pager_pages_text" value=" (1/3 페이지)">
  </div>
</div>
`;

/** likms 계류의안 조각 — 심사진행상태가 접수(위원회 회부 이전)인 건 */
const STATE_FRAGMENT_PENDING_HTML = `
<div id="state-list">
  <table>
    <tbody>
      <tr>
        <td class="billNo mnone" title="2221879">2221879</td>
        <td class="align_left">
          <a href="javascript:;" data-bill_no="2221879" data-bill-id="PRC_J2K6S0S9Q2R2Q1O3O1W0W5V4W8U8U7"
             title="지방세특례제한법 일부개정법률안(문진석의원 등 11인) (새창 열림)">
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
  <div id="list-pager">
    <input type="hidden" id="pager_count_text" value="15,947">
    <input type="hidden" id="pager_pages_text" value=" (2/319 페이지)">
  </div>
</div>
`;

type MockableHttpClient = {
  get: (url: URL, headers?: Record<string, string>) => Promise<string>;
  post: (
    url: URL,
    body: string,
    headers?: Record<string, string>,
  ) => Promise<string>;
};

const getHttpClient = (adapter: LikmsNsmAdapter): MockableHttpClient =>
  (adapter.likms as unknown as { httpClient: MockableHttpClient }).httpClient;

/** 어댑터 내부의 의안상세 크롤러 (테스트에서만 접근) */
const getDetailHttpClient = (adapter: LikmsNsmAdapter): MockableHttpClient =>
  (
    adapter as unknown as {
      detail: { httpClient: MockableHttpClient };
    }
  ).detail.httpClient;

/**
 * 소관위원회 목록 JSON (`/bi/bill/sch/findAgeCmt.do`) — 실측 응답을 축약.
 * 대수 범위를 넓혔을 때처럼 같은 이름이 여러 코드로 나뉘는 항목도 포함한다.
 */
const COMMITTEE_JSON = JSON.stringify({
  ageCmtList: [
    { comCd: '1000000', comCdName: '본회의', cdOrd: 1 },
    { comCd: '9700006', comCdName: '법제사법위원회', cdOrd: 3002 },
    { comCd: '9700512', comCdName: '교육위원회(20대~22대)', cdOrd: 3005 },
    { comCd: '9700341', comCdName: '보건복지위원회(18대~22대)', cdOrd: 3016 },
    { comCd: '9700041', comCdName: '보건복지위원회(14대~17대)', cdOrd: 3016.1 },
  ],
});

const setup = (
  committeeJson: string = COMMITTEE_JSON,
): {
  adapter: LikmsNsmAdapter;
  postBody: () => URLSearchParams;
  postCount: () => number;
  committeeGets: () => number;
} => {
  const adapter = new LikmsNsmAdapter();
  const httpClient = getHttpClient(adapter);
  const getSpy = jest
    .spyOn(httpClient, 'get')
    .mockImplementation(async (url: URL) =>
      url.pathname.includes('findAgeCmt') ? committeeJson : STATE_PAGE_HTML,
    );
  const postSpy = jest
    .spyOn(httpClient, 'post')
    .mockResolvedValue(STATE_FRAGMENT_HTML);
  return {
    adapter,
    postBody: () => {
      const call = postSpy.mock.calls.find(([url]) =>
        url.pathname.includes('searchBillStatePaging'),
      );
      if (!call) {
        throw new Error('search request was not posted');
      }
      return new URLSearchParams(call[1]);
    },
    postCount: () => postSpy.mock.calls.length,
    committeeGets: () =>
      getSpy.mock.calls.filter(([url]) => url.pathname.includes('findAgeCmt'))
        .length,
  };
};

// ─── INsmListCrawler (포트) ───────────────────────────────────────────────────

describe('INsmListCrawler port', () => {
  test('NsmLmSts structurally satisfies the port', () => {
    const port: INsmListCrawler = new NsmLmSts();
    expect(port).toBeInstanceOf(NsmLmSts);
  });

  test('LikmsNsmAdapter satisfies the same port', () => {
    const port: INsmListCrawler = new LikmsNsmAdapter();
    expect(port).toBeInstanceOf(LikmsNsmAdapter);
  });
});

// ─── INsmDetailCrawler (상세 조회 포트) ────────────────────────────────────────

describe('INsmDetailCrawler port', () => {
  test('NsmLmSts structurally satisfies the port', () => {
    const port: INsmDetailCrawler = new NsmLmSts();
    expect(port).toBeInstanceOf(NsmLmSts);
  });

  test('LikmsNsmAdapter satisfies the same port', () => {
    const port: INsmDetailCrawler = new LikmsNsmAdapter();
    expect(port).toBeInstanceOf(LikmsNsmAdapter);
  });
});

// ─── LikmsNsmAdapter ─────────────────────────────────────────────────────────

describe('LikmsNsmAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('search', () => {
    test('maps NSM query fields onto likms parameters', async () => {
      const { adapter, postBody } = setup();

      await adapter.search({
        pageIndex: 3,
        pageSize: 20,
        sugCd: '22',
        endSugCd: '22',
        sgtCls: '900201',
        searchStDtNew: '2026-01-01',
        searchEdDtNew: '2026-12-31',
        sortOrder: 'ASC',
      });

      const body = postBody();
      expect(body.get('page')).toBe('3');
      expect(body.get('rows')).toBe('20');
      expect(body.get('ageFrom')).toBe('22');
      expect(body.get('ageTo')).toBe('22');
      expect(body.get('proposerKind')).toBe('GOV');
      expect(body.get('fromPropDt')).toBe('2026-01-01');
      expect(body.get('toPropDt')).toBe('2026-12-31');
      expect(body.get('ordCd')).toBe('ASC');
      expect(body.get('stateId')).toBe('mooring');
    });

    test('rejects scPpsUsr instead of silently dropping the filter', async () => {
      const { adapter, postCount } = setup();

      // likms는 이름을 받지 않는다 — 무시하면 필터가 빠진 전체 결과가 나오므로 알린다.
      await expect(adapter.search({ scPpsUsr: '문진석' })).rejects.toThrow(
        /scPpsUsr is not supported/,
      );
      // 요청을 보내기 전에 막는다(불필요한 외부 호출 방지).
      expect(postCount()).toBe(0);
    });

    test('does not reject an empty scPpsUsr (필터 없음과 같다)', async () => {
      const { adapter, postBody } = setup();

      await adapter.search({ scPpsUsr: '   ' });

      expect(postBody().has('represent')).toBe(false);
      expect(postBody().has('representId')).toBe(false);
    });

    test('maps each NSM 발의구분 code onto a likms proposerKind', async () => {
      const cases: Array<[string, string]> = [
        ['900201', 'GOV'],
        ['900202', 'MEMASEMBY'],
        ['900203', 'CHRPR'],
      ];
      for (const [sgtCls, expected] of cases) {
        const { adapter, postBody } = setup();
        await adapter.search({ sgtCls: sgtCls as '900201' });
        expect(postBody().get('proposerKind')).toBe(expected);
        jest.restoreAllMocks();
      }
    });

    test('routes a numeric scBlNmSct to billNo and text to billNm', async () => {
      const numeric = setup();
      await numeric.adapter.search({ scBlNmSct: '2221880' });
      expect(numeric.postBody().get('billNo')).toBe('2221880');
      expect(numeric.postBody().has('billNm')).toBe(false);
      jest.restoreAllMocks();

      const text = setup();
      await text.adapter.search({ scBlNmSct: '국가재정법' });
      expect(text.postBody().get('billNm')).toBe('국가재정법');
      expect(text.postBody().has('billNo')).toBe(false);
    });

    test('drops fields that have no likms equivalent', async () => {
      const { adapter, postBody } = setup();

      await adapter.search({
        rslRsltNmL: '900101',
        rslRsltNmR: '902912',
        cptOfiOrgCd: 'X',
        sortCol: 'BILL_NAME',
        issLawitmYn: 'Y',
      });

      const body = postBody();
      for (const key of [
        'rslRsltNmL',
        'rslRsltNmR',
        'cptOfiOrgCd',
        'sortCol',
        'issLawitmYn',
      ]) {
        expect(body.has(key)).toBe(false);
      }
      // 상임위를 주지 않으면 소관위 필터도 보내지 않는다(상임위 이름은 아래 테스트).
      expect(body.has('scCptPpostCmt')).toBe(false);
      expect(body.has('ageCmtId')).toBe(false);
      // 기본값은 그대로 유지된다.
      expect(body.get('page')).toBe('1');
      expect(body.get('stateId')).toBe('mooring');
    });

    test('resolves scCptPpostCmt onto the likms 소관위 code', async () => {
      const { adapter, postBody, committeeGets } = setup();

      await adapter.search({
        scCptPpostCmt: '법제사법위원회',
        sugCd: '22',
        endSugCd: '22',
      });

      const body = postBody();
      expect(body.get('ageCmtId')).toBe('9700006');
      // 이름은 서버로 보내지 않는다(코드로만 좁힌다).
      expect(body.has('scCptPpostCmt')).toBe(false);
      expect(committeeGets()).toBe(1);
      // 대수 범위는 조회 자체에도 그대로 적용된다.
      expect(body.get('ageFrom')).toBe('22');
    });

    test('matches a committee name ignoring the 대수 suffix and whitespace', async () => {
      const { adapter, postBody } = setup();

      await adapter.search({ scCptPpostCmt: ' 교육 위원회 ' });

      expect(postBody().get('ageCmtId')).toBe('9700512');
    });

    test('rejects an unknown committee instead of dropping the filter', async () => {
      const { adapter, postCount } = setup();

      await expect(
        adapter.search({ scCptPpostCmt: '존재하지않는위원회' }),
      ).rejects.toThrow(/unknown committee/);
      // 요청을 보내기 전에 막는다(필터 없는 전체 결과를 돌려주지 않는다).
      expect(postCount()).toBe(0);
    });

    test('rejects a committee name that maps to several codes', async () => {
      const { adapter, postCount } = setup();

      // 대수 범위를 넓히면 같은 이름이 코드별로 나뉜다 — 크롤러가 정할 수 없다.
      await expect(
        adapter.search({ scCptPpostCmt: '보건복지위원회' }),
      ).rejects.toThrow(/ambiguous committee: 보건복지위원회 matches 2 codes/);
      expect(postCount()).toBe(0);
    });

    test('rejects a committee filter with only one end of the age range', async () => {
      const { adapter, postCount } = setup();

      // 서버가 한쪽만 주면 범위를 무시하므로 먼저 막는다(잘못된 코드로 좁히는 것 방지).
      await expect(
        adapter.search({ scCptPpostCmt: '법제사법위원회', sugCd: '22' }),
      ).rejects.toThrow('ageFrom and ageTo are required together');
      expect(postCount()).toBe(0);
    });

    test('caches the committee list per age range and drops it on clearSession', async () => {
      const { adapter, committeeGets } = setup();

      await adapter.search({
        scCptPpostCmt: '법제사법위원회',
        sugCd: '22',
        endSugCd: '22',
      });
      await adapter.search({
        scCptPpostCmt: '법제사법위원회',
        sugCd: '22',
        endSugCd: '22',
      });
      await adapter.search({
        scCptPpostCmt: '법제사법위원회',
        sugCd: '21',
        endSugCd: '22',
      });

      // 범위별로 1회씩만 조회한다.
      expect(committeeGets()).toBe(2);

      adapter.clearSession();
      await adapter.search({
        scCptPpostCmt: '법제사법위원회',
        sugCd: '22',
        endSugCd: '22',
      });

      expect(committeeGets()).toBe(3);
    });

    test('maps likms items onto the NSM item shape', async () => {
      const { adapter } = setup();

      const result = await adapter.search();

      expect(result.total).toBe(15947);
      expect(result.totalPages).toBe(3);
      expect(result.currentPage).toBe(1);
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.billName).toBe(
        '국가재정법 일부개정법률안(장종태의원 등 10인)',
      );
      expect(item.billNo).toBe('2221880');
      expect(item.proposer).toBe('장종태의원 등 10인');
      expect(item.proposalDate).toBe('2026-10-13');
      expect(item.committee).toBe('법제사법위원회');
      expect(item.progressStatus).toBe('위원회 심사');
      expect(item.link).toBe(
        'https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_EC79D21C54024C16A5D06122914938',
      );
      // 계류의안 목록에 없는 필드는 빈 문자열
      expect(item.ministry).toBe('');
      expect(item.progressDate).toBe('');
      expect(item.resolutionStatus).toBe('');
      expect(item.resolutionDate).toBe('');
    });
  });

  describe('parseList', () => {
    test('parses a fragment without network access (NSM shape)', () => {
      const adapter = new LikmsNsmAdapter();
      const result = adapter.parseList(STATE_FRAGMENT_HTML);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].billNo).toBe('2221880');
      expect(result.totalPages).toBe(3);
    });

    test('returns an empty result for invalid html', () => {
      const adapter = new LikmsNsmAdapter();
      const result = adapter.parseList('asdf');
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getPage', () => {
    test('sends the requested page and returns NSM items', async () => {
      const { adapter, postBody } = setup();
      const items = await adapter.getPage(2);
      expect(postBody().get('page')).toBe('2');
      expect(items).toHaveLength(1);
      expect(items[0].billNo).toBe('2221880');
    });
  });

  describe('getAllPages', () => {
    test('yields NSM-shaped pages up to maxPages', async () => {
      const { adapter } = setup();
      const pages = [];
      for await (const page of adapter.getAllPages(
        {},
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }
      expect(pages).toHaveLength(2);
      expect(pages[0].items[0].billNo).toBe('2221880');
    });
  });

  describe('clearSession', () => {
    test('exposes the underlying likms crawler session control', () => {
      const adapter = new LikmsNsmAdapter();
      expect(() => adapter.clearSession()).not.toThrow();
      expect(adapter.likms).toBeDefined();
    });
  });

  describe('searchPending', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('scans forward and returns only 접수 items (NSM shape)', async () => {
      const adapter = new LikmsNsmAdapter();
      const httpClient = getHttpClient(adapter);
      jest.spyOn(httpClient, 'get').mockResolvedValue(STATE_PAGE_HTML);
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockImplementation(async (_url: URL, body: string) =>
          new URLSearchParams(body).get('page') === '1'
            ? STATE_FRAGMENT_HTML
            : STATE_FRAGMENT_PENDING_HTML,
        );

      const result = await adapter.searchPending({}, { delayMs: 0 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].billNo).toBe('2221879');
      expect(result.items[0].progressStatus).toBe('접수');
      // 1페이지에 접수가 없으면 2페이지까지 이어서 스캔한다.
      expect(
        postSpy.mock.calls.map(([, body]) =>
          new URLSearchParams(body).get('page'),
        ),
      ).toEqual(['1', '2']);
    });

    test('returns an empty result when the scan finds nothing', async () => {
      const adapter = new LikmsNsmAdapter();
      const httpClient = getHttpClient(adapter);
      jest.spyOn(httpClient, 'get').mockResolvedValue(STATE_PAGE_HTML);
      jest.spyOn(httpClient, 'post').mockResolvedValue(STATE_FRAGMENT_HTML);

      const result = await adapter.searchPending(
        { scPpsUsr: undefined },
        { maxPages: 1, delayMs: 0 },
      );

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getAllPendingPages', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('yields NSM-shaped pages containing pending items', async () => {
      const adapter = new LikmsNsmAdapter();
      const httpClient = getHttpClient(adapter);
      jest.spyOn(httpClient, 'get').mockResolvedValue(STATE_PAGE_HTML);
      jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(STATE_FRAGMENT_PENDING_HTML);

      const pages: INsmSearchResult[] = [];
      for await (const page of adapter.getAllPendingPages(
        {},
        { maxPages: 2, delayMs: 0 },
      )) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0].items[0].progressStatus).toBe('접수');
      expect(pages[0].items[0].billNo).toBe('2221879');
    });
  });

  describe('parseDetail', () => {
    test('parses the detail page html (title and billNo only)', () => {
      const adapter = new LikmsNsmAdapter();
      const detail = adapter.parseDetail(LIKMS_DETAIL_PAGE_HTML_AUDIT);

      expect(detail.title).toBe(
        '이재명 대통령 일가 특혜 의혹 진상규명을 위한 특별검사 임명 등에 관한 법률안(주진우의원 등 10인)',
      );
      expect(detail.billNo).toBe('2221883');
      // proposalInfo는 알고 있는 접수정보로만 조합한다(여기서는 의안번호뿐).
      expect(detail.proposalInfo).toBe('제2221883호');
      // 상세 페이지에 없는 값은 비어 있다(나머지는 심사정보 조각에 있다).
      expect(detail.proposer).toBe('');
      expect(detail.proposalDate).toBe('');
      expect(detail.proposalReason).toBeNull();
      expect(detail.attachments).toHaveLength(0);
    });

    test('parses the billInfo fragment (접수정보·제안이유·문서)', () => {
      const adapter = new LikmsNsmAdapter();
      const detail = adapter.parseDetail(LIKMS_BILL_INFO_HTML_AUDIT);

      expect(detail.title).toBe('');
      expect(detail.billNo).toBe('2221883');
      expect(detail.proposer).toBe('주진우의원 등 10인');
      expect(detail.proposalDate).toBe('2026-10-13');
      expect(detail.session).toBe('제22대(2024~2028)제439회');
      // NSM의 발의정보 원문 줄이 없어 접수정보로 같은 형식의 문자열을 만든다.
      expect(detail.proposalInfo).toBe(
        '주진우의원 등 10인, 제2221883호(2026-10-13). 제22대(2024~2028)제439회',
      );
      expect(detail.proposalReason).toContain(
        '특별검사 임명 등에 관한 법률을 제정하려는 것임.',
      );
      // 미리보기 링크는 제외하고, fileId에는 숫자 ID 대신 다운로드 URL이 들어간다.
      expect(detail.attachments).toEqual([
        {
          filename: '의안원문.hwp',
          fileId:
            'https://likms.assembly.go.kr/filegate/servlet/FileGate?bookId=abc&type=0',
        },
        {
          filename: '의안원문.pdf',
          fileId:
            'https://likms.assembly.go.kr/filegate/servlet/FileGate?bookId=abc&type=1',
        },
      ]);
    });

    test('returns an empty detail for invalid html', () => {
      const adapter = new LikmsNsmAdapter();
      const detail = adapter.parseDetail('asdf');
      expect(detail.title).toBe('');
      expect(detail.billNo).toBe('');
      expect(detail.proposalReason).toBeNull();
      expect(detail.attachments).toHaveLength(0);
    });
  });

  describe('getDetail', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const setup = () => {
      const adapter = new LikmsNsmAdapter();
      const httpClient = getDetailHttpClient(adapter);
      const getSpy = jest
        .spyOn(httpClient, 'get')
        .mockImplementation(async (url: URL) =>
          url.pathname.includes('findBillDetail')
            ? LIKMS_FIND_BILL_JSON_AUDIT
            : LIKMS_DETAIL_PAGE_HTML_AUDIT,
        );
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValue(LIKMS_BILL_INFO_HTML_AUDIT);
      return { adapter, getSpy, postSpy };
    };

    test('resolves a numeric billNo to billId, then fetches page and billInfo', async () => {
      const { adapter, getSpy, postSpy } = setup();

      const detail = await adapter.getDetail('2221883');

      expect(getSpy.mock.calls.map(([url]) => url.pathname)).toEqual([
        '/bill/bi/common/findBillDetail.do',
        '/bill/bi/billDetailPage.do',
      ]);
      expect(getSpy.mock.calls[0][0].searchParams.get('billNo')).toBe(
        '2221883',
      );
      expect(getSpy.mock.calls[1][0].searchParams.get('billId')).toBe(
        'PRC_AUDIT0000000000000000000000000000',
      );
      expect(postSpy.mock.calls[0][0].pathname).toBe(
        '/bill/bi/bill/detail/billInfo.do',
      );
      expect(new URLSearchParams(postSpy.mock.calls[0][1]).get('billNo')).toBe(
        '2221883',
      );

      // 제목(상세 페이지)과 접수정보·제안이유(조각)가 합쳐진다.
      expect(detail.title).toContain('(주진우의원 등 10인)');
      expect(detail.billNo).toBe('2221883');
      expect(detail.session).toBe('제22대(2024~2028)제439회');
      expect(detail.proposalReason).toContain('제정하려는 것임.');
    });

    test('accepts a billId directly without a lookup', async () => {
      const { adapter, getSpy } = setup();

      await adapter.getDetail('PRC_AUDIT0000000000000000000000000000');

      expect(getSpy.mock.calls.map(([url]) => url.pathname)).toEqual([
        '/bill/bi/billDetailPage.do',
      ]);
    });

    test('throws when the billNo does not exist', async () => {
      const adapter = new LikmsNsmAdapter();
      jest
        .spyOn(getDetailHttpClient(adapter), 'get')
        .mockResolvedValue('{"data":{}}');

      await expect(adapter.getDetail('9999999')).rejects.toThrow(
        'bill not found: 9999999',
      );
    });

    test('throws when the argument is empty', async () => {
      const adapter = new LikmsNsmAdapter();
      await expect(adapter.getDetail('  ')).rejects.toThrow(
        'billNo is required',
      );
    });
  });

  describe('getDetailHTML', () => {
    test('returns the likms detail page html', async () => {
      const adapter = new LikmsNsmAdapter();
      jest
        .spyOn(getDetailHttpClient(adapter), 'get')
        .mockImplementation(async (url: URL) =>
          url.pathname.includes('findBillDetail')
            ? LIKMS_FIND_BILL_JSON_AUDIT
            : LIKMS_DETAIL_PAGE_HTML_AUDIT,
        );

      const html = await adapter.getDetailHTML('2221883');

      expect(html).toBe(LIKMS_DETAIL_PAGE_HTML_AUDIT);
      jest.restoreAllMocks();
    });
  });
});

// ─── NsmLmSts 호환성 감사 (외부 호출부 교체 가능성) ────────────────────────────

/**
 * 감사 결과(2026-10-13) — 외부 프로젝트가 `NsmLmSts`에서 `LikmsNsmAdapter`로 바꿀 때
 *
 * 그대로 쓰는 것(시그니처까지 동일): `getListHTML`, `parseList`, `search`, `getPage`,
 * `getAllPages`, 네트워크 설정(`PalCrawlConfig`의 userAgent/timeout/retryCount/
 * customHeaders/hydrateProposalReason).
 *
 * 그대로 쓰는 것에 더해, 상세 조회도 `INsmDetailCrawler` 포트로 교체할 수 있다
 * (`getDetailHTML`, `parseDetail`, `getDetail`). 단 값 형식은 다르다:
 * `proposalDate`(`2026. 5. 1.` ↔ `2026-10-13`), `session`(`제435회 국회(임시회)` ↔
 * `제22대(2024~2028)제439회`), `attachments.fileId`(숫자 ID ↔ 다운로드 URL),
 * `proposalInfo`(likms는 접수정보로 조합한 문자열).
 *
 * 컴파일 오류로 드러나서 코드를 고쳐야 하는 것(`NsmLmSts`에만 있음):
 * `searchPending`, `getAllPendingPages`,
 * `getNsmListScreenshot`, `getDetailScreenshot` 및 `ScreenshotBase` 멤버
 * (`initBrowser`, `closeBrowser`, `takeScreenshot`, `updateScreenshotConfig`, `browser`).
 *
 * 조용히 무시되므로 호출부를 점검해야 하는 것(인자): `rslRsltNmL`, `rslRsltNmR`,
 * `cptOfiOrgCd`, `sortCol`, `issLawitmYn`, `stDt`/`edDt`.
 *
 * 이름 기반 필터는 조용히 버리지 않는다(`scPpsUsr`는 예외, `scCptPpostCmt`는
 * `/bi/bill/sch/findAgeCmt.do` 목록으로 코드를 해석하고 못 하면 예외).
 * likms에만 있는 축(`cmtResultCd`·`jntPrpslYn`)은 `adapter.likms.search()`로 직접 준다.
 * 페이지 크기 기본값도 달라서(likms 사이트 기본 50건 vs 국민참여입법센터 20건)
 * 페이지당 건수에 의존하는 호출부는 `pageSize`를 명시해야 한다.
 *
 * 실측(2026-10-13)으로 확인한 **조용한 차이**(컴파일은 통과, 결과·비용이 달라짐):
 * - 총계 자체가 다르다: 같은 조건에서 likms 15,950건(319페이지) vs NSM 21,336건 —
 *   수집 대상(corpus)이 다르므로 `total`/페이지 수를 두 구현 사이에서 비교하면 안 된다.
 * - `pageSize`는 양쪽 모두 임의 값을 반영한다(NSM 13·100, likms 13·25·200 실측) —
 *   차이는 **기본값**뿐이다(NSM 20건 ↔ likms 50건).
 * - 제안일자: likms는 양쪽을 다 줘야 적용(한쪽만 → 15,950건). NSM 쪽은 `YYYYMMDD`여야
 *   하고(`YYYY-MM-DD` 양쪽 → 0건), ISO 값을 그대로 옮기면 필터가 사라진다.
 * - `hydrateProposalReason`를 켜면 목록 조회에 상세 요청이 붙는다(3건 실측 10.9s vs 2.1s).
 *   값은 `INsmBillItem`에 담기지 않으므로 어댑터 경유 시 비용만 늘고 호출부는 못 본다.
 * - `searchPending`/`getAllPendingPages`는 스캔 기반이라 `options.maxPages`(기본 10) 밖에
 *   접수 항목이 있으면 빈 결과를 준다 — NSM은 서버 필터라 그런 상한이 없다.
 */

/** 국민참여입법센터 발의(rslRsltNmL=900101) 목록 HTML — pending 비교 기준 */
const NSM_LIST_HTML_PENDING_AUDIT = `
<p class="numBuild">총 <span>24</span>건</p>
<p class="numBuild">현재 <em>1</em>/<span>2</span>쪽</p>
<table>
  <tbody>
    <tr>
      <td data-th="의안명">
        <a href="/gcom/nsmLmSts/out/2219089/detailRP">인공지능 기본법 일부개정법률안</a>
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
        <p>발의</p>
        <p>(2026.05.02.)</p>
      </td>
      <td data-th="의결현황(의결일자)">
        <p></p>
        <p></p>
      </td>
    </tr>
  </tbody>
</table>
`;

/** 국민참여입법센터 상세 HTML(발의정보·의안원문·제안이유) — 호환성 비교 기준 */
const NSM_DETAIL_HTML_AUDIT = `
<h2>인공지능 기본법 일부개정법률안</h2>
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
      </td>
    </tr>
    <tr>
      <th>제안이유 및 주요내용</th>
      <td><pre>인공지능 기술의 발전에 따라<br/>규제 체계를 정비하고자 함</pre></td>
    </tr>
  </tbody>
</table>
`;

/** likms 의안상세 페이지 HTML — 제목과 숨김 폼만 들어 있다 */
const LIKMS_DETAIL_PAGE_HTML_AUDIT = `
<div class="page_title">
  <h3 class="detailh3" title="[2221883] 이재명 대통령 일가 특혜 의혹 진상규명을 위한 특별검사 임명 등에 관한 법률안(주진우의원 등 10인)">
    [2221883] 이재명 대통령 일가 특혜 의혹 진상규명을 위한 특별검사 임명 등에 관한 법률안(주진우의원 등 10인)
  </h3>
</div>
<form id="form" name="form">
  <input type="hidden" id="billId" name="billId" value="PRC_AUDIT0000000000000000000000000000">
  <input type="hidden" id="billNo" name="billNo" value="2221883">
  <input type="hidden" id="billKindCd" name="billKindCd" value="BKC_0004">
</form>
`;

/** likms 심사정보 탭 조각 HTML — 접수정보·제안이유·의안원문 */
const LIKMS_BILL_INFO_HTML_AUDIT = `
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
            <td class="proposer"><i>제안자</i><span>주진우의원 등 10인</span></td>
            <td class="sessionTitle"><i>제안회기</i><span>제22대(2024~2028)제439회</span></td>
            <td class="doc align_left">
              <i>문서</i>
              <div class="report">
                <a class="icon_hwp" href="javascript: goDownload('/filegate/servlet/FileGate?bookId=abc&amp;type=0')" title="의안접수정보 의안원문  (HWP 파일 다운로드)">한글</a>
                <a class="icon_pdf" href="/filegate/servlet/FileGate?bookId=abc&amp;type=1" title="의안접수정보 의안원문  (PDF 파일 다운로드)">PDF</a>
                <a class="icon_preview" href="javascript:;" data-url="/bi/common/preview/pdfPreview.do?bookId=abc" onclick="gfn_previewUrlConvert(this)" title="의안접수정보 의안원문 미리보기(새창 열림)"></a>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="theme_list" id="prntsummary-sect">
      <div>
        <h4>제안이유 및 주요내용</h4>
        <pre id="prntSummary">제안이유 및 주요내용

  현행법은 특별검사 임명 절차를 두고 있지 않음.
  이에 특별검사 임명 등에 관한 법률을 제정하려는 것임.</pre>
      </div>
    </div>
  </div>
</div>
`;

/** likms 의안번호 → billId 해석 응답 (`/bi/common/findBillDetail.do`) */
const LIKMS_FIND_BILL_JSON_AUDIT = JSON.stringify({
  data: {
    billNo: '2221883',
    billId: 'PRC_AUDIT0000000000000000000000000000',
    billName:
      '이재명 대통령 일가 특혜 의혹 진상규명을 위한 특별검사 임명 등에 관한 법률안',
    proposeDt: '2026-10-13',
    proposerInfo: '주진우의원 등 10인',
  },
});

/** 국민참여입법센터 목록 HTML(1건 + 페이지 정보) — 호환성 비교 기준 */
const NSM_LIST_HTML_AUDIT = `
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

type AuditHttpClient = {
  get: (url: URL, headers?: Record<string, string>) => Promise<string>;
  post: (
    url: URL,
    body: string,
    headers?: Record<string, string>,
  ) => Promise<string>;
};

const auditHttpClient = (instance: object): AuditHttpClient =>
  (instance as unknown as { httpClient: AuditHttpClient }).httpClient;

/**
 * 외부 호출부가 쓰던 것과 같은 코드를 포트(`INsmListCrawler`)만 보고 실행한다.
 * 두 구현에 같은 코드를 돌려 결과 형태가 유지되는지 확인하는 것이 감사의 핵심이다.
 */
const runCallerFlow = async (crawler: INsmListCrawler) => {
  const query: INsmSearchQuery = {
    pageIndex: 1,
    pageSize: 20,
    sugCd: '22',
    endSugCd: '22',
    sgtCls: '900202',
    // scPpsUsr(발의자명)는 likms가 이름을 받지 않아 미지원 — 아래 감사 테스트에서 따로 확인한다.
    searchStDtNew: '2026-01-01',
    searchEdDtNew: '2026-12-31',
    sortOrder: 'DESC',
    scBlNmSct: '인공지능',
  };

  const html = await crawler.getListHTML(query);
  const parsed = crawler.parseList(html);
  const searched = await crawler.search(query);
  const page = await crawler.getPage(2, { pageSize: 20 });

  const pages: INsmSearchResult[] = [];
  for await (const result of crawler.getAllPages(
    { pageSize: 20 },
    { maxPages: 1, delayMs: 0 },
  )) {
    pages.push(result);
  }

  return { html, parsed, searched, page, pages };
}; /** 감사에서 확인한 ‘포트 ⊆ NsmLmSts’ 컴파일 검증 */
type PortKeysMissingFromNsmLmSts = Exclude<
  keyof INsmListCrawler,
  keyof NsmLmSts
>;
const portIsSubsetOfNsmLmSts: PortKeysMissingFromNsmLmSts extends never
  ? true
  : never = true;

type DetailPortKeysMissingFromNsmLmSts = Exclude<
  keyof INsmDetailCrawler,
  keyof NsmLmSts
>;
const detailPortIsSubsetOfNsmLmSts: DetailPortKeysMissingFromNsmLmSts extends never
  ? true
  : never = true;

describe('NsmLmSts 호환성 감사', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('same caller code produces the same result shape on both crawlers', async () => {
    const nsm = new NsmLmSts();
    jest
      .spyOn(auditHttpClient(nsm), 'get')
      .mockResolvedValue(NSM_LIST_HTML_AUDIT);

    const adapter = new LikmsNsmAdapter();
    const adapterHttp = auditHttpClient(adapter.likms);
    jest.spyOn(adapterHttp, 'get').mockResolvedValue(STATE_PAGE_HTML);
    jest.spyOn(adapterHttp, 'post').mockResolvedValue(STATE_FRAGMENT_HTML);

    const nsmOut = await runCallerFlow(nsm);
    const likmsOut = await runCallerFlow(adapter);

    const nsmResult = nsmOut.searched as unknown as Record<string, unknown>;
    const likmsResult = likmsOut.searched as unknown as Record<string, unknown>;
    expect(Object.keys(likmsResult).sort()).toEqual(
      Object.keys(nsmResult).sort(),
    );

    const nsmItem = nsmOut.searched.items[0] as unknown as Record<
      string,
      unknown
    >;
    const likmsItem = likmsOut.searched.items[0] as unknown as Record<
      string,
      unknown
    >;
    expect(Object.keys(likmsItem).sort()).toEqual(Object.keys(nsmItem).sort());
    for (const key of Object.keys(nsmItem)) {
      expect(typeof likmsItem[key]).toBe(typeof nsmItem[key]);
    }

    expect(typeof likmsOut.html).toBe('string');
    expect(likmsOut.parsed.items).toHaveLength(nsmOut.parsed.items.length);
    // 값은 사이트별로 다르므로 타입만 같으면 호출부 코드가 그대로 동작한다.
    expect(typeof likmsOut.searched.currentPage).toBe(
      typeof nsmOut.searched.currentPage,
    );
    expect(likmsOut.pages).toHaveLength(1);
    expect(likmsOut.page.length).toBeGreaterThan(0);
  });

  test('scPpsUsr is the one query axis the adapter cannot mirror', async () => {
    const nsm = new NsmLmSts();
    jest
      .spyOn(auditHttpClient(nsm), 'get')
      .mockResolvedValue(NSM_LIST_HTML_AUDIT);

    // NSM은 제안자명을 서버가 걸러주므로 그대로 전달한다.
    const nsmResult = await nsm.search({ scPpsUsr: '홍길동' });
    expect(nsmResult.total).toBeGreaterThan(0);

    // likms는 이름을 받지 않으므로 어댑터는 같은 코드를 통과시키지 않고 알린다
    // (조용히 무시하면 필터가 빠진 전체 결과가 나온다).
    const adapter = new LikmsNsmAdapter();
    await expect(adapter.search({ scPpsUsr: '홍길동' })).rejects.toThrow(
      /scPpsUsr is not supported/,
    );
  });

  test('documents value-level differences callers must be aware of', async () => {
    const nsm = new NsmLmSts();
    jest
      .spyOn(auditHttpClient(nsm), 'get')
      .mockResolvedValue(NSM_LIST_HTML_AUDIT);
    const adapter = new LikmsNsmAdapter();
    const adapterHttp = auditHttpClient(adapter.likms);
    jest.spyOn(adapterHttp, 'get').mockResolvedValue(STATE_PAGE_HTML);
    jest.spyOn(adapterHttp, 'post').mockResolvedValue(STATE_FRAGMENT_HTML);

    const nsmItem = (await nsm.search()).items[0];
    const likmsItem = (await adapter.search()).items[0];

    // 의안명: 국민참여입법센터는 발의자 괄호를 떼고, likms 제목은 발의자 포함 형태다.
    expect(nsmItem.billName).toBe('인공지능 기본법 일부개정법률안');
    expect(likmsItem.billName).toContain('(');

    // 링크는 둘 다 절대 URL이지만 호스트·경로 체계가 다르다.
    expect(nsmItem.link).toBe(
      'https://opinion.lawmaking.go.kr/gcom/nsmLmSts/out/2219088/detailRP',
    );
    expect(likmsItem.link).toBe(
      'https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_EC79D21C54024C16A5D06122914938',
    );

    // progressStatus 어휘가 다르다(NSM: 발의/위원회 회부, likms: 접수/위원회 심사).
    expect(nsmItem.progressStatus).toBe('위원회 회부');
    expect(likmsItem.progressStatus).toBe('위원회 심사');

    // NSM에서 값이 있는 필드도 likms에서는 비어 있을 수 있다.
    expect(nsmItem.resolutionStatus).toBe('원안가결');
    expect(likmsItem.resolutionStatus).toBe('');
    expect(nsmItem.ministry).toBe('과학기술정보통신부');
    expect(likmsItem.ministry).toBe('');
  });

  test('port exposes only members that NsmLmSts already has', () => {
    expect(portIsSubsetOfNsmLmSts).toBe(true);
  });

  test('detail port exposes only members that NsmLmSts already has', () => {
    expect(detailPortIsSubsetOfNsmLmSts).toBe(true);
  });

  test('pending callers get the same shape on both crawlers', async () => {
    const nsm = new NsmLmSts();
    jest
      .spyOn(auditHttpClient(nsm), 'get')
      .mockResolvedValue(NSM_LIST_HTML_PENDING_AUDIT);

    const adapter = new LikmsNsmAdapter();
    const httpClient = getHttpClient(adapter);
    jest.spyOn(httpClient, 'get').mockResolvedValue(STATE_PAGE_HTML);
    jest
      .spyOn(httpClient, 'post')
      .mockResolvedValue(STATE_FRAGMENT_PENDING_HTML);

    const nsmPending = await nsm.searchPending();
    const likmsPending = await adapter.searchPending({}, { delayMs: 0 });

    expect(Object.keys(likmsPending).sort()).toEqual(
      Object.keys(nsmPending).sort(),
    );
    const nsmItem = nsmPending.items[0] as unknown as Record<string, unknown>;
    const likmsItem = likmsPending.items[0] as unknown as Record<
      string,
      unknown
    >;
    expect(Object.keys(likmsItem).sort()).toEqual(Object.keys(nsmItem).sort());
    for (const key of Object.keys(nsmItem)) {
      expect(typeof likmsItem[key]).toBe(typeof nsmItem[key]);
    }

    // 진행상태 어휘는 다르다(NSM '발의' ↔ likms '접수').
    expect(nsmItem.progressStatus).toBe('발의');
    expect(likmsItem.progressStatus).toBe('접수');
  });

  test('detail callers get the same shape on both crawlers', async () => {
    const nsm = new NsmLmSts();
    jest
      .spyOn(auditHttpClient(nsm), 'get')
      .mockResolvedValue(NSM_DETAIL_HTML_AUDIT);

    const adapter = new LikmsNsmAdapter();
    const httpClient = getDetailHttpClient(adapter);
    jest
      .spyOn(httpClient, 'get')
      .mockImplementation(async (url: URL) =>
        url.pathname.includes('findBillDetail')
          ? LIKMS_FIND_BILL_JSON_AUDIT
          : LIKMS_DETAIL_PAGE_HTML_AUDIT,
      );
    jest
      .spyOn(httpClient, 'post')
      .mockResolvedValue(LIKMS_BILL_INFO_HTML_AUDIT);

    const nsmHtml = await nsm.getDetailHTML('2219088');
    const likmsHtml = await adapter.getDetailHTML(
      'PRC_AUDIT0000000000000000000000000000',
    );
    expect(typeof likmsHtml).toBe(typeof nsmHtml);

    const nsmDetail: INsmBillDetail = await nsm.getDetail('2219088');
    const likmsDetail: INsmBillDetail = await adapter.getDetail('2221883');

    expect(Object.keys(likmsDetail).sort()).toEqual(
      Object.keys(nsmDetail).sort(),
    );
    for (const key of Object.keys(nsmDetail)) {
      expect(typeof likmsDetail[key as keyof INsmBillDetail]).toBe(
        typeof nsmDetail[key as keyof INsmBillDetail],
      );
    }
    expect(likmsDetail.attachments[0]).toEqual({
      filename: expect.any(String),
      fileId: expect.any(String),
    });

    // 값 형식은 사이트별로 다르다(감사 결과로 문서화).
    expect(nsmDetail.proposalDate).toBe('2026. 5. 1.');
    expect(likmsDetail.proposalDate).toBe('2026-10-13');
    expect(nsmDetail.session).toBe('제435회 국회(임시회)');
    expect(likmsDetail.session).toBe('제22대(2024~2028)제439회');
    expect(nsmDetail.attachments[0].fileId).toBe('99001');
    expect(likmsDetail.attachments[0].fileId).toContain(
      'https://likms.assembly.go.kr/filegate/',
    );
  });

  test('network config can be carried over from PalCrawlConfig', () => {
    const palConfig: PalCrawlConfig = {
      userAgent: 'audit-agent',
      timeout: 1000,
      retryCount: 1,
      customHeaders: { 'Accept-Language': 'ko-KR' },
      hydrateProposalReason: true,
      hydrateTruncatedTitles: true,
      screenshot: { enabled: false },
    };

    // 네트워크 옵션이 호환되면 컴파일된다(screenshot·hydrateTruncatedTitles는 무시).
    const likmsConfig: LikmsStateCrawlerConfig = palConfig;
    const adapter = new LikmsNsmAdapter(likmsConfig);

    expect(adapter).toBeInstanceOf(LikmsNsmAdapter);
  });

  test('parseList only understands its own implementation html', () => {
    const adapter = new LikmsNsmAdapter();
    const nsm = new NsmLmSts();

    expect(adapter.parseList(STATE_FRAGMENT_HTML).items).toHaveLength(1);
    expect(nsm.parseList(NSM_LIST_HTML_AUDIT).items).toHaveLength(1);

    // 구현을 섞어 쓰면 DOM 구조가 달라 빈 결과가 된다(문서화된 제약).
    expect(adapter.parseList(NSM_LIST_HTML_AUDIT).items).toHaveLength(0);
    expect(nsm.parseList(STATE_FRAGMENT_HTML).items).toHaveLength(0);
  });

  test('omits rows when pageSize is not given (site default page size differs)', async () => {
    const adapter = new LikmsNsmAdapter();
    const httpClient = auditHttpClient(adapter.likms);
    jest.spyOn(httpClient, 'get').mockResolvedValue(STATE_PAGE_HTML);
    const postSpy = jest
      .spyOn(httpClient, 'post')
      .mockResolvedValue(STATE_FRAGMENT_HTML);

    await adapter.search();

    const body = new URLSearchParams(postSpy.mock.calls[0][1]);
    expect(body.has('rows')).toBe(false);
  });

  test('forwards pageSize verbatim (likms accepts values outside the nsm set)', async () => {
    const adapter = new LikmsNsmAdapter();
    const httpClient = auditHttpClient(adapter.likms);
    jest.spyOn(httpClient, 'get').mockResolvedValue(STATE_PAGE_HTML);
    const postSpy = jest
      .spyOn(httpClient, 'post')
      .mockResolvedValue(STATE_FRAGMENT_HTML);

    // 실측(2026-10-13): likms는 13/25/200 같은 임의 값을 그대로 반영한다.
    // NSM 값 집합으로 좁히는 정규화를 넣지 않는다.
    await adapter.search({ pageSize: 13 });

    const body = new URLSearchParams(postSpy.mock.calls[0][1]);
    expect(body.get('rows')).toBe('13');
  });
});
