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
  - [get](#get)
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
  attachments: IAttachment; // 법률안 전문 첨부파일 URL 객체
}
```

`IAttachment`는 입법 예고의 법률안 전문 첨부파일 URL을 나타내는 인터페이스입니다.

pdf와 hwp 파일 다운로드 링크 추출을 지원합니다.

```typescript
interface IAttachment {
  pdfFile: string;
  hwpFile: string;
}
```

---

## Methods

### get() => Promise<ITableData[]>

`get` 메서드는 진행 중인 입법 예고 데이터를 가져옵니다.

```typescript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const table = await palCrawl.get();

console.log(table);
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
