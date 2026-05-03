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
  - [search / searchDone](#searchquery-isearchquery--promiseisearchresult)
  - [getPage / getDonePage](#getpagepageindex-number-pageunit-number--promiseitable-data)
  - [getAllPages / getAllDonePages](#getallpagesquery-isearchquery-options-ibulkoptions--asyncgeneratorisearchresult)
- [Examples](#examples)
- [License](#license)

---

## Introduction

국회입법예고(pal.assembly.go.kr) 사이트에서 진행 중인 입법 예고 데이터를 크롤링하는 도구입니다. 입법 예고의 주요 정보를 손쉽게 가져올 수 있습니다.

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
}
```

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
