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

  constructor(config: HttpClientConfig) {
    this.userAgent = config.userAgent;
    this.timeout = config.timeout;
    this.retryCount = config.retryCount;
    this.customHeaders = config.customHeaders;
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

  private async makeRequest(url: URL): Promise<string> {
    return new Promise((resolve, reject) => {
      const headers = {
        'User-Agent': this.userAgent,
        ...this.customHeaders,
      };

      const options = {
        headers,
        timeout: this.timeout,
      };

      const req = https.get(url, options, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
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
          const body = Buffer.concat(chunks);
          resolve(this.decodeBody(body, res.headers['content-type']));
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(this.timeout);
    });
  }

  public async get(url: URL): Promise<string> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        return await this.makeRequest(url);
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryCount) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}
