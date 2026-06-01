# 국회 입법예고 크롤러

[![License](https://img.shields.io/badge/License-MIT-blue)](#license)
[![stars - pal-crawl](https://img.shields.io/github/stars/vientorepublic/pal-crawl?style=social)](https://github.com/vientorepublic/pal-crawl)
[![forks - pal-crawl](https://img.shields.io/github/forks/vientorepublic/pal-crawl?style=social)](https://github.com/vientorepublic/pal-crawl)
[![npm version](https://badge.fury.io/js/pal-crawl.svg)](https://badge.fury.io/js/pal-crawl)
[![Build](https://github.com/vientorepublic/pal-crawl/actions/workflows/build.yml/badge.svg)](https://github.com/vientorepublic/pal-crawl/actions/workflows/build.yml)
[![Test](https://github.com/vientorepublic/pal-crawl/actions/workflows/test.yml/badge.svg)](https://github.com/vientorepublic/pal-crawl/actions/workflows/test.yml)

<img width="1312" alt="Screenshot" src="https://github.com/user-attachments/assets/2e243915-6d9c-470b-9510-27ef5546ab61" />

국회입법예고(pal.assembly.go.kr)의 진행 중인 입법 예고 크롤러

---

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Configuration](#configuration)
- [Base Types](#base-types)
- [Methods](#methods)
  - [get](#get--promiseitable-data)
  - [getContentHTML](#getcontenthtmlid-string--promisestring)
  - [getContent](#getcontentid-string--promiseicontentdata)
  - [getDone](#getdone--promiseitable-data)
  - [getDoneContentHTML](#getdonecontenthtmlid-string--promisestring)
  - [getDoneContent](#getdonecontentid-string--promiseicontentdata)
  - [Screenshot APIs](#screenshot-apis)
  - [search / searchDone](#searchquery-isearchquery--promiseisearchresult)
  - [getPage / getDonePage](#getpagepageindex-number-pageunit-number--promiseitable-data)
  - [getAllPages / getAllDonePages](#getallpagesquery-isearchquery-options-ibulkoptions--asyncgeneratorisearchresult)
- [NsmLmSts - 국민참여입법센터 국회입법현황](#nsmlmsts--국민참여입법센터-국회입법현황)
  - [NsmLmSts Configuration](#nsmlmsts-configuration)
  - [NsmLmSts Types](#nsmlmsts-types)
  - [search (NsmLmSts)](#searchquery-insmsearchquery--promiseinsmsearchresult)
  - [searchPending](#searchpendingquery--promiseinsmsearchresult)
  - [getPage (NsmLmSts)](#getpagepageindex-number-query--promiseinsmBillitem)
  - [getDetail](#getdetailbillno-string--promiseinsmBilldetail)
  - [getAllPages (NsmLmSts)](#getallpagesquery-options--asyncgeneratorinsmsearchresult)
  - [getAllPendingPages](#getallpendingpagesquery-options--asyncgeneratorinsmsearchresult)
- [Examples](#examples)
- [License](#license)

---

## Introduction

국회입법예고(pal.assembly.go.kr) 사이트에서 진행 중인 입법 예고 데이터를 크롤링하는 도구입니다. 입법 예고의 주요 정보를 손쉽게 가져올 수 있습니다.

국민참여입법센터 국회입법현황(opinion.lawmaking.go.kr)에서 법안을 크롤링하는 `NsmLmSts` 클래스도 포함되어 있습니다. 위원회 회부 이전에 발의된 상태로 대기 중인 법안까지 조회할 수 있습니다.

---

## Installation

```bash
npm install pal-crawl
```

---

## Configuration

`PalCrawl` 클래스는 생성자에서 선택적 설정 객체를 받을 수 있습니다.

```typescript
interface PalCrawlConfig {
  userAgent?: string; // 사용자 정의 User-Agent (기본값: Chrome User-Agent)
  timeout?: number; // HTTP 요청 타임아웃 (밀리초, 기본값: 10000)
  retryCount?: number; // 재시도 횟수 (기본값: 3)
  customHeaders?: Record<string, string>; // 사용자 정의 헤더
  screenshot?: ScreenshotOptions; // 헤드리스 크로뮴 스크린샷 옵션
}

interface ScreenshotOptions {
  enabled?: boolean; // 스크린샷 기능 활성화 여부 (기본값: false)
  fullPage?: boolean; // 전체 페이지 캡처 여부 (기본값: true)
  width?: number; // 뷰포트 너비 (기본값: 1920)
  height?: number; // 뷰포트 높이 (기본값: 1080)
  format?: 'png' | 'jpeg'; // 이미지 포맷 (기본값: 'png')
  quality?: number; // jpeg 품질 0~100 (기본값: 80)
}
```

스크린샷 기능은 기본적으로 비활성화되어 있으며, `screenshot.enabled: true`일 때만 동작합니다.

### 기본 사용법

```typescript
// 기본 설정으로 사용
const palCrawl = new PalCrawl();

// 사용자 정의 설정으로 사용
const palCrawl = new PalCrawl({
  userAgent: 'My Custom Bot 1.0',
  timeout: 15000,
  retryCount: 5,
  customHeaders: {
    'Accept-Language': 'ko-KR',
    Accept: 'text/html,application/xhtml+xml',
  },
});
```

---

## Base Types

`ITableData`는 크롤링된 입법 예고 데이터를 나타내는 인터페이스입니다.

```typescript
interface ITableData {
  num: number; // 의안번호
  subject: string; // 입법예고 제목
  proposerCategory: string; // 제안자 구분
  committee: string; // 소관 위원회
  numComments: number; // 의견 수
  link: string; // 전문 보기 링크
  contentId: string | null; // 링크에서 추출한 본문 조회용 의안 ID
  attachments: IAttachment; // 법률안 전문 첨부파일 URL 객체
}
```

`IAttachment`는 입법 예고의 법률안 전문 첨부파일 URL을 나타내는 인터페이스입니다.

pdf와 hwp 파일 다운로드 링크 추출을 지원합니다.

```typescript
interface IAttachment {
  pdfFile: string | null;
  hwpFile: string | null;
}
```

`IContentData`는 입법예고 본문 데이터를 나타내는 인터페이스입니다.

```typescript
interface IContentData {
  title: string; // 본문 페이지 제목
  proposalReason: string | null; // 제안이유 및 주요내용
  billNumber: string | null; // 의안번호
  proposer: string | null; // 제안자
  proposalDate: string | null; // 제안일
  committee: string | null; // 소관위원회
  referralDate: string | null; // 회부일
  noticePeriod: string | null; // 입법예고기간
  proposalSession: string | null; // 제안회기
}
```

`ISearchResult`는 검색/페이지 조회 결과를 나타내는 인터페이스입니다.

```typescript
interface ISearchResult {
  total: number; // 전체 건수
  totalPages: number; // 전체 페이지 수
  currentPage: number; // 현재 페이지
  items: ITableData[]; // 현재 페이지 항목 목록
}
```

`ISearchQuery`는 검색 필터 옵션을 나타내는 인터페이스입니다.

```typescript
interface ISearchQuery {
  pageIndex?: number; // 페이지 번호 (기본값: 1)
  pageUnit?: number; // 페이지당 항목 수 (5~9, 20, 30, 50, 100; 기본값: 10)
  committeeId?: string; // 소관위원회 ID (예: '9700006' = 법제사법위원회)
  billName?: string; // 법안명 검색어
  represent?: string; // 대표발의자 검색어
  proposers?: string; // 공동발의자 검색어 (쉼표 구분 AND 조건)
  ppslRsonMnCn?: string; // 제안이유 검색어
  sortCol?:
    | 'BILL_NO'
    | 'BILL_NAME'
    | 'CURR_COMMITTEE'
    | 'OPN_CNT'
    | 'LGSLT_PA_RG_DT';
  sortGbn?: 'DESC' | 'ASC';
  // 종료된 입법예고 전용:
  fromAge?: number; // 시작 대수 (예: 21)
  toAge?: number; // 종료 대수 (예: 22)
  billNo?: string; // 의안번호 검색어
}
```

`IBulkOptions`는 대량 수집 시 동작을 제어하는 인터페이스입니다.

```typescript
interface IBulkOptions {
  delayMs?: number; // 페이지 간 요청 지연 (밀리초, 기본값: 500)
  concurrency?: number; // 동시 요청 수 (기본값: 1)
  maxPages?: number; // 최대 수집 페이지 수 (기본값: 전체)
}
```

---

## Methods

### get() => Promise\<ITableData[]>

`get` 메서드는 진행 중인 입법 예고 데이터를 가져옵니다.

반환되는 각 항목에는 `contentId`가 포함되며, 이 값을 `getContentHTML` 또는 `getContent`에 전달해 본문 조회를 바로 수행할 수 있습니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const table = await palCrawl.get();

console.log(table);
```

### getContentHTML(id: string) => Promise\<string>

`getContentHTML` 메서드는 진행 중인 입법 예고 중 특정 의안 ID의 본문 페이지 HTML 원문을 가져옵니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const table = await palCrawl.get();

const id = table[0]?.contentId;
if (id) {
  const contentHtml = await palCrawl.getContentHTML(id);
  console.log(contentHtml);
}
```

### getContent(id: string) => Promise\<IContentData>

`getContent` 메서드는 특정 의안 ID의 본문 페이지를 파싱해 JSON 객체(`IContentData`)로 반환합니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const content = await palCrawl.getContent('PRC_W2W6V0D4D0B9C1B4B4Z6V2W0U7V2T9');

console.log(content);
// {
//   title: '[2218288] 조세특례제한법 일부개정법률안(윤한홍의원 등 10인)',
//   proposalReason: '...',
//   billNumber: '2218288',
//   proposer: '윤한홍의원 등 10인',
//   proposalDate: '2026-04-01',
//   committee: '기획재정위원회',
//   referralDate: '2026-04-02',
//   noticePeriod: '2026-04-02~2026-04-11',
//   proposalSession: '제22대(2024~2028) 제433회'
// }
```

### getDone() => Promise\<ITableData[]>

`getDone` 메서드는 종료된 입법 예고 데이터를 가져옵니다.

반환되는 각 항목에는 `contentId`가 포함되며, 이 값을 `getDoneContentHTML` 또는 `getDoneContent`에 전달해 본문 조회를 바로 수행할 수 있습니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const table = await palCrawl.getDone();

console.log(table);
```

### getDoneContentHTML(id: string) => Promise\<string>

`getDoneContentHTML` 메서드는 종료된 입법 예고 중 특정 의안 ID의 본문 페이지 HTML 원문을 가져옵니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const table = await palCrawl.getDone();

const id = table[0]?.contentId;
if (id) {
  const contentHtml = await palCrawl.getDoneContentHTML(id);
  console.log(contentHtml);
}
```

### getDoneContent(id: string) => Promise\<IContentData>

`getDoneContent` 메서드는 종료된 입법 예고 중 특정 의안 ID의 본문 페이지를 파싱해 JSON 객체(`IContentData`)로 반환합니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const content = await palCrawl.getDoneContent(
  'PRC_S2R6N0M3K2J3K1J5K3S8R3P4O3P5X6',
);

console.log(content);
// {
//   title: '[2218503] 전자장치 부착 등에 관한 법률 일부개정법률안 (김기현의원 등 10인)',
//   proposalReason: '...',
//   billNumber: '2218503',
//   proposer: '김기현의원 등 10인',
//   ...
// }
```

---

### Screenshot APIs

헤드리스 크로뮴(Puppeteer) 기반으로 웹페이지 스크린샷을 `Buffer`로 받을 수 있습니다.

### initBrowser() => Promise\<void>

브라우저 인스턴스를 미리 초기화합니다. 스크린샷 호출 시 자동 초기화되므로 선택적으로 사용하면 됩니다.

### closeBrowser() => Promise\<void>

열려 있는 브라우저 인스턴스를 종료합니다. 스크린샷 작업 후 호출을 권장합니다.

### takeScreenshot(url: string) => Promise\<Buffer>

임의 URL을 열어 스크린샷 이미지 버퍼를 반환합니다.

### getPalScreenshot() => Promise\<Buffer>

진행 중 입법예고 목록 페이지 스크린샷 버퍼를 반환합니다.

### getContentScreenshot(id: string) => Promise\<Buffer>

진행 중 입법예고 본문 페이지(의안 ID 기준) 스크린샷 버퍼를 반환합니다.

### getDoneScreenshot() => Promise\<Buffer>

종료된 입법예고 목록 페이지 스크린샷 버퍼를 반환합니다.

### getDoneContentScreenshot(id: string) => Promise\<Buffer>

종료된 입법예고 본문 페이지(의안 ID 기준) 스크린샷 버퍼를 반환합니다.

### updateScreenshotConfig(config: Partial\<ScreenshotOptions>) => void

런타임에 스크린샷 옵션을 변경합니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl({
  screenshot: {
    enabled: true,
    format: 'png',
    fullPage: true,
  },
});

palCrawl.updateScreenshotConfig({ format: 'jpeg', quality: 85 });
```

---

### search(query?: ISearchQuery) => Promise\<ISearchResult>

`search` 메서드는 진행 중인 입법 예고를 조건에 맞게 검색합니다. 검색 결과에는 총 건수, 페이지 정보, 항목 목록이 포함됩니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();

// 기본 조회 (1페이지 10건)
const result = await palCrawl.search();
console.log(result.total, result.totalPages, result.items);

// 법안명 필터 + 정렬
const filtered = await palCrawl.search({
  billName: '도로교통법',
  sortCol: 'BILL_NAME',
  sortGbn: 'ASC',
  pageUnit: 20,
});
```

### searchDone(query?: ISearchQuery) => Promise\<ISearchResult>

`searchDone` 메서드는 종료된 입법 예고를 조건에 맞게 검색합니다. `fromAge`, `toAge`, `billNo` 필터를 추가로 지원합니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();

// 22대 종료 입법예고만 조회
const result = await palCrawl.searchDone({ fromAge: 22, toAge: 22 });
console.log(result.total, result.items);
```

---

### getPage(pageIndex: number, pageUnit?: number) => Promise\<ITableData[]>

`getPage` 메서드는 진행 중인 입법 예고에서 특정 페이지의 항목을 가져옵니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();

const page1 = await palCrawl.getPage(1); // 1페이지 (기본 10건)
const page2 = await palCrawl.getPage(2, 20); // 2페이지, 20건씩
```

### getDonePage(pageIndex: number, pageUnit?: number) => Promise\<ITableData[]>

`getDonePage` 메서드는 종료된 입법 예고에서 특정 페이지의 항목을 가져옵니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const page3 = await palCrawl.getDonePage(3);
```

---

### getAllPages(query?: ISearchQuery, options?: IBulkOptions) => AsyncGenerator\<ISearchResult>

`getAllPages` 메서드는 진행 중인 입법 예고를 여러 페이지에 걸쳐 순차적으로 수집하는 비동기 제너레이터입니다. `for await...of` 루프로 한 페이지씩 처리할 수 있습니다.

- `delayMs` (기본값: 500): 페이지 요청 사이의 지연 시간(ms). 서버 부하를 줄이기 위해 설정하세요.
- `concurrency` (기본값: 1): 동시에 요청할 페이지 수.
- `maxPages` (기본값: 전체 페이지): 수집할 최대 페이지 수.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();

// 처음 5 페이지를 순서대로 수집
for await (const page of palCrawl.getAllPages(
  {},
  { maxPages: 5, delayMs: 300 },
)) {
  console.log(
    `페이지 ${page.currentPage}/${page.totalPages}: ${page.items.length}건`,
  );
  for (const item of page.items) {
    console.log(item.subject);
  }
}
```

### getAllDonePages(query?: ISearchQuery, options?: IBulkOptions) => AsyncGenerator\<ISearchResult>

`getAllDonePages`는 종료된 입법 예고에 대한 대량 수집 제너레이터입니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();

// 22대 종료 입법예고 전체 수집 (concurrency=2, 지연 200ms)
for await (const page of palCrawl.getAllDonePages(
  { fromAge: 22, toAge: 22 },
  { concurrency: 2, delayMs: 200 },
)) {
  console.log(`${page.currentPage}/${page.totalPages}: ${page.items.length}건`);
}
```

---

## NsmLmSts - 국민참여입법센터 국회입법현황

`NsmLmSts` 클래스는 [국민참여입법센터 국회입법현황](https://opinion.lawmaking.go.kr/gcom/nsmLmSts/out)에서 법안 목록과 상세 정보를 크롤링합니다. 위원회 회부 이전 발의 상태 법안까지 필터링할 수 있는 것이 특징입니다.

---

### NsmLmSts Configuration

`NsmLmSts` 생성자는 `PalCrawl`과 동일한 네트워크 설정 옵션을 받습니다 (스크린샷 제외).

```typescript
const nsm = new NsmLmSts({
  userAgent: 'My Bot 1.0',
  timeout: 15000,
  retryCount: 3,
  customHeaders: { 'Accept-Language': 'ko-KR' },
});
```

---

### NsmLmSts Types

`INsmSearchQuery`는 목록 검색 필터 옵션입니다.

```typescript
interface INsmSearchQuery {
  pageIndex?: number; // 페이지 번호 (기본값: 1)
  pageSize?: number; // 페이지당 건수 (10 | 20 | 50 | 100)
  sugCd?: string; // 제안대수 시작 (예: "22" → 제22대)
  endSugCd?: string; // 제안대수 끝
  sgtCls?: NsmProposerType; // 발의구분
  cptOfiOrgCd?: string; // 소관부처 코드
  rslRsltNmL?: NsmProgressStatus; // 국회현황 코드
  rslRsltNmR?: NsmResolutionStatus; // 의결현황 코드
  scCptPpostCmt?: string; // 상임위 (예: "법제사법위원회")
  searchStDtNew?: string; // 제안일자 시작 (YYYY-MM-DD)
  searchEdDtNew?: string; // 제안일자 종료 (YYYY-MM-DD)
  scPpsUsr?: string; // 제안자
  issLawitmYn?: 'Y'; // 규제 신설·강화 해당 법안만
  stDt?: string; // 추진일자 시작 (YYYY-MM-DD)
  edDt?: string; // 추진일자 종료 (YYYY-MM-DD)
  scBlNmSct?: string; // 의안번호 또는 의안명
  sortCol?: string;
  sortOrder?: 'DESC' | 'ASC';
}
```

`NsmProgressStatus`는 국회현황 필터 코드입니다.

| 코드       | 의미                                   |
| ---------- | -------------------------------------- |
| `'900101'` | 발의 (위원회 회부 이전 대기 상태 포함) |
| `'900102'` | 위원회 회부                            |
| `'900103'` | 위원회 상정                            |
| `'900104'` | 위원회 법안소위                        |
| `'900105'` | 위원회 전체회의                        |
| `'900106'` | 법사위 심사                            |
| `'900107'` | 본회의 심의                            |
| `'900108'` | 정부이송                               |
| `'900109'` | 공포                                   |

`NsmProposerType`은 발의구분 코드입니다.

| 코드       | 의미   |
| ---------- | ------ |
| `'900201'` | 정부   |
| `'900202'` | 의원   |
| `'900203'` | 위원장 |

`NsmResolutionStatus`는 의결현황 코드입니다.

| 코드       | 의미         |
| ---------- | ------------ |
| `'902911'` | 수정가결     |
| `'902912'` | 원안가결     |
| `'902913'` | 부결         |
| `'902914'` | 대안반영폐기 |
| `'902915'` | 폐기         |
| `'902916'` | 임기만료폐기 |
| `'902917'` | 철회         |

`INsmBillItem`은 목록 페이지의 법안 한 건입니다.

```typescript
interface INsmBillItem {
  billName: string; // 법안명
  billNo: string; // 의안번호
  link: string; // 상세 페이지 링크
  proposer: string; // 제안자
  proposalDate: string; // 제안일
  committee: string; // 상임위원회 (회부 전이면 빈 문자열)
  ministry: string; // 소관부처
  progressStatus: string; // 국회현황 (예: "발의", "위원회 회부")
  progressDate: string; // 추진일자
  resolutionStatus: string; // 의결현황 (예: "원안가결")
  resolutionDate: string; // 의결일자
}
```

`INsmBillDetail`은 상세 페이지의 법안 정보입니다.

```typescript
interface INsmBillDetail {
  title: string; // 법안명
  billNo: string; // 의안번호
  proposalInfo: string; // 발의정보 원문 텍스트
  proposer: string; // 제안자
  proposalDate: string; // 제안일
  session: string; // 제안회기 (예: "제435회 국회(임시회)")
  proposalReason: string | null; // 제안이유 및 주요내용
  attachments: INsmAttachment[]; // 의안원문 첨부파일 목록
}
```

`INsmAttachment`는 첨부파일 정보입니다.

```typescript
interface INsmAttachment {
  filename: string; // 파일명
  fileId: string; // fnDownload() 호출에 사용되는 파일 ID
}
```

`INsmSearchResult`는 목록 검색 결과입니다.

```typescript
interface INsmSearchResult {
  total: number;
  totalPages: number;
  currentPage: number;
  items: INsmBillItem[];
}
```

---

### search(query?: INsmSearchQuery) => Promise\<INsmSearchResult>

법안 목록을 검색합니다. 필터를 지정하지 않으면 최신 법안 1페이지를 반환합니다.

```typescript
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts();

// 기본 조회
const result = await nsm.search();
console.log(result.total, result.items);

// 제22대 의원발의 법안 조회
const filtered = await nsm.search({
  sugCd: '22',
  endSugCd: '22',
  sgtCls: '900202',
  pageSize: 20,
});
```

---

### searchPending(query?) => Promise\<INsmSearchResult>

위원회 회부 이전 발의 상태(`rslRsltNmL: '900101'`)로 고정하여 조회합니다. 대기 중인 법안만 가져오고 싶을 때 사용합니다.

```typescript
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts();

// 현재 발의 상태로 대기 중인 법안 조회
const pending = await nsm.searchPending();
console.log(`발의 대기 중: ${pending.total}건`);
pending.items.forEach((item) => console.log(item.billName));
```

---

### getPage(pageIndex: number, query?) => Promise\<INsmBillItem[]>

특정 페이지의 법안 목록만 배열로 반환합니다.

```typescript
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts();
const page2 = await nsm.getPage(2, { pageSize: 20 });
```

---

### getDetailHTML(billNo: string) => Promise\<string>

법안 상세 페이지의 HTML 원문을 반환합니다.

### getDetail(billNo: string) => Promise\<INsmBillDetail>

의안번호로 법안 상세 정보를 조회합니다.

```typescript
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts();
const items = await nsm.getPage(1);
const detail = await nsm.getDetail(items[0].billNo);

console.log(detail.title);
console.log(detail.proposer);
console.log(detail.proposalDate);
console.log(detail.session);
console.log(detail.proposalReason);
console.log(detail.attachments);
// [{ filename: '법안.hwp', fileId: '99001' }, ...]
```

---

### getAllPages(query?, options?) => AsyncGenerator\<INsmSearchResult>

전체 페이지를 순차적으로 yield하는 async generator입니다. `IBulkOptions`로 딜레이·동시성·최대 페이지를 조절할 수 있습니다.

```typescript
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts();

for await (const page of nsm.getAllPages(
  { pageSize: 20 },
  { maxPages: 5, delayMs: 300 },
)) {
  console.log(
    `페이지 ${page.currentPage}/${page.totalPages}: ${page.items.length}건`,
  );
}
```

---

### getAllPendingPages(query?, options?) => AsyncGenerator\<INsmSearchResult>

발의 상태(`rslRsltNmL: '900101'`) 법안 전체를 페이지 단위로 yield합니다.

```typescript
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts();
const pendingItems = [];

for await (const page of nsm.getAllPendingPages({}, { delayMs: 500 })) {
  pendingItems.push(...page.items);
  console.log(
    `${page.currentPage}/${page.totalPages}: 누적 ${pendingItems.length}건`,
  );
}
```

---

## Examples

### 기본 사용법

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const data = await palCrawl.get();
console.log(data);
```

### 목록에서 contentId를 이용해 본문 가져오기

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const table = await palCrawl.get();

const first = table.find((item) => item.contentId);
if (first?.contentId) {
  const content = await palCrawl.getContent(first.contentId);
  console.log(content.title);
  console.log(content.proposalReason);
  console.log(content.billNumber);
  console.log(content.noticePeriod);
}
```

### 사용자 정의 User-Agent 사용

```typescript
import { PalCrawl, type PalCrawlConfig } from 'pal-crawl';

const config: PalCrawlConfig = {
  userAgent: 'MyBot/1.0 (https://example.com)',
};

const palCrawl = new PalCrawl(config);
const data = await palCrawl.get();
```

### 고급 설정 (타임아웃, 재시도, 헤더)

```typescript
import { PalCrawl, type PalCrawlConfig } from 'pal-crawl';

const config: PalCrawlConfig = {
  userAgent: 'Advanced Bot 2.0',
  timeout: 20000, // 20초 타임아웃
  retryCount: 2, // 2회 재시도
  customHeaders: {
    'Accept-Language': 'ko-KR',
    'Cache-Control': 'no-cache',
  },
};

const palCrawl = new PalCrawl(config);
const data = await palCrawl.get();
```

### 종료된 입법예고 목록에서 본문 가져오기

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const table = await palCrawl.getDone();

const first = table.find((item) => item.contentId);
if (first?.contentId) {
  const content = await palCrawl.getDoneContent(first.contentId);
  console.log(content.title);
  console.log(content.proposalReason);
  console.log(content.billNumber);
  console.log(content.noticePeriod);
}
```

### 검색 필터를 사용해 법안 조회하기

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();

// 법안명 검색
const result = await palCrawl.search({ billName: '도로교통법', pageUnit: 20 });
console.log(`총 ${result.total}건 (${result.totalPages}페이지)`);
result.items.forEach((item) => console.log(item.subject));

// 22대 종료 입법예고에서 의안번호로 검색
const done = await palCrawl.searchDone({
  fromAge: 22,
  toAge: 22,
  billNo: '2218',
});
done.items.forEach((item) => console.log(item.subject));
```

### 대량 수집 (getAllPages / getAllDonePages)

```typescript
import { PalCrawl, type ITableData } from 'pal-crawl';

const palCrawl = new PalCrawl();
const allItems: ITableData[] = [];

// 진행 중인 입법예고 전체 페이지 수집 (500ms 지연)
for await (const page of palCrawl.getAllPages({}, { delayMs: 500 })) {
  allItems.push(...page.items);
  console.log(`수집 중: ${page.currentPage}/${page.totalPages} 페이지`);
}

console.log(`전체 ${allItems.length}건 수집 완료`);
```

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();

// 처음 10 페이지만, 동시 2개 요청으로 빠르게 수집
for await (const page of palCrawl.getAllDonePages(
  { sortCol: 'LGSLT_PA_RG_DT', sortGbn: 'DESC' },
  { maxPages: 10, concurrency: 2, delayMs: 200 },
)) {
  console.log(
    `페이지 ${page.currentPage}: ${page.items.map((i) => i.subject).join(', ')}`,
  );
}
```

### 법률안 본문 스크린샷 버퍼 받기 (선택적 헤드리스 크로뮴)

```typescript
import fs from 'node:fs';
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl({
  screenshot: {
    enabled: true,
    fullPage: true,
    width: 1920,
    height: 1080,
    format: 'png',
  },
});

try {
  const table = await palCrawl.get();
  const first = table.find((item) => item.contentId);

  if (first?.contentId) {
    const imageBuffer = await palCrawl.getContentScreenshot(first.contentId);
    fs.writeFileSync('bill-content.png', imageBuffer);
  }
} finally {
  await palCrawl.closeBrowser();
}
```

`takeScreenshot`, `getPalScreenshot`, `getContentScreenshot`, `getDoneScreenshot`, `getDoneContentScreenshot`는 모두 `Buffer`를 반환합니다.

### 국민참여입법센터에서 발의 대기 중인 법안 전체 수집

```typescript
import { NsmLmSts, type INsmBillItem } from 'pal-crawl';

const nsm = new NsmLmSts();
const pendingItems: INsmBillItem[] = [];

for await (const page of nsm.getAllPendingPages({}, { delayMs: 500 })) {
  pendingItems.push(...page.items);
  console.log(
    `수집 중: ${page.currentPage}/${page.totalPages} 페이지 (누적 ${pendingItems.length}건)`,
  );
}

console.log(`발의 대기 중 법안 ${pendingItems.length}건 수집 완료`);
```

### 국민참여입법센터에서 법안 상세 정보 조회

```typescript
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts();

// 1페이지 목록에서 첫 번째 법안 상세 조회
const items = await nsm.getPage(1);
if (items.length > 0) {
  const detail = await nsm.getDetail(items[0].billNo);
  console.log(detail.title);
  console.log(detail.proposer);
  console.log(detail.proposalDate);
  console.log(detail.session);
  console.log(detail.proposalReason);
  // 첨부파일 목록
  detail.attachments.forEach((att) => {
    console.log(`${att.filename} (ID: ${att.fileId})`);
  });
}
```

### 국민참여입법센터 조건부 검색 (제22대 의원발의 법안)

```typescript
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts();

const result = await nsm.search({
  sugCd: '22',
  endSugCd: '22',
  sgtCls: '900202', // 의원발의
  pageSize: 50,
});

console.log(`제22대 의원발의 법안: ${result.total}건`);
result.items.forEach((item) => {
  console.log(`[${item.progressStatus}] ${item.billName} (${item.proposer})`);
});
```

### 에러 처리

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl({
  timeout: 5000,
  retryCount: 3,
});

try {
  const data = await palCrawl.get();
  console.log('입법예고 데이터:', data);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('요청 타임아웃:', error.message);
  } else {
    console.error('크롤링 실패:', error.message);
  }
}
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](#license) section for details.
