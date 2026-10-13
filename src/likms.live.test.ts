import { LikmsStateCrawler } from './likms';
import { LikmsNsmAdapter } from './nsm-compat';
import type {
  ILikmsRepresentCandidate,
  ILikmsStateBillItem,
  ILikmsStateSearchResult,
} from './parser';

/**
 * 실제 네트워크(likms.assembly.go.kr)를 사용하는 opt-in 통합 테스트.
 *
 * 기본값은 `describe.skip`이라 일반 `npm test`에서는 실행되지 않는다.
 * 다음처럼 환경변수를 켜야 실제로 돌아간다.
 *
 *   LIKMS_LIVE_TEST=1 npx jest src/likms.live.test.ts
 *
 * 대상 사이트에 의존하므로 CI 게이트가 아니라 로컬/야간 점검용이다.
 *
 * 규약: 의안명·발의자명·건수·페이지 수 같은 **실시간 값을 고정값으로 박지 않는다.**
 * 값은 같은 실행에서 받은 응답에서 유도하고(예: `filtered.total < all.total`),
 * 사이트 데이터가 바뀌어도 코드 회귀만 잡히도록 한다.
 */
const RUN_LIVE = process.env.LIKMS_LIVE_TEST === '1';
const describeLive = RUN_LIVE ? describe : describe.skip;

const LIVE_TIMEOUT_MS = 90000;
/** 계류의안 목록은 페이지당 50건 고정 */
const PAGE_SIZE = 50;

type SpyableHttpClient = {
  get: (url: URL, headers?: Record<string, string>) => Promise<string>;
  post: (
    url: URL,
    body: string,
    headers?: Record<string, string>,
  ) => Promise<string>;
};

const getHttpClient = (crawler: LikmsStateCrawler): SpyableHttpClient =>
  (crawler as unknown as { httpClient: SpyableHttpClient }).httpClient;

const getSessionToken = (crawler: LikmsStateCrawler): string | null =>
  (crawler as unknown as { session: { token: string } | null }).session
    ?.token ?? null;

/** 목록의 발의자 표기("주진우의원 등 10인")에서 대표발의자 이름만 뽑는다 */
const extractProposerNames = (items: ILikmsStateBillItem[]): string[] => [
  ...new Set(
    items
      .map((item) => item.proposer)
      .filter((proposer) => /등\s*\d+인$/.test(proposer))
      .map((proposer) =>
        proposer
          .replace(/\s*등\s*\d+인$/, '')
          .replace(/(의원|위원장)$/, '')
          .trim(),
      )
      .filter(Boolean),
  ),
];

describeLive('LikmsStateCrawler (live)', () => {
  jest.setTimeout(LIVE_TIMEOUT_MS);

  let crawler: LikmsStateCrawler;

  beforeEach(() => {
    crawler = new LikmsStateCrawler({ timeout: 20000 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getStatePageHTML exposes a CSRF token', async () => {
    const html = await crawler.getStatePageHTML();
    const token = crawler.extractCsrfToken(html);

    expect(typeof token).toBe('string');
    expect((token ?? '').length).toBeGreaterThan(0);
  });

  test('search returns a full first page of well-formed bills', async () => {
    const result = await crawler.search();

    expect(result.currentPage).toBe(1);
    expect(result.total).toBeGreaterThan(0);
    // 건수는 고정값이 아니라 목록 크기에서 유도한다 — 이 두 관계가 `rows` 기본값(50)을 검증한다.
    expect(result.items).toHaveLength(Math.min(PAGE_SIZE, result.total));
    expect(result.totalPages).toBe(Math.ceil(result.total / PAGE_SIZE));

    for (const item of result.items) {
      expect(item.billId).toMatch(/^PRC_/);
      expect(item.billNo).toMatch(/^\d+$/);
      expect(item.billName.length).toBeGreaterThan(0);
      expect(item.billName).not.toContain('\uFFFD');
      expect(item.link).toBe(
        `https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=${encodeURIComponent(
          item.billId,
        )}`,
      );
    }
  });

  test('re-issues the CSRF token after clearSession (one page fetch per session)', async () => {
    const httpClient = getHttpClient(crawler);
    const getSpy = jest.spyOn(httpClient, 'get');

    await crawler.search();
    await crawler.search({ pageIndex: 2 });
    // The token is cached, so only the very first call fetched the page.
    expect(getSpy).toHaveBeenCalledTimes(1);

    crawler.clearSession();
    expect(getSessionToken(crawler)).toBeNull();

    const result = await crawler.search();
    // clearSession forces exactly one re-fetch of the state page.
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(getSessionToken(crawler)).toBeTruthy();
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('getAllPages yields consecutive pages with different bills', async () => {
    const pages: ILikmsStateSearchResult[] = [];
    for await (const page of crawler.getAllPages(
      {},
      { maxPages: 2, delayMs: 0 },
    )) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2);
    const [firstPage, secondPage] = pages;
    expect(firstPage.currentPage).toBe(1);
    expect(secondPage.currentPage).toBe(2);
    // 페이지당 건수도 1페이지 응답에서 유도한다(고정값을 박아 두지 않는다).
    const expectedPageSize = Math.min(PAGE_SIZE, firstPage.total);
    expect(firstPage.items).toHaveLength(expectedPageSize);
    expect(secondPage.items.length).toBeGreaterThan(0);
    expect(secondPage.items.length).toBeLessThanOrEqual(expectedPageSize);
    expect(secondPage.items[0].billNo).not.toBe(firstPage.items[0].billNo);
  });

  test('page boundaries: last page is non-empty and beyond-last is empty', async () => {
    const first = await crawler.search();
    const lastPage = first.totalPages;

    const last = await crawler.search({ pageIndex: lastPage });
    expect(last.currentPage).toBe(lastPage);
    expect(last.items.length).toBeGreaterThan(0);
    expect(last.items.length).toBeLessThanOrEqual(PAGE_SIZE);

    const beyond = await crawler.search({ pageIndex: lastPage + 1 });
    expect(beyond.items.length).toBeLessThanOrEqual(PAGE_SIZE);
    if (beyond.items.length > 0) {
      // 조회 사이에 새 의안이 접수되면 마지막 페이지가 밀려 초과 페이지가 채워질 수 있다.
      // 그 경우에만 허용하고, 목록이 그대로면(페이지 계산 버그) 실패시킨다.
      const refreshed = await crawler.search();
      expect(refreshed.total).toBeGreaterThan(first.total);
      expect(refreshed.totalPages).toBeGreaterThan(lastPage);
    }
  });

  test('filters narrow the result set', async () => {
    const all = await crawler.search();
    // 의안명은 고정값 대신 실시간 목록에서 뽑는다 — 없는 이름을 박아 두면 조용히 썩는다.
    const scoped = await crawler.search({ ageFrom: 22, ageTo: 22 });
    expect(scoped.items.length).toBeGreaterThan(0);
    const sample = scoped.items[0];

    const filtered = await crawler.search({
      billNm: sample.billName,
      ageFrom: 22,
      ageTo: 22,
    });

    expect(filtered.total).toBeGreaterThan(0);
    expect(filtered.total).toBeLessThan(all.total);
    // 필터가 실제로 그 건을 찾았는지까지 본다(단순히 좁아지기만 한 게 아니라).
    expect(filtered.items.map((item) => item.billNo)).toContain(sample.billNo);
  });

  test('findCommittees returns the 소관위 list and narrows by code', async () => {
    const committees = await crawler.findCommittees(22, 22);
    expect(committees.length).toBeGreaterThan(10);
    // 고정 코드를 박지 않고 목록에서 실존하는 항목을 골라 쓴다.
    const committee = committees.find((item) =>
      item.comCdName.endsWith('위원회'),
    );
    expect(committee).toBeDefined();
    if (!committee) return;

    const all = await crawler.search({ pageSize: PAGE_SIZE });
    const scoped = await crawler.search({
      pageSize: PAGE_SIZE,
      ageCmtId: committee.comCd,
    });

    expect(scoped.total).toBeGreaterThan(0);
    expect(scoped.total).toBeLessThan(all.total);
    // 필터가 실제로 그 소관위 건만 돌려주는지 확인한다.
    const committeesInPage = new Set(
      scoped.items.map((item) => item.committee),
    );
    expect(committeesInPage.size).toBeGreaterThan(0);
    for (const name of committeesInPage) {
      expect(name).toBe(committee.comCdName);
    }
  });

  test('cmtResultCd and jntPrpslYn narrow the result set', async () => {
    const all = await crawler.search({ pageSize: 1 });
    const pending = await crawler.search({
      pageSize: 1,
      cmtResultCd: 'PRC_0000',
    });
    const joint = await crawler.search({ pageSize: 1, jntPrpslYn: 'Y' });
    const single = await crawler.search({ pageSize: 1, jntPrpslYn: 'N' });

    expect(pending.total).toBeGreaterThan(0);
    expect(pending.total).toBeLessThanOrEqual(all.total);
    expect(joint.total).toBeGreaterThan(0);
    expect(single.total).toBeGreaterThan(0);
    // 공동발의 여부는 전체를 둘로 나누는 축이다(합이 전체와 같아야 한다).
    expect(joint.total + single.total).toBe(all.total);
  });

  test('resolves a 상임위 name onto the likms code (adapter)', async () => {
    const adapter = new LikmsNsmAdapter();
    const committees = await adapter.likms.findCommittees(22, 22);
    const target = committees.find(
      (item) => item.comCdName === '법제사법위원회',
    );
    if (!target) {
      throw new Error('법제사법위원회 is missing from the 22대 committee list');
    }

    const result = await adapter.search({
      scCptPpostCmt: '법제사법위원회',
      sugCd: '22',
      endSugCd: '22',
      pageSize: 10,
    });

    expect(result.total).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.committee).toBe(target.comCdName);
    }

    // 이름을 해석할 수 없으면 필터를 버리지 않고 요청 전에 막는다.
    await expect(
      adapter.search({ scCptPpostCmt: '없는위원회이름' }),
    ).rejects.toThrow(/unknown committee/);
  });

  test('lists 발의자 후보 with 대수·정당 and filters by the picked membId', async () => {
    const first = await crawler.search();
    const names = extractProposerNames(first.items);
    expect(names.length).toBeGreaterThan(0);

    // 이름이 겹치는 발의자를 목록에서 찾는다(고정 이름을 박지 않는다).
    let ambiguous: {
      name: string;
      candidates: ILikmsRepresentCandidate[];
    } | null = null;
    for (const name of names.slice(0, 10)) {
      const candidates = await crawler.findRepresentCandidates(name);
      if (candidates.length > 1) {
        ambiguous = { name, candidates };
        break;
      }
    }
    if (!ambiguous) {
      throw new Error(`no ambiguous proposer name among: ${names.join(', ')}`);
    }
    const { name, candidates } = ambiguous;

    // 후보마다 사람을 가릴 정보와 representId로 그대로 쓸 ID가 있어야 한다.
    expect(new Set(candidates.map((c) => c.membId)).size).toBe(
      candidates.length,
    );
    for (const candidate of candidates) {
      expect(candidate.name).toBe(name);
      expect(candidate.membId.length).toBeGreaterThan(0);
      expect(candidate.age).toMatch(/^\d+대$/);
      expect(candidate.party.length).toBeGreaterThan(0);
    }

    // 후보의 ID를 그대로 넣으면 그 사람의 대표발의 건만 나온다.
    // (ID 자체가 대수를 한정하므로 `ageFrom`/`ageTo`는 필요 없다.)
    const withBills: ILikmsStateSearchResult[] = [];
    for (const candidate of candidates) {
      const filtered = await crawler.search({
        representId: candidate.membId,
        representKindCd: 'REPR',
      });
      if (filtered.total > 0) {
        withBills.push(filtered);
      }
      for (const item of filtered.items) {
        expect(item.proposer).toContain(name);
      }
    }
    // 후보 중 적어도 한 명(보통 현직 대수)은 계류의안 대표발의 건이 있어야 한다.
    expect(withBills.length).toBeGreaterThan(0);
    // 대표발의만 좁혔으므로 전체 목록보다 적다.
    expect(withBills[0].total).toBeLessThan(first.total);
  });

  test('hydrates proposal reasons only for flagged bills', async () => {
    const page = await crawler.search({ pageSize: PAGE_SIZE });
    // 기본값은 보정 꺼짐 → 목록만으로는 제안이유가 없다.
    expect(page.items.every((item) => item.proposalReason === null)).toBe(true);

    const flagged = page.items
      .filter((item) => item.hasProposalReason)
      .slice(0, 3);
    expect(flagged.length).toBeGreaterThan(0);

    const hydrated = await crawler.hydrateProposalReasons(flagged, {
      delayMs: 0,
    });
    for (const item of hydrated) {
      expect(item.proposalReason).toBeTruthy();
      expect((item.proposalReason ?? '').length).toBeGreaterThan(20);
    }
  });
});
