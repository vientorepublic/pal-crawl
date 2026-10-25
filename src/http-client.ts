import * as https from 'https';
import { URL } from 'url';
import iconv from 'iconv-lite';

export interface HttpClientConfig {
  userAgent: string;
  timeout: number;
  retryCount: number;
  customHeaders: Record<string, string>;
}

export class HttpClient {
  private userAgent: string;
  private timeout: number;
  private retryCount: number;
  private customHeaders: Record<string, string>;
  /** 응답의 Set-Cookie를 세션 동안 유지하기 위한 간단한 쿠키 저장소 */
  private readonly cookies: Map<string, string> = new Map();

  constructor(config: HttpClientConfig) {
    if (!Number.isInteger(config.retryCount) || config.retryCount < 0) {
      throw new Error('retryCount must be a non-negative integer');
    }
    this.userAgent = config.userAgent;
    this.timeout = config.timeout;
    this.retryCount = config.retryCount;
    this.customHeaders = config.customHeaders;
  }

  private buildCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  /**
   * Set-Cookie 헤더를 쿠키 저장소에 반영합니다.
   * 세션 쿠키(JSESSIONID 등)가 필요한 사이트(계류의안 AJAX 등)에서 사용합니다.
   */
  private storeCookies(setCookie: string[] | undefined): void {
    if (!setCookie) {
      return;
    }
    for (const raw of setCookie) {
      const pair = raw.split(';')[0].trim();
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (value === '') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  private extractCharset(
    contentType: string | string[] | undefined,
    body: Buffer,
  ): string {
    const contentTypeValue = Array.isArray(contentType)
      ? contentType.join(';')
      : (contentType ?? '');

    const headerMatch = contentTypeValue.match(/charset\s*=\s*([^;\s]+)/i);
    if (headerMatch?.[1]) {
      return headerMatch[1].trim().toLowerCase();
    }

    const head = body.subarray(0, 4096).toString('ascii');
    const metaMatch = head.match(/<meta[^>]+charset=["']?([a-zA-Z0-9_-]+)/i);
    if (metaMatch?.[1]) {
      return metaMatch[1].trim().toLowerCase();
    }

    return 'utf-8';
  }

  private normalizeCharset(charset: string): string {
    if (charset === 'ks_c_5601-1987' || charset === 'x-windows-949') {
      return 'cp949';
    }
    if (charset === 'euc_kr') {
      return 'euc-kr';
    }
    return charset;
  }

  private decodeBody(
    body: Buffer,
    contentType: string | string[] | undefined,
  ): string {
    const detected = this.normalizeCharset(
      this.extractCharset(contentType, body),
    );

    if (detected === 'utf-8' || detected === 'utf8') {
      const utf8Text = body.toString('utf8');

      // Some pages are served in legacy Korean encodings despite utf-8 hints.
      // If replacement characters appear, try Korean legacy decoders and prefer cleaner output.
      if (utf8Text.includes('�')) {
        const fallbackEncodings = ['cp949', 'euc-kr'];
        let bestText = utf8Text;
        let bestScore = (utf8Text.match(/�/g) ?? []).length;

        for (const encoding of fallbackEncodings) {
          if (!iconv.encodingExists(encoding)) {
            continue;
          }

          const candidate = iconv.decode(body, encoding);
          const score = (candidate.match(/�/g) ?? []).length;
          if (score < bestScore) {
            bestText = candidate;
            bestScore = score;
          }
        }

        return bestText;
      }

      return utf8Text;
    }

    if (iconv.encodingExists(detected)) {
      return iconv.decode(body, detected);
    }

    return body.toString('utf8');
  }

  private async makeRequest(
    url: URL,
    method: 'GET' | 'POST' = 'GET',
    body?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'User-Agent': this.userAgent,
        ...this.customHeaders,
        ...extraHeaders,
      };

      const cookieHeader = this.buildCookieHeader();
      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      }

      if (method === 'POST' && body !== undefined) {
        headers['Content-Type'] =
          'application/x-www-form-urlencoded; charset=UTF-8';
        headers['Content-Length'] = String(Buffer.byteLength(body));
      }

      const options = {
        headers,
        timeout: this.timeout,
        method,
      };

      const req = https.request(url, options, (res) => {
        res.on('error', reject);
        res.on('aborted', () => reject(new Error('Response aborted')));
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          // Drain rejected responses so the connection can be released.
          res.resume();
          reject(
            new Error(
              `Invalid response: ${res.statusCode} ${res.statusMessage}`,
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on('end', () => {
          this.storeCookies(res.headers['set-cookie']);
          const responseBody = Buffer.concat(chunks);
          resolve(this.decodeBody(responseBody, res.headers['content-type']));
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (method === 'POST' && body !== undefined) {
        req.write(body);
      }

      req.end();
      req.setTimeout(this.timeout);
    });
  }

  public async get(
    url: URL,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.requestWithRetry(url, 'GET', undefined, headers);
  }

  /**
   * URL-encoded 본문을 POST로 전송합니다.
   * 국회 의안정보시스템의 일부 조각(_fragment) 엔드포인트는 GET이 아닌 POST만 허용합니다.
   */
  public async post(
    url: URL,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.requestWithRetry(url, 'POST', body, headers);
  }

  private async requestWithRetry(
    url: URL,
    method: 'GET' | 'POST',
    body?: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    // Keep positive retryCount values compatible with the existing attempt limit.
    const maxAttempts = Math.max(1, this.retryCount);
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.makeRequest(url, method, body, headers);
      } catch (error) {
        if (attempt >= maxAttempts) {
          throw error instanceof Error ? error : new Error(String(error));
        }
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
