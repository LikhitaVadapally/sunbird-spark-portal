import type { UseQueryResult } from '@tanstack/react-query';

export interface QuerySlice<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * `combine` for `useQueries`. Without one, `useQueries` returns a new array on every render, so
 * every memo keyed on it recomputes every render. Passed as a stable (module-level) function, the
 * combined result only changes when a query's data or status does.
 */
export function toQuerySlices<T>(results: Array<UseQueryResult<T>>): Array<QuerySlice<T>> {
  return results.map((r) => ({ data: r.data, isLoading: r.isLoading, isError: r.isError }));
}
