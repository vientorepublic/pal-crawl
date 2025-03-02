# 국회 입법예고 크롤러

[![License](https://img.shields.io/badge/License-MIT-blue)](#license)
[![stars - pal-crawl](https://img.shields.io/github/stars/vientorepublic/pal-crawl?style=social)](https://github.com/vientorepublic/pal-crawl)
[![forks - pal-crawl](https://img.shields.io/github/forks/vientorepublic/pal-crawl?style=social)](https://github.com/vientorepublic/pal-crawl)

<img width="1312" alt="Screenshot" src="https://github.com/user-attachments/assets/2e243915-6d9c-470b-9510-27ef5546ab61" />

국회입법예고(pal.assembly.go.kr)의 진행 중인 입법 예고 크롤러

## Methods

### get: () => Promise<ITableData[]>

```javascript
import { PalCrawl } from 'pal-crawl';

const palCrawl = new PalCrawl();
const table = await palCrawl.get();

console.log(table);
```

```typescript
interface ITableData {
  num: number; // 의안번호
  subject: string; // 입법예고 제목
  proposerCategory: string; // 제안자 구분
  committee: string; // 소관 위원회
  numComments: number; // 의견 수
  link: string; // 전문 보기 링크
}
```

## License

MIT
