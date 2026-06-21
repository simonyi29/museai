import { requestUrl } from 'obsidian';

export interface InspirationHttpResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
}

export interface InspirationHttpClient {
  request(url: string, options?: { headers?: Record<string, string> }): Promise<InspirationHttpResponse>;
}

export const obsidianHttpClient: InspirationHttpClient = {
  async request(url, options) {
    const response = await requestUrl({
      url,
      method: 'GET',
      headers: options?.headers,
    });

    return {
      status: response.status,
      headers: response.headers ?? {},
      text: response.text ?? '',
    };
  },
};

export function isSuccessfulStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export function getResponseHeader(response: InspirationHttpResponse, name: string): string | null {
  const normalizedName = name.toLowerCase();
  for (const [headerName, value] of Object.entries(response.headers)) {
    if (headerName.toLowerCase() === normalizedName) {
      return value;
    }
  }
  return null;
}
