#!/usr/bin/env node
'use strict';

/**
 * dist(tsc 산출물)를 그대로 임포트해 런타임에서 검증하는 스크립트.
 *
 * 목적: 테스트(jest, src 기준)와 별개로 **배포 산출물 자체**가 동작하는지 확인한다.
 * - 기본 실행: 네트워크 없이 export 존재 여부 + 파서/매핑 동작만 검증.
 * - `--live`: 실제 사이트 3곳까지 호출하는 통합 검증(느리고 외부 의존).
 *
 * 사용:
 *   npm run build && node scripts/verify-dist.js
 *   node scripts/verify-dist.js --live
 *
 * HTML fixture는 `src/*.test.ts`의 캡처를 축약한 것이며, 대상 사이트 DOM이 바뀌면
 * 여기서도 함께 깨진다(의도된 조기 경보).
 */

const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.js');
const LIVE = process.argv.includes('--live');

if (!fs.existsSync(DIST_ENTRY)) {
  console.error(
    `dist/index.js가 없습니다: ${DIST_ENTRY}\n먼저 \`npm run build\`를 실행하세요.`,
  );
  process.exit(1);
}

const lib = require(DIST_ENTRY);

// ─── 실행 하네스 ─────────────────────────────────────────────────────────────

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    const suffix = detail === undefined ? '' : ` — ${detail}`;
    console.log(`[ok]   ${name}${suffix}`);
    results.push(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[FAIL] ${name}\n       ${message}`);
    results.push(false);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** 국회입법예고 목록 행 (PalParser.parseTable) */
const PAL_TABLE_HTML = `
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

/** 국회입법예고 상세 (PalParser.parseContent) */
const PAL_CONTENT_HTML = `
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
</div>
`;

/** 국민참여입법센터 목록 (NsmLmStsParser.parseList) */
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
        <p>발의</p>
        <p>(2026.05.03.)</p>
      </td>
      <td data-th="의결현황(의결일자)">
        <p></p>
        <p></p>
      </td>
    </tr>
  </tbody>
</table>
`;

/** 국민참여입법센터 상세 (NsmLmStsParser.parseDetail) */
const NSM_DETAIL_HTML = `
<h2></h2>
<h2>인공지능 기본법 일부개정법률안</h2>
<h3>기본정보</h3>
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

/** likms 계류의안 페이지(세션·CSRF) — 파서가 아니라 런타임 상태 fixture */
const LIKMS_STATE_PAGE_HTML = `
<!DOCTYPE html>
<html lang="ko">
<head><meta name="_csrf" content="test-csrf-token"></head>
<body>
<form id="form">
  <input type="hidden" name="stateId" id="stateId" value="mooring">
  <input type="hidden" name="stateDtlDivCd" id="stateDtlDivCd" value="all">
  <input type="hidden" name="isPopSelect" value="Y">
</form>
</body>
</html>
`;

/** likms 계류의안 목록 조각 (심사 단계 + 접수 혼재) */
const LIKMS_STATE_FRAGMENT_HTML = `
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
    <input type="hidden" id="pager_pages_text" value=" (1/319 페이지)">
  </div>
</div>
`;

/** billId를 심사진행단계가 접수인 건으로 바꾼 조각 (스캔 대안 검증용) */
const LIKMS_STATE_FRAGMENT_PENDING_HTML = LIKMS_STATE_FRAGMENT_HTML.replace(
  'title="소관위심사">소관위심사',
  'title="접수">접수',
).replace(
  '<td class="currCmt mnone">법제사법위원회</td>',
  '<td class="currCmt mnone"></td>',
);

/** likms 의안상세 페이지(제목·의안번호) */
const LIKMS_DETAIL_PAGE_HTML = `
<div class="page_title">
  <h3 class="detailh3" title="[2221883] 특별검사 임명 등에 관한 법률안(주진우의원 등 10인)">[2221883] 특별검사 임명 등에 관한 법률안(주진우의원 등 10인)</h3>
</div>
<form id="form" name="form">
  <input type="hidden" id="billId" name="billId" value="PRC_AUDIT0000000000000000000000000000">
  <input type="hidden" id="billNo" name="billNo" value="2221883">
  <input type="hidden" id="billKindCd" name="billKindCd" value="BKC_0004">
</form>
`;

/** likms 심사정보 탭 조각(접수정보·제안이유·의안원문) */
const LIKMS_BILL_INFO_HTML = `
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

/** likms 동명이인 선택 팝업 (같은 이름이 대수별로 2명) */
const LIKMS_SAME_NM_POPUP_HTML = `
<table class="align_center">
  <tbody id="data_sect">
  <tr>
    <td>
      <span>22대</span>
      <ul class="m_list">
        <li data-mem-id="GJK57930" onclick="setRepresntId(this);">주진우</li>
        <li>朱晋佑</li>
        <li>국민의힘</li>
      </ul>
    </td>
    <td><a href="javascript:;" data-mem-id="GJK57930">주진우</a></td>
    <td>朱晋佑</td>
    <td>국민의힘</td>
  </tr>
  <tr>
    <td>
      <span>16대</span>
      <ul class="m_list">
        <li data-mem-id="IRT9826E" onclick="setRepresntId(this);">주진우</li>
        <li>朱鎭旴</li>
        <li>한나라당</li>
      </ul>
    </td>
    <td><a href="javascript:;" data-mem-id="IRT9826E">주진우</a></td>
    <td>朱鎭旴</td>
    <td>한나라당</td>
  </tr>
  </tbody>
</table>
`;

// ─── 1. export 배럴 ──────────────────────────────────────────────────────────

async function checkExports() {
  await check('dist에서 클래스 export를 모두 가져올 수 있다', () => {
    const classes = [
      'ScreenshotBase',
      'PalCrawl',
      'NsmLmSts',
      'PalParser',
      'NsmLmStsParser',
      'LikmsStateParser',
      'LikmsDetailParser',
      'LikmsCrawler',
      'LikmsStateCrawler',
      'LikmsNsmAdapter',
    ];
    for (const name of classes) {
      assert.equal(
        typeof lib[name],
        'function',
        `export 누락 또는 함수 아님: ${name}`,
      );
    }
    return `${classes.length}개`;
  });

  await check('Config 상수 값이 유지된다', () => {
    assert.equal(lib.Config.DOMAIN, 'https://pal.assembly.go.kr');
    assert.equal(lib.Config.NSM_DOMAIN, 'https://opinion.lawmaking.go.kr');
    assert.equal(lib.Config.LIKMS_DOMAIN, 'https://likms.assembly.go.kr');
    assert.equal(lib.Config.LIKMS_PENDING_PROGRESS_STATUS, '접수');
    assert.equal(
      lib.Config.LIKMS_STATE_SEARCH_URL,
      '/bill/bi/bill/state/searchBillStatePaging.do',
    );
    return 'DOMAIN/NSM/LIKMS/LIKMS_PENDING_PROGRESS_STATUS';
  });
}

// ─── 2. 파서 (네트워크 없음) ─────────────────────────────────────────────────

function checkParsers() {
  const { PalParser, NsmLmStsParser, LikmsStateParser, LikmsDetailParser } =
    lib;

  return (async () => {
    await check('PalParser.parseTable — 목록 행 파싱', () => {
      const rows = new PalParser().parseTable(PAL_TABLE_HTML);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].num, 42);
      assert.equal(rows[0].subject, '테스트 법률안 (홍길동의원 등 5인)');
      assert.equal(rows[0].numComments, 1234);
      assert.equal(rows[0].contentId, 'PRC_TEST000');
      assert.equal(rows[0].attachments.hwpFile, 'https://example.com/file.hwp');
      return `1건 · contentId=${rows[0].contentId}`;
    });

    await check('PalParser.parseContent — 상세 필드 파싱', () => {
      const content = new PalParser().parseContent(PAL_CONTENT_HTML);
      assert.match(content.title, /조세특례제한법 일부개정법률안/);
      assert.equal(content.billNumber, '2218288');
      assert.equal(content.proposer, '윤한홍의원 등 10인');
      assert.equal(content.proposalDate, '2026-04-01');
      assert.equal(content.committee, '기획재정위원회');
      assert.equal(content.noticePeriod, '2026-04-02~2026-04-11');
      assert.equal(content.proposalSession, '제22대(2024~2028) 제433회');
      assert.equal(content.proposalReason, '첫 번째 문장\n두 번째 문장');
      return `제안이유 ${content.proposalReason.length}자`;
    });

    await check('기본 파서는 잘못된 HTML에도 예외를 던지지 않는다', () => {
      const parser = new PalParser();
      assert.deepEqual(parser.parseTable('asdf'), []);
      assert.equal(parser.parseContent('asdf').title, '');
      assert.equal(parser.parseContent('asdf').proposalReason, null);
      return 'parseTable/parseContent → 빈 값';
    });

    await check('NsmLmStsParser.parseList — 목록 파싱', () => {
      const result = new NsmLmStsParser().parseList(NSM_LIST_HTML);
      assert.equal(result.total, 3142);
      assert.equal(result.totalPages, 315);
      assert.equal(result.currentPage, 2);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].billNo, '2219088');
      assert.equal(result.items[0].proposer, '홍길동의원 등 10인');
      assert.equal(result.items[0].progressStatus, '발의');
      assert.equal(result.items[0].ministry, '과학기술정보통신부');
      assert.equal(
        result.items[0].link,
        'https://opinion.lawmaking.go.kr/gcom/nsmLmSts/out/2219088/detailRP',
      );
      return `1건 · 발의`;
    });

    await check('NsmLmStsParser.parseDetail — 발의정보·첨부 파싱', () => {
      const detail = new NsmLmStsParser().parseDetail(NSM_DETAIL_HTML);
      assert.equal(detail.title, '인공지능 기본법 일부개정법률안');
      assert.equal(detail.billNo, '2219088');
      assert.equal(detail.proposer, '홍길동의원 등 10인');
      assert.equal(detail.session, '제435회 국회(임시회)');
      assert.equal(detail.attachments.length, 1);
      assert.equal(detail.attachments[0].fileId, '99001');
      assert.match(detail.proposalReason, /규제 체계를 정비하고자 함/);
      return `첨부 ${detail.attachments.length}건 · ${detail.proposalReason.length}자`;
    });

    await check('LikmsStateParser.parseList — 계류의안 조각 파싱', () => {
      const result = new LikmsStateParser().parseList(
        LIKMS_STATE_FRAGMENT_HTML,
      );
      assert.equal(result.total, 15947);
      assert.equal(result.totalPages, 319);
      assert.equal(result.items.length, 2);
      assert.equal(result.items[0].billNo, '2221880');
      assert.equal(result.items[0].progressStatus, '소관위심사');
      assert.equal(result.items[1].progressStatus, '접수');
      assert.match(result.items[1].link, /billDetailPage\.do\?billId=PRC_/);
      return `${result.items.length}건 · ${result.totalPages}쪽`;
    });

    await check(
      'LikmsStateParser.parseSameNameCandidates — 동명이인 후보(대수·한자명·정당명)',
      () => {
        const candidates = new LikmsStateParser().parseSameNameCandidates(
          LIKMS_SAME_NM_POPUP_HTML,
        );
        assert.equal(candidates.length, 2);
        assert.deepEqual(candidates[0], {
          membId: 'GJK57930',
          name: '주진우',
          age: '22대',
          hanja: '朱晋佑',
          party: '국민의힘',
        });
        assert.equal(candidates[1].age, '16대');
        assert.equal(
          new LikmsStateParser().parseSameNameCandidates('asdf').length,
          0,
        );
        return `${candidates.length}명 · ${candidates.map((c) => `${c.age} ${c.party}`).join(', ')}`;
      },
    );

    await check(
      'LikmsDetailParser.parseDetail — 상세 페이지 + 심사정보 조각',
      () => {
        const parser = new LikmsDetailParser();
        const page = parser.parseDetail(LIKMS_DETAIL_PAGE_HTML);
        assert.equal(
          page.title,
          '특별검사 임명 등에 관한 법률안(주진우의원 등 10인)',
        );
        assert.equal(page.billNo, '2221883');
        assert.equal(page.proposalReason, null);

        const info = parser.parseDetail(LIKMS_BILL_INFO_HTML);
        assert.equal(info.billNo, '2221883');
        assert.equal(info.proposalDate, '2026-10-13');
        assert.equal(info.proposer, '주진우의원 등 10인');
        assert.equal(info.session, '제22대(2024~2028)제439회');
        assert.equal(info.attachments.length, 2);
        assert.equal(info.attachments[0].filename, '의안원문.hwp');
        assert.equal(
          info.attachments[0].url,
          'https://likms.assembly.go.kr/filegate/servlet/FileGate?bookId=abc&type=0',
        );
        assert.match(info.proposalReason, /제정하려는 것임/);
        return `첨부 ${info.attachments.length}건 · 제안이유 ${info.proposalReason.length}자`;
      },
    );
  })();
}

// ─── 3. NsmLmSts 호환 어댑터 (네트워크 없음) ─────────────────────────────────

function checkAdapter() {
  const { LikmsNsmAdapter, LikmsStateCrawler } = lib;

  return (async () => {
    await check('LikmsNsmAdapter.parseList — NSM 형태로 변환', () => {
      const result = new LikmsNsmAdapter().parseList(LIKMS_STATE_FRAGMENT_HTML);
      assert.deepEqual(Object.keys(result).sort(), [
        'currentPage',
        'items',
        'total',
        'totalPages',
      ]);
      const item = result.items[0];
      assert.deepEqual(Object.keys(item).sort(), [
        'billName',
        'billNo',
        'committee',
        'link',
        'ministry',
        'progressDate',
        'progressStatus',
        'proposalDate',
        'proposer',
        'resolutionDate',
        'resolutionStatus',
      ]);
      assert.equal(item.ministry, '');
      assert.equal(item.resolutionStatus, '');
      return `${result.items.length}건 · 필드 11개`;
    });

    await check(
      'LikmsNsmAdapter.parseDetail — proposalInfo 조합·fileId=URL',
      () => {
        const detail = new LikmsNsmAdapter().parseDetail(LIKMS_BILL_INFO_HTML);
        assert.equal(detail.billNo, '2221883');
        assert.equal(
          detail.proposalInfo,
          '주진우의원 등 10인, 제2221883호(2026-10-13). 제22대(2024~2028)제439회',
        );
        assert.equal(detail.attachments[0].fileId.startsWith('https://'), true);
        return detail.proposalInfo;
      },
    );

    await check('LikmsStateCrawler.filterPending — 접수만 남긴다', () => {
      const crawler = new LikmsStateCrawler();
      const parser = new lib.LikmsStateParser();
      const mixed = parser.parseList(LIKMS_STATE_FRAGMENT_HTML).items;
      const pending = crawler.filterPending(mixed);
      assert.equal(mixed.length, 2);
      assert.equal(pending.length, 1);
      assert.equal(pending[0].progressStatus, '접수');

      const allPending = parser.parseList(
        LIKMS_STATE_FRAGMENT_PENDING_HTML,
      ).items;
      assert.equal(crawler.filterPending(allPending).length, 2);
      return `${mixed.length}건 → ${pending.length}건 (모두 접수면 ${allPending.length}건 유지)`;
    });

    await check(
      '포트 인터페이스(구조적) — 두 구현이 같은 메서드를 가진다',
      () => {
        const listMethods = [
          'getListHTML',
          'parseList',
          'search',
          'getPage',
          'getAllPages',
        ];
        const detailMethods = ['getDetailHTML', 'parseDetail', 'getDetail'];
        const pendingMethods = ['searchPending', 'getAllPendingPages'];

        const nsm = new lib.NsmLmSts();
        const adapter = new LikmsNsmAdapter();
        for (const name of [
          ...listMethods,
          ...detailMethods,
          ...pendingMethods,
        ]) {
          assert.equal(typeof nsm[name], 'function', `NsmLmSts.${name} 누락`);
          assert.equal(
            typeof adapter[name],
            'function',
            `LikmsNsmAdapter.${name} 누락`,
          );
        }
        // 어댑터 전용 확장 지점
        assert.equal(typeof adapter.likms.clearSession, 'function');
        // 동명이인 후보 조회(어댑터는 `likms`로 노출)
        assert.equal(
          typeof adapter.likms.findRepresentCandidates,
          'function',
          'LikmsStateCrawler.findRepresentCandidates 누락',
        );
        return `${listMethods.length}+${detailMethods.length}+${pendingMethods.length}개 메서드`;
      },
    );

    await check(
      '이름 기반 자동 해석은 노출하지 않는다(확정 값만)',
      async () => {
        const instance = new LikmsNsmAdapter();
        assert.equal(
          typeof instance.likms.resolveRepresentId,
          'undefined',
          '이름 자동 해석이 다시 생겼습니다',
        );
        await assert.rejects(
          () => instance.search({ scPpsUsr: '문진석' }),
          /scPpsUsr is not supported/,
        );
        return 'resolveRepresentId 없음 · scPpsUsr 예외';
      },
    );

    await check(
      '소관위 목록·필터 — 이름→코드 해석 경로가 노출된다',
      async () => {
        const { LikmsStateParser } = lib;
        const parser = new LikmsStateParser();
        const committees = parser.parseCommittees(
          JSON.stringify({
            ageCmtList: [{ comCd: '9700006', comCdName: '법제사법위원회' }],
          }),
        );
        assert.deepEqual(committees, [
          { comCd: '9700006', comCdName: '법제사법위원회', cdOrd: null },
        ]);
        assert.deepEqual(parser.parseCommittees('<html>'), []);

        const crawler = new LikmsStateCrawler();
        assert.equal(typeof crawler.findCommittees, 'function');
        // 범위를 반쪽만 주면 서버가 무시하므로 네트워크 전에 막는다.
        await assert.rejects(
          () => crawler.findCommittees('22'),
          /ageFrom and ageTo are required together/,
        );
        return 'parseCommittees · findCommittees(범위 가드) OK';
      },
    );

    await check('어댑터는 생성만으로 네트워크를 호출하지 않는다', () => {
      const adapter = new LikmsNsmAdapter({ timeout: 1000 });
      assert.equal(adapter.likms instanceof lib.LikmsStateCrawler, true);
      assert.equal(
        adapter.parseList('<div id="state-list"></div>').items.length,
        0,
      );
      return '생성 + 오프라인 파싱만 수행';
    });
  })();
}

// ─── 4. 실사이트 통합 (--live) ───────────────────────────────────────────────

function checkLive() {
  const { PalCrawl, NsmLmSts, LikmsNsmAdapter, LikmsStateCrawler } = lib;
  const config = { timeout: 20000 };

  return (async () => {
    console.log('\n--live: 실제 사이트 호출 (시간이 걸립니다)');

    await check('PalCrawl.search — 국회입법예고 목록', async () => {
      const result = await new PalCrawl(config).search({
        pageIndex: 1,
        pageSize: 3,
      });
      assert.ok(result.items.length > 0, 'items가 비었습니다');
      assert.match(result.items[0].link, /^https:\/\/pal\.assembly\.go\.kr\//);
      return `total=${result.total} · 첫 건 ${result.items[0].contentId}`;
    });

    await check('NsmLmSts.search — 국민참여입법센터 목록', async () => {
      const result = await new NsmLmSts(config).search({
        pageIndex: 1,
        pageSize: 3,
        sugCd: '22',
        endSugCd: '22',
      });
      assert.ok(result.items.length > 0, 'items가 비었습니다');
      return `total=${result.total} · ${result.items.length}건`;
    });

    await check('NsmLmSts.searchPending — 발의 상태', async () => {
      const result = await new NsmLmSts(config).searchPending({
        pageIndex: 1,
        pageSize: 3,
        sugCd: '22',
        endSugCd: '22',
      });
      assert.ok(result.items.length > 0, 'items가 비었습니다');
      assert.equal(result.items[0].progressStatus, '발의');
      return `total=${result.total} · 첫 건 ${result.items[0].billNo}`;
    });

    const likms = new LikmsStateCrawler(config);
    let firstBillNo = null;

    await check('LikmsStateCrawler.search — 계류의안 목록', async () => {
      const result = await likms.search({ pageSize: 5 });
      assert.ok(result.items.length > 0, 'items가 비었습니다');
      firstBillNo = result.items[0].billNo;
      return `total=${result.total} · 첫 건 ${firstBillNo} (${result.items[0].progressStatus})`;
    });

    await check(
      'LikmsStateCrawler.findRepresentCandidates — 동명이인 후보(실사이트)',
      async () => {
        // 이름이 겹치는 것으로 알려진 조합(주진우 = 22대·16대)으로 후보 목록을 받아본다.
        const candidates = await likms.findRepresentCandidates('주진우');
        assert.ok(candidates.length > 1, `후보가 ${candidates.length}건입니다`);
        assert.equal(
          candidates.every((c) => c.membId && c.age && c.party),
          true,
          'membId·대수·정당이 빈 후보가 있습니다',
        );
        return `${candidates.length}명 · ${candidates
          .map((c) => `${c.age} ${c.party}`)
          .join(', ')}`;
      },
    );

    await check(
      'LikmsStateCrawler.getAllPendingPages — 접수 스캔',
      async () => {
        const found = [];
        for await (const page of new LikmsStateCrawler(
          config,
        ).getAllPendingPages({}, { maxPages: 3, delayMs: 300 })) {
          found.push(...page.items);
        }
        assert.ok(
          found.length > 0,
          '접수 건을 찾지 못했습니다(스캔 범위 확인)',
        );
        assert.equal(
          found.every((item) => item.progressStatus === '접수'),
          true,
          '접수 아닌 항목이 섞였습니다',
        );
        return `${found.length}건 · 예: ${found[0].billNo}`;
      },
    );

    await check('LikmsNsmAdapter.getDetail — 의안 상세', async () => {
      if (!firstBillNo) {
        throw new Error('앞선 목록 조회가 실패해 billNo를 얻지 못했습니다');
      }
      const detail = await new LikmsNsmAdapter(config).getDetail(firstBillNo);
      assert.ok(detail.title.length > 0, 'title이 비었습니다');
      assert.equal(detail.billNo, firstBillNo);
      return `title ${detail.title.length}자 · 제안이유 ${(detail.proposalReason ?? '').length}자 · 첨부 ${detail.attachments.length}건`;
    });

    await check(
      'LikmsStateCrawler.findCommittees — 대수별 소관위 목록(실사이트)',
      async () => {
        const committees = await new LikmsStateCrawler(config).findCommittees(
          '22',
          '22',
        );
        assert.ok(
          committees.length > 10,
          `소관위가 ${committees.length}건입니다`,
        );
        const law = committees.find((c) => c.comCdName === '법제사법위원회');
        assert.ok(law, '법제사법위원회를 찾지 못했습니다');
        assert.equal(law.comCd, '9700006');
        return `${committees.length}건 · 법제사법위원회=${law.comCd}`;
      },
    );

    await check(
      'LikmsStateCrawler.search — 소관위(cmtResultCd) 필터(실사이트)',
      async () => {
        await sleep(300);
        const all = await likms.search({ pageSize: 1 });
        const pendingOnly = await likms.search({
          pageSize: 1,
          cmtResultCd: 'PRC_0000',
        });
        await sleep(300);
        const lawCommittee = await likms.search({
          pageSize: 1,
          ageCmtId: '9700006',
        });
        assert.ok(
          pendingOnly.total > 0 && pendingOnly.total < all.total,
          'cmtResultCd 필터가 반영되지 않았습니다',
        );
        assert.ok(
          lawCommittee.total > 0 && lawCommittee.total < all.total,
          'ageCmtId 필터가 반영되지 않았습니다',
        );
        return `전체 ${all.total} · 계류 ${pendingOnly.total} · 법사위 ${lawCommittee.total}`;
      },
    );

    await check(
      'LikmsStateCrawler — 연속 조회(세션/CSRF 캐시 재사용)',
      async () => {
        await sleep(300);
        const result = await likms.search({ pageSize: 3 });
        assert.ok(result.items.length > 0, 'items가 비었습니다');
        return `${result.items.length}건 · 두 번째 호출도 정상`;
      },
    );
  })();
}

// ─── 실행 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`pal-crawl dist 런타임 검증${LIVE ? ' (--live)' : ''}`);
  console.log(`  entry: ${DIST_ENTRY}`);

  await checkExports();
  await checkParsers();
  await checkAdapter();
  if (LIVE) {
    await checkLive();
  } else {
    console.log('\n(--live 미지정: 실사이트 호출은 건너뜀)');
  }

  const failed = results.filter((ok) => !ok).length;
  const passed = results.length - failed;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
