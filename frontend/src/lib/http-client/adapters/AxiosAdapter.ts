import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { BaseClient } from '../BaseClient';
import { ApiResponse, HeaderOperation, HttpClientConfig } from '../types';
import _ from 'lodash';

export class AxiosAdapter extends BaseClient {
  private client: AxiosInstance;

  constructor(config: HttpClientConfig) {
    super(config);
    // Combine baseURL and apiPrefix.
    // If baseURL is provided, it's the host. apiPrefix is the path.
    // If baseURL is empty/undefined, we just use apiPrefix as the baseURL for relative requests.
    const prefix = config.apiPrefix ?? '/portal';
    const baseURL = config.baseURL ? `${config.baseURL}${prefix}` : prefix;

    this.client = axios.create({
      baseURL,
      headers: config.defaultHeaders,
    });
  }

  private mapResponse<T>(axiosResponse: AxiosResponse<T>): ApiResponse<T> {
    const result = _.get(axiosResponse.data, 'result');
    // If result exists and is not null/undefined, return result. Otherwise return full data.
    const data = !_.isNil(result) ? result : axiosResponse.data;

    return {
      data: data as T,
      status: axiosResponse.status,
      headers: axiosResponse.headers as Record<string, any>,
    };
  }

  private async request<T>(requestFn: () => Promise<AxiosResponse<T>>): Promise<ApiResponse<T>> {
    try {
      const response = await requestFn();
      return this.mapResponse(response);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        if (status >= 400) {
          if (status === 401 || status === 403) {
            this.onResponse(this.mapResponse(error.response as AxiosResponse<T>));
          }
          const body = error.response.data as Record<string, unknown> | undefined;
          const params = body?.params as Record<string, unknown> | undefined;
          const errmsg = typeof params?.errmsg === 'string' ? params.errmsg : error.message || `Request failed (${status})`;
          // `errCode` and `result` carry the Sunbird envelope's params.err and result through, for
          // APIs that answer a 4xx with a structured body the caller must render (e.g. the
          // competency framework term validate/commit, whose rows[] explain what failed).
          const err = new Error(errmsg) as Error & { status: number; errCode?: string; result?: unknown };
          err.status = status;
          if (typeof params?.err === 'string') err.errCode = params.err;
          if (!_.isNil(body?.result)) err.result = body?.result;
          throw err;
        }
        return this.mapResponse(error.response as AxiosResponse<T>);
      }
      throw error;
    }
  }

  protected async _get<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request(() => this.client.get<T>(url, { headers }));
  }

  protected async _post<T>(url: string, data: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request(() => this.client.post<T>(url, data, { headers }));
  }

  protected async _put<T>(url: string, data: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request(() => this.client.put<T>(url, data, { headers }));
  }

  protected async _patch<T>(url: string, data: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request(() => this.client.patch<T>(url, data, { headers }));
  }

  protected async _delete<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request(() => this.client.delete<T>(url, { headers, data }));
  }

  public updateHeaders(headers: HeaderOperation[]): void {
    _.forEach(headers, ({ key, value, action }) => {
      if (action === 'add') {
        if (value) {
          _.set(this.client.defaults.headers.common, key, value);
        }
      } else if (action === 'remove') {
        _.unset(this.client.defaults.headers.common, key);
      }
    });
  }
}
