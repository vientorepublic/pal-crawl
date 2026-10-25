import { EventEmitter } from 'events';
import type { IncomingHttpHeaders } from 'http';
import type { RequestOptions } from 'https';
import { URL } from 'url';
import iconv from 'iconv-lite';
import { HttpClient } from './http-client';

class MockResponse extends EventEmitter {
  public statusCode = 200;
  public statusMessage = 'OK';
  public headers: IncomingHttpHeaders = {};
  public resume = jest.fn();
}

class MockRequest extends EventEmitter {
  public write = jest.fn();
  public end = jest.fn();
  public destroy = jest.fn();
  public setTimeout = jest.fn();
}

const mockRequest = new MockRequest();
const mockResponse = new MockResponse();
const mockHandleRequest = jest.fn<
  MockRequest,
  [URL, RequestOptions, (response: MockResponse) => void]
>();

jest.mock('https', () => ({
  request: (
    url: URL,
    options: RequestOptions,
    callback: (response: MockResponse) => void,
  ): MockRequest => mockHandleRequest(url, options, callback),
}));

const createClient = (retryCount = 1): HttpClient =>
  new HttpClient({
    userAgent: 'test-agent',
    timeout: 100,
    retryCount,
    customHeaders: {},
  });

const TEST_URL = new URL('https://example.com/bill');

describe('HttpClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.removeAllListeners();
    mockResponse.removeAllListeners();
    mockResponse.statusCode = 200;
    mockResponse.statusMessage = 'OK';
    mockResponse.headers = {};
    mockHandleRequest.mockImplementation((_url, _options, callback) => {
      callback(mockResponse);
      return mockRequest;
    });
    mockRequest.end.mockImplementation(() => {
      mockResponse.emit('data', Buffer.from('response'));
      mockResponse.emit('end');
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('makes one request when retries are disabled', async () => {
    await expect(createClient(0).get(TEST_URL)).resolves.toBe('response');
    expect(mockHandleRequest).toHaveBeenCalledTimes(1);
  });

  test('rejects with an Error when a request throws a non-Error value', async () => {
    mockHandleRequest.mockImplementation(() => {
      throw 'connection failed';
    });
    await expect(createClient().get(TEST_URL)).rejects.toThrow(
      'connection failed',
    );
  });

  test('preserves the final transport error after bounded retries', async () => {
    jest.useFakeTimers();
    const error = new Error('connection failed');
    mockHandleRequest.mockImplementation(() => {
      throw error;
    });
    const result = expect(createClient(3).get(TEST_URL)).rejects.toBe(error);
    await jest.runAllTimersAsync();
    await result;
    expect(mockHandleRequest).toHaveBeenCalledTimes(3);
  });

  test.each([-1, 1.5, NaN, Infinity])(
    'rejects invalid retry count %s before making a request',
    (retryCount) => {
      expect(() => createClient(retryCount)).toThrow('retryCount');
      expect(mockHandleRequest).not.toHaveBeenCalled();
    },
  );

  test('rejects response stream errors instead of leaving the request pending', async () => {
    const error = new Error('response stream failed');
    mockRequest.end.mockImplementation(() => {
      mockResponse.emit('error', error);
    });
    await expect(createClient().get(TEST_URL)).rejects.toBe(error);
  });

  test('rejects an aborted response instead of returning partial HTML', async () => {
    mockRequest.end.mockImplementation(() => {
      mockResponse.emit('data', Buffer.from('partial'));
      mockResponse.emit('aborted');
      mockResponse.emit('end');
    });
    await expect(createClient().get(TEST_URL)).rejects.toThrow('aborted');
  });

  test('drains rejected HTTP responses and reports the status', async () => {
    mockResponse.statusCode = 503;
    mockResponse.statusMessage = 'Service Unavailable';
    await expect(createClient().get(TEST_URL)).rejects.toThrow(
      'Invalid response: 503 Service Unavailable',
    );
    expect(mockResponse.resume).toHaveBeenCalledTimes(1);
  });

  test('rejects request errors and destroys timed-out requests', async () => {
    mockRequest.end.mockImplementation(() => {
      mockRequest.emit('timeout');
    });
    await expect(createClient().get(TEST_URL)).rejects.toThrow(
      'Request timeout after 100ms',
    );
    expect(mockRequest.destroy).toHaveBeenCalledTimes(1);
  });

  test('preserves the Korean encoding fallback for misdeclared UTF-8', async () => {
    mockResponse.headers['content-type'] = 'text/html; charset=utf-8';
    mockRequest.end.mockImplementation(() => {
      mockResponse.emit('data', iconv.encode('입법예고', 'cp949'));
      mockResponse.emit('end');
    });
    await expect(createClient().get(TEST_URL)).resolves.toBe('입법예고');
  });

  test('persists session cookies for subsequent form requests', async () => {
    const client = createClient();
    mockResponse.headers['set-cookie'] = ['JSESSIONID=example; Path=/'];
    await client.get(TEST_URL);
    await client.post(TEST_URL, 'billNo=123');
    expect(mockHandleRequest.mock.calls[1][1].headers).toMatchObject({
      Cookie: 'JSESSIONID=example',
      'Content-Length': '10',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    });
    expect(mockRequest.write).toHaveBeenCalledWith('billNo=123');
  });
});
