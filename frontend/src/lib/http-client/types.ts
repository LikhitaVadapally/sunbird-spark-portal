export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, unknown>;
}

export type StatusHandlerConfig = Record<number, (res: ApiResponse<unknown>) => void>;

export interface HttpClientConfig {
  baseURL?: string;
  apiPrefix?: string;
  defaultHeaders?: Record<string, string>;
  statusHandlers?: StatusHandlerConfig;
}

export type HeaderAction = 'add' | 'remove';

export interface HeaderOperation {
  key: string;
  value?: string;
  action: HeaderAction;
}

export interface IHttpClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>>;
  post<T>(url: string, data: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>>;
  put<T>(url: string, data: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>>;
  patch<T>(url: string, data: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>>;
  delete<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>>;

  updateHeaders(headers: HeaderOperation[]): void;
}

/**
 * Error the client throws for a 4xx/5xx. `errCode` and `result` carry the Sunbird envelope's
 * params.err and result through, for APIs that answer a 4xx with a structured body the caller
 * must render (e.g. the competency framework term validate/commit, whose rows[] explain what failed).
 */
export type HttpError = Error & { status: number; errCode?: string; result?: unknown };
