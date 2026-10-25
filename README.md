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
  - [Screenshot (NsmLmSts)](#getnsmlisscreenshotquery--promisebuffer)
- [LikmsCrawler - 국회 의안정보시스템 제안이유 조회](#likmscrawler---국회-의안정보시스템-제안이유-조회)
- [LikmsStateCrawler - 국회 의안정보시스템 계류의안](#likmsstatecrawler---국회-의안정보시스템-계류의안)
  - [LikmsStateCrawler Configuration](#likmsstatecrawler-configuration)
  - [LikmsStateCrawler Types](#likmsstatecrawler-types)
  - [search (LikmsStateCrawler)](#searchquery-ilikmsstatequery--promiseilikmsstatesearchresult)
  - [findCommittees](#findcommitteesagefrom-ageto--promiseilikmscommittee)
  - [getPage (LikmsStateCrawler)](#getpagepageindex-number-query--promiseilikmsstatebillitem)
  - [getAllPages (LikmsStateCrawler)](#getallpagesquery-options--asyncgeneratorilikmsstatesearchresult)
- [LikmsNsmAdapter - NsmLmSts 호환 어댑터](#likmsnsmadapter---nsmlmsts-호환-어댑터)
  - [발의 상태 조회 (`searchPending` / `getAllPendingPages`)](#발의-상태-조회-searchpending--getallpendingpages)
  - [상세 조회 (`INsmDetailCrawler`)](#상세-조회-insmdetailcrawler)
  - [쿼리 매핑](#쿼리-매핑)
- [Examples](#examples)
- [License](#license)

---

## Introduction

국회입법예고(pal.assembly.go.kr) 사이트에서 진행 중인 입법 예고 데이터를 크롤링하는 도구입니다. 입법 예고의 주요 정보를 손쉽게 가져올 수 있습니다.

국민참여입법센터 국회입법현황(opinion.lawmaking.go.kr)에서 법안을 크롤링하는 `NsmLmSts` 클래스도 포함되어 있습니다. 위원회 회부 이전에 발의된 상태로 대기 중인 법안까지 조회할 수 있습니다.

국회 의안정보시스템(likms.assembly.go.kr)의 계류의안 목록을 수집하는 `LikmsStateCrawler`와, 제안이유를 조회하는 `LikmsCrawler`도 포함되어 있습니다. `LikmsStateCrawler`는 `NsmLmSts`의 계류 법안 조회를 대체할 수 있습니다.

---

## Installation

```bash
npm install pal-crawl
```

---

## Configuration

`PalCrawl` 클래스는 생성자에서 선택적 설정 객체를 받을 수 있습니다. `retryCount`는 기존 동작과 같이 최대 요청 시도 횟수를 뜻하며, `0`이면 요청을 한 번 수행하고 재시도하지 않습니다. 음수·소수·무한대 등 유효하지 않은 값은 생성 시 오류로 알립니다.

```typescript
interface PalCrawlConfig {
  userAgent?: string; // 사용자 정의 User-Agent (기본값: Chrome User-Agent)
  timeout?: number; // HTTP 요청 타임아웃 (밀리초, 기본값: 10000)
  retryCount?: number; // Maximum attempts (default: 3; 0 makes one attempt)
  customHeaders?: Record<string, string>; // 사용자 정의 헤더
  screenshot?: ScreenshotOptions; // 헤드리스 크로뮴 스크린샷 옵션
  hydrateTruncatedTitles?: boolean; // 잘린 제목 상세 조회 여부 (기본값: false)
  hydrateProposalReason?: boolean; // 제안이유 빈 값일 때 의안정보시스템 보정 (기본값: true)
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

PAL 상세 페이지에서 `proposalReason`이 비어 있는 의안이 있을 수 있습니다. 이때는 기본값(`hydrateProposalReason: true`)으로 국회 의안정보시스템(likms.assembly.go.kr)의 같은 의안에서 제안이유를 자동으로 보정합니다. 보정에 실패하더라도 기존 결과(`null`)를 그대로 유지하며 오류를 던지지 않습니다.

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
    'BILL_NO' | 'BILL_NAME' | 'CURR_COMMITTEE' | 'OPN_CNT' | 'LGSLT_PA_RG_DT';
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

`NsmLmSts` 클래스는 [국민참여입법센터 국회입법현황](https://opinion.lawmaking.go.kr/gcom/nsmLmSts/out)에서 법안 목록과 상세 정보를 크롤링합니다. 위원회 회부 이전 발의 상태 법안까지 필터링할 수 있는 것이 특징입니다. 목록 검색은 기본적으로 목록 페이지만 요청하며, `...`으로 잘린 제목을 상세 페이지에서 보정하려면 `hydrateTruncatedTitles: true`를 명시해야 합니다. 제목 보정 요청은 순차적으로 실행하며, 실패한 항목의 기존 제목은 유지합니다.

---

### NsmLmSts Configuration

`NsmLmSts` 생성자는 `PalCrawl`과 동일한 네트워크 설정 옵션을 받습니다 (스크린샷 제외).

```typescript
const nsm = new NsmLmSts({
  userAgent: 'My Bot 1.0',
  timeout: 15000,
  retryCount: 3,
  hydrateTruncatedTitles: true,
  customHeaders: { 'Accept-Language': 'ko-KR' },
});
```

---

### NsmLmSts Types

`INsmSearchQuery`는 목록 검색 필터 옵션입니다.

> 제안일자는 **`YYYYMMDD`(8자리)** 로 보내야 한다(실측 2026-10-13: `20260901` → 888건,
> `20260901`~`20260910` → 346건). 하이픈 형식(`2026-09-01`)은 시작일만 주면 5,903건으로
> 범위가 어긋나고, 시작·종료를 함께 주면 0건이 된다.

```typescript
interface INsmSearchQuery {
  pageIndex?: number; // 페이지 번호 (기본값: 1)
  pageSize?: number; // 페이지당 건수 (기본 20, 임의 값 반영)
  sugCd?: string; // 제안대수 시작 (예: "22" → 제22대)
  endSugCd?: string; // 제안대수 끝
  sgtCls?: NsmProposerType; // 발의구분
  cptOfiOrgCd?: string; // 소관부처 코드
  rslRsltNmL?: NsmProgressStatus; // 국회현황 코드
  rslRsltNmR?: NsmResolutionStatus; // 의결현황 코드
  scCptPpostCmt?: string; // 상임위 (예: "법제사법위원회")
  searchStDtNew?: string; // 제안일자 시작 (YYYYMMDD — 하이픈 형식은 범위가 어긋난다)
  searchEdDtNew?: string; // 제안일자 종료 (YYYYMMDD, 시작일과 함께 줄 때만 적용)
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

### getNsmListScreenshot(query?) => Promise\<Buffer>

국회입법현황 목록 페이지의 스크린샷을 `Buffer`로 반환합니다. `screenshot.enabled: true`로 초기화해야 합니다.

### getDetailScreenshot(billNo: string) => Promise\<Buffer>

법안 상세 페이지의 스크린샷을 `Buffer`로 반환합니다.

```typescript
import fs from 'node:fs';
import { NsmLmSts } from 'pal-crawl';

const nsm = new NsmLmSts({ screenshot: { enabled: true, fullPage: true } });

try {
  const items = await nsm.getPage(1);
  const listBuf = await nsm.getNsmListScreenshot();
  fs.writeFileSync('nsm-list.png', listBuf);

  const detailBuf = await nsm.getDetailScreenshot(items[0].billNo);
  fs.writeFileSync('nsm-detail.png', detailBuf);
} finally {
  await nsm.closeBrowser();
}
```

> `takeScreenshot(url)`, `initBrowser()`, `closeBrowser()`, `updateScreenshotConfig()` 메서드는 `PalCrawl`과 공유되는 `ScreenshotBase`에서 상속됩니다.

---

## LikmsCrawler - 국회 의안정보시스템 제안이유 조회

`LikmsCrawler`는 [국회 의안정보시스템](https://likms.assembly.go.kr)의 의안상세 페이지에서 제안이유 및 주요내용을 조회합니다. 의안상세 페이지는 심사정보 탭을 AJAX(POST)로 채우므로, 숨김 폼 파라미터를 추출해 `billInfo.do`에 POST한 뒤 `#prntSummary`에서 제안이유를 파싱합니다.

PAL의 `contentId`(`PRC_...`)가 이 시스템의 `billId`와 동일하므로 그대로 전달할 수 있습니다.

```typescript
import { LikmsCrawler } from 'pal-crawl';

const likms = new LikmsCrawler();

// 제안이유 조회 (실패 시 null, 절대 예외를 던지지 않음)
const reason = await likms.getProposalReason(
  'PRC_G2G6E0D9E2Z3A1Y7Z5X1Y0W4E9E6D5',
);
console.log(reason);

// 파싱만 수행하고 싶은 경우
const fragmentHtml = await likms.getBillInfoHTML(
  likms.parseDetailFormParams(await likms.getDetailPageHTML(billId)),
);
console.log(likms.parseProposalReason(fragmentHtml));
```

`PalCrawl`의 `getContent`/`getDoneContent`는 내부적으로 이 크롤러를 사용해 빈 `proposalReason`을 보정합니다(`hydrateProposalReason: false`로 비활성화 가능).

---

## LikmsStateCrawler - 국회 의안정보시스템 계류의안

`LikmsStateCrawler`는 [국회 의안정보시스템](https://likms.assembly.go.kr)의 **의안현황 > 계류의안** 목록(`mooringBillPage.do`)을 수집합니다. 국민참여입법센터 `NsmLmSts`의 계류 법안 조회를 대체할 수 있도록 `search` / `getPage` / `getAllPages` 구조를 그대로 제공합니다.

이 페이지는 목록을 AJAX(POST)로 채우고 Spring Security CSRF 토큰을 요구합니다. 크롤러는 첫 요청에서 페이지의 `<meta name="_csrf">` 토큰·세션 쿠키와 `#form` 숨김 필드를 확보해 캐시하고, 검색 본문은 그 숨김 필드를 기본값으로 깔고 요청 조건으로 덮어씁니다(브라우저가 폼을 직렬화해 보내는 방식과 동일). 토큰은 `X-CSRF-TOKEN` 헤더로 전송하며, 세션/CSRF 거부(401·403) 시 1회 자동 재발급·재시도합니다.

> 숨김 필드를 함께 보내는 이유: 최소 파라미터만 보내면 서버가 **발의자 필터를 조용히 무시**합니다. 발의자 필터는 **의원 ID**(`representId`) + `representKindCd`를 함께 보내야 실제로 걸립니다(실측 확인). 서버도 크롤러도 **제안자명을 해석하지 않습니다** — 이름만으로는 어느 의원인지 확정할 수 없기 때문입니다. 이름밖에 모를 때는 [`findRepresentCandidates`](#발의자-후보-조회-findrepresentcandidates)로 사이트가 제시하는 후보를 보고 `membId`를 고릅니다.

> 참고: 실측 결과 이 엔드포인트는 현재 CSRF 토큰을 서버에서 검증하지 않습니다(잘못된 토큰이나 헤더 없음도 정상 응답). 크롤러는 브라우저와 동일하게 토큰을 전송하되, 서버가 검증을 켜는 경우에도 동작하도록 세션 재발급 경로를 유지합니다.

```typescript
import { LikmsStateCrawler } from 'pal-crawl';

const crawler = new LikmsStateCrawler();

// 1페이지(50건) 조회
const result = await crawler.search();
console.log(result.total, result.totalPages);
console.log(result.items[0]);
// {
//   billNo: '2221880',
//   billId: 'PRC_EC79D21C54024C16A5D06122914938',   // PAL contentId와 동일
//   billName: '국가재정법 일부개정법률안(장종태의원 등 10인)',
//   proposer: '장종태의원 등 10인',
//   proposerKind: '의원',
//   proposalDate: '2026-10-13',
//   committee: '',
//   progressStatus: '접수',
//   hasProposalReason: true,
//   proposalReason: null,   // hydrateProposalReason 옵션을 켜면 채워진다
//   link: 'https://likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_...'
// }
```

### LikmsStateCrawler Configuration

`PalCrawl`과 동일한 네트워크 옵션을 받습니다.

```typescript
const crawler = new LikmsStateCrawler({
  userAgent: 'Custom Agent',
  timeout: 15000,
  retryCount: 2,
  customHeaders: { 'Accept-Language': 'ko-KR' },
  hydrateProposalReason: true, // 목록의 제안이유를 의안상세에서 채움 (기본 false)
});
```

#### 제안이유 보정 (`hydrateProposalReason`)

목록에는 제안이유 본문이 없고 `hasProposalReason`(팝업 링크 노출)만 알 수 있다. 이 옵션을 켜면 `hasProposalReason`인 법안만 [`LikmsCrawler`](#likmscrawler---국회-의안정보시스템-제안이유-조회)로 의안상세를 조회해 `proposalReason`을 채운다.

- **기본값은 `false`** — 건당 2회(상세 페이지 + `billInfo.do`) 요청이 추가되기 때문이다.
- `hasProposalReason`가 false인 건은 조회하지 않고, 조회·파싱 실패 건은 기존 값(`null`)을 유지하며 예외를 던지지 않는다.
- `search` / `getPage` / `getAllPages` 모두에 적용되며, `getAllPages`는 페이지마다 보정한다.
- 속도는 `hydrateProposalReasons(items, { delayMs, concurrency })`를 직접 호출해 조절한다(기본 `delayMs: 500`, `concurrency: 1` = 순차 지연 요청).

```typescript
const crawler = new LikmsStateCrawler();
const { items } = await crawler.search({ ageFrom: 22, ageTo: 22 });

// 필요한 페이지만 골라서 보정 (입력 배열은 변경되지 않고 복사본이 반환된다)
const hydrated = await crawler.hydrateProposalReasons(items, {
  concurrency: 2,
  delayMs: 300,
});
console.log(hydrated[0].proposalReason);
```

### 발의자 후보 조회 (`findRepresentCandidates`)

likms 검색은 제안자 **이름을 받지 않고 의원 ID(`representId`)만** 받는다. 이름 하나를 ID로 자동 확정하지 않는 이유는 이름이 확정 값을 주지 못하기 때문이다 — 같은 이름이 여러 대수에 있거나 **같은 대수에** 둘 이상일 수 있고(예: 21대 이수진 2인), 한자는 동일인 키가 아니다(22대·17대 김문수 사례). 그래서 이름밖에 없을 때는 사이트가 제시하는 **후보 목록**을 받아 호출부가 고른다.

```typescript
import { LikmsStateCrawler } from 'pal-crawl';

const crawler = new LikmsStateCrawler();

const candidates = await crawler.findRepresentCandidates('이수진');
// [
//   { membId: 'D4L60530', name: '이수진', age: '21대', hanja: '李秀眞', party: '무소속' },
//   { membId: '0R68099X', name: '이수진', age: '21대', hanja: '李壽珍', party: '더불어민주당' },
// ]

const picked = candidates[1]; // 대수·한자명·정당명으로 사람을 가린다
const result = await crawler.search({
  representId: picked.membId, // 후보의 membId = representId
  representKindCd: 'REPR', // 대표발의만 (기본은 '전체' = 대표 + 공동발의)
});
```

- 같은 이름이 **같은 대수에** 둘 이상일 수도 있어(예: 21대 이수진 2인) 대수만으로는 풀리지 않는다 → 정당·한자명이 단서다.
- `ageFrom`/`ageTo`를 주면 그 범위로 좁혀 조회한다(기본 `01`–`99`).
- 명단에 없으면 빈 배열을 반환한다. 이 엔드포인트는 GET이라 CSRF 토큰·세션이 필요 없다(실측: 쿠키 없이 200).
- `LikmsNsmAdapter`에서는 `adapter.likms.findRepresentCandidates(...)`로 쓴다.

```typescript
interface ILikmsRepresentCandidate {
  membId: string; // representId로 그대로 사용
  name: string;
  age: string; // 예: '22대'
  hanja: string;
  party: string;
}
```

### LikmsStateCrawler Types

```typescript
interface ILikmsStateQuery {
  pageIndex?: number;
  pageSize?: number; // 페이지당 건수 (`rows`, 기본 50)
  stateId?: 'mooring' | 'finish' | 'suggest' | 'beforePropose'; // 기본 'mooring'
  stateDtlDivCd?: string; // 탭 구분 (기본 'all')
  billNm?: string; // 의안명
  billNo?: string; // 의안번호
  representKindCd?: 'REPR' | 'SING' | 'COMM' | '전체'; // 발의구분
  representId?: string; // 발의자 의원 ID (representKindCd와 셋트, 기본 '전체')
  // 이름은 받지 않는다 → findRepresentCandidates로 후보를 확인
  ageCmtId?: string; // 소관위원회 코드 (이름밖에 모르면 findCommittees로 확인)
  cmtResultCd?: 'PRC_0000' | 'PRC_0011' | 'PRC_0013' | 'PRC_0014';
  // 소관위 처리결과: 계류/폐기/가결/부결 (NSM 의결현황과 축이 다름)
  jntPrpslYn?: 'Y' | 'N'; // 공동발의 여부
  ageFrom?: string | number; // 제안대수 시작
  ageTo?: string | number; // 제안대수 끝
  billKind?: string; // 의안종류
  listOrd?: string; // 정렬 컬럼
  ordCd?: 'ASC' | 'DESC'; // 정렬 방향
  fromPropDt?: string; // 제안일자 시작 (toPropDt와 함께 줘야 적용)
  toPropDt?: string; // 제안일자 끝
  nmReSchText?: string; // 결과 내 재검색어
}

interface ILikmsStateBillItem {
  billNo: string;
  billId: string; // PRC_... (= PAL contentId)
  billName: string;
  proposer: string;
  proposerKind: string; // 제안자구분: 의원/정부/위원장
  proposalDate: string;
  committee: string;
  progressStatus: string; // 심사진행상태: 접수/위원회 심사 등
  hasProposalReason: boolean; // 목록에 제안이유 링크가 노출되는지
  proposalReason: string | null; // 파서는 null — hydrateProposalReason으로 보정
  link: string;
}

interface ILikmsStateSearchResult {
  total: number;
  totalPages: number;
  currentPage: number;
  items: ILikmsStateBillItem[];
}
```

### search(query?: ILikmsStateQuery) => Promise\<ILikmsStateSearchResult>

```typescript
import { LikmsStateCrawler } from 'pal-crawl';

const crawler = new LikmsStateCrawler();
const result = await crawler.search({
  billNm: '국가재정법',
  ageFrom: 22,
  ageTo: 22,
});
```

### findCommittees(ageFrom?, ageTo?) => Promise\<ILikmsCommittee[]>

대수 범위의 **소관위원회 목록**(코드·이름·정렬순서)을 조회합니다. 검색 파라미터 `ageCmtId`는 이름이 아니라 코드를 받으므로, 이름밖에 모를 때 이 메서드로 확인합니다.

```typescript
const committees = await crawler.findCommittees('22', '22');
// [ { comCd: '1000000', comCdName: '본회의', cdOrd: 1 }, ... { comCd: '9700006', comCdName: '법제사법위원회', cdOrd: 3002 }, ... ]

await crawler.search({ ageCmtId: '9700006', cmtResultCd: 'PRC_0000' }); // 계류 중인 법사위 소관 법안
```

- `ageFrom`/`ageTo`는 **둘 다** 줘야 범위가 적용됩니다(한쪽만 주면 서버가 무시하므로 예외).
- 범위를 주지 않으면 전체 대수를 합친 목록(109건, 실측)을 주며, 이때 같은 이름은 `보건복지위원회(18대~22대)`처럼 대수 꼬리표로 구분됩니다.
- 응답이 JSON이 아니면 빈 배열(예외 없음), 네트워크 오류는 전파합니다.

### findRepresentCandidates(name, ageFrom?, ageTo?) => Promise\<ILikmsRepresentCandidate[]>

발의자 후보(의원 ID + 대수·한자명·정당명)를 팝업 엔드포인트에서 조회합니다. 크롤러가 이름을 ID로 확정하지 않으므로, 이름으로 좁히려면 이 후보에서 `membId`를 골라 `representId`로 넘깁니다. 위 [발의자 후보 조회](#발의자-후보-조회-findrepresentcandidates) 참고.

```typescript
const candidates = await crawler.findRepresentCandidates('주진우');
// [
//   { membId: 'GJK57930', name: '주진우', age: '22대', hanja: '朱晋佑', party: '국민의힘' },
//   { membId: 'IRT9826E', name: '주진우', age: '16대', hanja: '朱鎭旴', party: '한나라당' },
// ]
```

### getPage(pageIndex: number, query?) => Promise\<ILikmsStateBillItem[]>

```typescript
const items = await crawler.getPage(2);
```

### getAllPages(query?, options?) => AsyncGenerator\<ILikmsStateSearchResult>

```typescript
for await (const page of crawler.getAllPages(
  {},
  { maxPages: 3, delayMs: 500 },
)) {
  console.log(page.currentPage, page.items.length);
}
```

### 저수준 API (LikmsStateCrawler)

```typescript
const pageHtml = await crawler.getStatePageHTML(); // CSRF 토큰·세션 확보용
const token = crawler.extractCsrfToken(pageHtml); // <meta name="_csrf">
const fragment = await crawler.getStateListHTML(); // 목록 조각 HTML (AJAX)
const parsed = crawler.parseList(fragment); // 목록 조각 → 객체
```

> 계류의안 목록의 `billId`는 PAL의 `contentId`와 동일하므로, 목록에 제안이유 링크가 있을 때(`hasProposalReason`) `LikmsCrawler.getProposalReason(billId)`로 제안이유를 조회할 수 있습니다.

### 실제 네트워크 통합 테스트 (opt-in)

기본 `npm test`는 PAL·NSM·LIKMS 응답 fixture와 HTTP mock을 사용하며 실사이트를 호출하지 않습니다. HTTP 재시도·응답 중단·인코딩 폴백도 mock 전송 계층에서 검증합니다.

`src/likms.live.test.ts`는 기본적으로 skip되며, 환경변수로만 실행됩니다(토큰 재발급, 페이지 경계, 필터 검증 포함).

```bash
LIKMS_LIVE_TEST=1 npx jest src/likms.live.test.ts
```

### 빌드 산출물 런타임 검증

`scripts/verify-dist.js`는 **dist(tsc 산출물)를 그대로 require**해 export·파서·어댑터 매핑을 검증합니다. 테스트가 `src`(ts-jest)를 돌리는 것과 달리 배포물 자체를 확인하고, jest 없이 한 파일로 끝납니다.

```bash
npm run build
npm run verify:dist        # 네트워크 없이 (export·파서·매핑)
npm run verify:dist:live   # 실제 사이트 3곳까지 호출
```

각 검사는 `[ok]`/`[FAIL]`로 출력되고 실패가 있으면 exit 1로 끝나므로 CI나 수동 점검에 그대로 쓸 수 있습니다.

---

## LikmsNsmAdapter - NsmLmSts 호환 어댑터

`LikmsNsmAdapter`는 `LikmsStateCrawler`를 국민참여입법센터 `NsmLmSts`와 **동일한 목록 조회 인터페이스**로 감싼다. `NsmLmSts`를 쓰던 호출부에서 생성자만 바꾸면 대부분 그대로 동작한다.

> 예외: 제안자명(`scPpsUsr`)은 likms가 이름을 받지 않으므로 **지원하지 않는다**(설정하면 예외). 이름을 ID로 확정하기 위해 사이트를 조회하는 것은 값이 확정되지 않는 추측이므로 어댑터가 하지 않는다 — 필요하면 `adapter.likms.findRepresentCandidates()`로 후보를 골라 `representId`로 조회한다.
>
> 상임위명(`scCptPpostCmt`)은 다르다. 사이트가 확정 값을 주므로(소관위 목록 JSON) 어댑터가 코드로 해석해 `ageCmtId`로 보낸다. 대수 범위(`sugCd`/`endSugCd`) 안에서 찾고, 이름이 목록에 없거나 같은 이름이 여러 코드면 예외를 던진다.

```typescript
// 기존: import { NsmLmSts } from 'pal-crawl'; const crawler = new NsmLmSts();
import { LikmsNsmAdapter } from 'pal-crawl';

const crawler = new LikmsNsmAdapter();

const result = await crawler.search({
  pageIndex: 1,
  pageSize: 10,
  sugCd: '22',
  endSugCd: '22',
});
const items = await crawler.getPage(2);
for await (const page of crawler.getAllPages({}, { maxPages: 3 })) {
  console.log(page.currentPage, page.items.length);
}

// 제안자명(`scPpsUsr`)은 미지원 — likms가 이름을 받지 않으므로 예외를 던진다.
// 후보를 골라 ID로 조회하려면 `adapter.likms`를 직접 쓴다(후보는 사이트가 제시하는 값).
const candidates = await crawler.likms.findRepresentCandidates('문진석');
const byMember = await crawler.likms.search({
  representId: candidates[0].membId,
  representKindCd: 'REPR',
});
```

`INsmListCrawler` 포트를 `NsmLmSts`와 `LikmsNsmAdapter`가 모두 만족하므로, 두 구현을 같은 변수 타입으로 다룰 수 있다.

```typescript
import { NsmLmSts, LikmsNsmAdapter, type INsmListCrawler } from 'pal-crawl';

const crawler: INsmListCrawler = useLikms
  ? new LikmsNsmAdapter()
  : new NsmLmSts();
```

### 발의 상태 조회 (`searchPending` / `getAllPendingPages`)

`NsmLmSts`의 `searchPending`(서버에서 `rslRsltNmL=900101` '발의'로 필터)에 대응하는 대안이다.

likms에는 심사진행상태를 좁히는 **유효한 서버 필터가 없다** — 파라미터 `srngPrgrsSttsCd`는
존재하고 서버가 실제로 조건을 걸지만(알 수 없는 값이면 0건), 사이트가 값 목록을 렌더하지 않아
코드를 얻을 수 없었다(실측: 상세 페이지의 `RECEIVE`/`CMT`/`EXAM`/`MAIN`/`GOVTRANS`/`DCS`, `PRC_`·`PSC_` 계열,
숫자, 한글 라벨 모두 0건). 그래서 목록을 앞에서부터 스캔하며 `progressStatus === '접수'`인
항목만 걸러낸다.

```typescript
import { LikmsNsmAdapter } from 'pal-crawl';

const crawler = new LikmsNsmAdapter();

// 접수가 나올 때까지 순차 스캔 (기본 10페이지 · 페이지당 100건)
const pending = await crawler.searchPending({}, { maxPages: 5, delayMs: 500 });
console.log(pending.items.map((item) => item.billNo));

// 전부 순회
for await (const page of crawler.getAllPendingPages({}, { maxPages: 10 })) {
  console.log(page.items.length);
}
```

주의할 점:

- **스캔 비용**이 든다(서버 필터 없음). `delayMs`·`maxPages`로 범위를 조절하고, 찾지 못하면 빈 결과를 받는다.
- 접수 건이 없는 페이지는 건너뛰므로 `currentPage`는 원본 페이지 번호가 아니고, `pageIndex`로 건너뛸 수 없다.
- `items`는 접수 항목만이지만 `total`/`totalPages`는 **전체(접수 포함) 기준** 원본 값이다.
- `progressStatus`는 likms 어휘 `'접수'`이며 NSM의 `'발의'`와 문자열이 다르다.
- 실측 대조: likms `접수` 14건 중 12건이 NSM `발의` 조회에 포함되어 같은 부분집합임을 확인했다.

저수준 API(`LikmsStateCrawler.filterPending` / `getAllPendingPages` / `searchPending`)도 같은 동작을 제공한다.

### 상세 조회 (`INsmDetailCrawler`)

`getDetailHTML` / `parseDetail` / `getDetail`도 같은 포트(`INsmDetailCrawler`)로 교체할 수 있다.

```typescript
import { NsmLmSts, LikmsNsmAdapter, type INsmDetailCrawler } from 'pal-crawl';

const crawler: INsmDetailCrawler = useLikms
  ? new LikmsNsmAdapter()
  : new NsmLmSts();

// 의안번호(2221883)는 likms의 billId(PRC_...)로 자동 해석된다.
const detail = await crawler.getDetail('2221883');
console.log(detail.title, detail.proposalReason, detail.attachments);

// 저장해 둔 HTML을 오프라인으로 파싱 (네트워크 호출 없음)
const offline = crawler.parseDetail(savedHtml);
```

likms 의안상세는 응답이 둘로 나뉜다(제목은 상세 페이지, 발의정보·제안이유는 심사정보 탭 AJAX).
어댑터의 `getDetail`은 두 요청을 합쳐 채우고, `parseDetail`은 넘긴 HTML에 들어 있는 값만 채운다.

| 항목                   | NsmLmSts                   | LikmsNsmAdapter                                                |
| ---------------------- | -------------------------- | -------------------------------------------------------------- |
| 인자                   | 의안번호(`2219088`)        | 의안번호(`2221883`) 또는 billId(`PRC_...`)                     |
| `proposalInfo`         | 발의정보 원문 한 줄        | 접수정보로 조합한 문자열 (`제안자, 제N호(제안일자). 제안회기`) |
| `proposalDate`         | `2026. 5. 1.`              | `2026-10-13`                                                   |
| `session`              | `제435회 국회(임시회)`     | `제22대(2024~2028)제439회`                                     |
| `attachments[].fileId` | 숫자 ID(`fnDownload` 인자) | 다운로드 URL                                                   |

없는 의안번호면 `Error('bill not found: ...')`를 던진다(`NsmLmSts`는 빈 상세를 반환).
`LikmsDetailParser`가 상세 페이지 HTML과 심사정보 조각 HTML을 모두 받아 파싱한다.

### 쿼리 매핑

| INsmSearchQuery                   | ILikmsStateQuery                   | 비고                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pageIndex`                       | `pageIndex`                        |                                                                                                                                                                                                      |
| `pageSize`                        | `pageSize`(`rows`)                 | 양쪽 다 임의 값 반영(실측). 기본값만 다르다 — NSM 20건 ↔ likms 50건                                                                                                                                  |
| `sugCd` / `endSugCd`              | `ageFrom` / `ageTo`                | 제안대수                                                                                                                                                                                             |
| `sgtCls`                          | `proposerKind`                     | 900201→GOV, 900202→MEMASEMBY, 900203→CHRPR                                                                                                                                                           |
| `scCptPpostCmt`                   | `ageCmtId`                         | 상임위 **이름**을 `/bi/bill/sch/findAgeCmt.do` 목록에서 코드로 해석(꼬리표·공백 무시). 대수 범위는 `sugCd`/`endSugCd`를 따른다 — 이름이 없거나 여러 코드면 예외                                      |
| `scPpsUsr`                        | — (미지원)                         | 제안자명 — likms는 이름을 받지 않아 옮길 수 없다. 지정하면 예외를 던진다(조용히 무시하면 필터가 빠진 전체 결과가 나옴). `adapter.likms.findRepresentCandidates()`로 후보를 골라 `representId`로 조회 |
| `searchStDtNew` / `searchEdDtNew` | `fromPropDt` / `toPropDt`          | 제안일자 — likms는 **양쪽 모두** 줘야 서버가 적용(한쪽만이면 전체). NSM은 `YYYYMMDD`여야 하므로(`YYYY-MM-DD` 양쪽 → 0건) 형식을 그대로 옮기면 필터가 사라진다                                        |
| `sortOrder`                       | `ordCd`                            | ASC/DESC                                                                                                                                                                                             |
| `scBlNmSct`                       | `billNo`(숫자) 또는 `billNm`(문자) | 값 형태로 판별                                                                                                                                                                                       |

동일 축이 없어 무시되는 필드: `rslRsltNmL`, `rslRsltNmR`, `cptOfiOrgCd`, `sortCol`, `issLawitmYn`, `stDt`/`edDt`.

NSM 쪽에 대응 필드가 없는 likms 전용 축은 `adapter.likms.search()`로 직접 지정한다: `cmtResultCd`(소관위 처리결과), `jntPrpslYn`(공동발의 여부), `stateDtlDivCd`(탭), `nmReSchText`(결과 내 재검색).

`searchPending`/`getAllPendingPages`는 포트에 포함하지 않는다. `NsmLmSts`는 서버 필터로 좁히지만 likms는 전체를 스캔해야 해서 같은 이름 뒤에 비용 차이를 숨기지 않기 위해서다. 호출부가 명시적으로 고를 수 있도록 `LikmsNsmAdapter`가 같은 이름의 **스캔 기반 대안**을 제공한다(위 “발의 상태 조회” 절 참조). 스캔이라 `options.maxPages`(기본 10) 밖에서만 접수 항목이 나오면 빈 결과를 주고, NSM과 달리 `progressStatus === '접수'` 항목이 없는 페이지는 건너뛰므로 `currentPage`도 원본 페이지 번호가 아니다. 계류의안 전용 API(`hasProposalReason`, `billId`, `clearSession` 등)가 필요하면 `adapter.likms`(`LikmsStateCrawler`)를 직접 사용한다.

### NsmLmSts에서 교체할 때 (호환성 감사 요약)

생성자만 바꾸면 되는 범위는 **목록 조회와 상세 조회**다.

| `NsmLmSts` 멤버                                                                                                          | 교체 결과                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `getListHTML`, `parseList`, `search`, `getPage`, `getAllPages`                                                           | 그대로 동작(시그니처·결과 필드 동일)                                                                                    |
| `getDetailHTML`, `parseDetail`, `getDetail`                                                                              | 그대로 동작 — `INsmDetailCrawler` 포트. 값 형식은 다르다(위 표 참고)                                                    |
| `searchPending`, `getAllPendingPages`                                                                                    | 스캔 기반 대안 제공 — 서버 필터가 없어 `progressStatus === '접수'`로 걸러낸다. 포트에는 없다(비용 차이를 드러내기 위해) |
| `getNsmListScreenshot`, `getDetailScreenshot`, `initBrowser`, `closeBrowser`, `takeScreenshot`, `updateScreenshotConfig` | 없음 — 어댑터는 스크린샷 기반(`ScreenshotBase`)을 상속하지 않는다                                                       |

수정 없이 컴파일되지만 **결과·비용을 확인해야 하는 것** (실측 2026-10-13):

- 무시되는 필터: `rslRsltNmL`, `rslRsltNmR`, `cptOfiOrgCd`, `sortCol`, `issLawitmYn`, `stDt`/`edDt`
- `progressStatus` 어휘가 다름(NSM `발의`/`위원회 회부` ↔ likms `접수`/`소관위접수`/`소관위심사`/`소관위상정`/`본회의부의안건` — 실측)
- `billName`에 발의자 괄호가 포함되고, `link`는 다른 호스트·경로 체계다
- `ministry`/`progressDate`/`resolutionStatus`/`resolutionDate`는 빈 문자열
- 기본 페이지 크기가 다르므로(20건 ↔ 50건) 페이지당 건수에 의존하면 `pageSize`를 명시한다
- 총계가 다르다: 같은 조건에서 likms 15,950건 vs NSM 21,336건(실측) — `total`/페이지 수를 두 구현 사이에서 비교하면 안 된다
- 제안일자 형식이 다르다: NSM은 `YYYYMMDD`(ISO로 주면 0건), likms는 `YYYY-MM-DD`이고 양쪽을 다 줘야 적용된다
- `hydrateProposalReason`를 켠 채 어댑터를 쓰면 목록 조회마다 상세 요청이 붙는다(3건 실측 10.9s vs 2.1s) — 그 값은 `INsmBillItem`에 담기지 않는다

> 결과의 `ministry`/`progressDate`/`resolutionStatus`/`resolutionDate`는 계류의안 목록에 없는 값이라 빈 문자열로 채워진다.

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
