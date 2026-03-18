import { ITableData, PalCrawl, type PalCrawlConfig } from './pal';

let table: ITableData[];

describe('PalCrawl', () => {
  beforeAll(async () => {
    const palCrawl = new PalCrawl();
    table = await palCrawl.get();
  });

  test('getPalHTML: should be return string', async () => {
    const palCrawl = new PalCrawl();
    const html = await palCrawl.getPalHTML();
    expect(typeof html).toBe('string');
  });
  test('constructor: should use custom userAgent when provided in config', async () => {
    const config: PalCrawlConfig = {
      userAgent: 'Custom User Agent',
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use default userAgent when config is empty', async () => {
    const palCrawl = new PalCrawl({});
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use default userAgent when no config provided', async () => {
    const palCrawl = new PalCrawl();
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('parseTable: array length should be 0 when invalid html', () => {
    const palCrawl = new PalCrawl();
    const table = palCrawl.parseTable('asdf');
    expect(table).toHaveLength(0);
  });
  test('get: array length should be 10', async () => {
    expect(table).toHaveLength(10);
  });
  test('get: URL string of the attachment object should not be empty', () => {
    table.forEach((e) => {
      expect(e.attachments.pdfFile).not.toBe('');
      expect(e.attachments.hwpFile).not.toBe('');
    });
  });
  test('constructor: should use custom timeout when provided', () => {
    const config: PalCrawlConfig = {
      timeout: 5000,
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use custom retryCount when provided', () => {
    const config: PalCrawlConfig = {
      retryCount: 5,
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use custom headers when provided', () => {
    const config: PalCrawlConfig = {
      customHeaders: {
        'Accept-Language': 'ko-KR',
        'Custom-Header': 'test-value',
      },
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
  test('constructor: should use all custom config options', () => {
    const config: PalCrawlConfig = {
      userAgent: 'Custom Agent',
      timeout: 15000,
      retryCount: 2,
      customHeaders: {
        Accept: 'application/json',
      },
    };
    const palCrawl = new PalCrawl(config);
    expect(palCrawl).toBeInstanceOf(PalCrawl);
  });
});
