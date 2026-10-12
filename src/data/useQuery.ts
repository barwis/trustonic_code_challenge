import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as cache from './cache';
import { formatError, mergeVariables, type GraphQLError } from './transport';

export type UseQueryResult<TData, TVars> = {
  loading: boolean;
  errors: string[];
  data: TData | undefined;
  refetch: (variables?: TVars, replace?: boolean) => Promise<void>;
  reset: (queryKey?: string) => void;
};

export type UseQueryOptions<TVars> = {
  variables?: TVars;
  fetchFirst?: boolean; // when true, fire on mount and on variable change
  queryKey?: string; // stable handle for cancellation / invalidation
};

const NO_ERRORS: GraphQLError[] = [];

type Override<TVars> = {
  baseKey: string;
  variables: TVars | undefined;
  replace: boolean;
};

function effectiveVars<TVars>(
  base: TVars | undefined,
  override: Override<TVars> | null,
  baseKey: string,
): TVars | undefined {
  if (!override || override.baseKey !== baseKey) return base;
  return mergeVariables(base, override.variables, override.replace);
}

// The contract leaves TVars unconstrained; the cache needs a record to key and match on.
function toCacheVariables<TVars>(vars: TVars | undefined): cache.Variables {
  return (vars ?? {}) as cache.Variables;
}

export function useQuery<TData, TVars>(query: string, options: UseQueryOptions<TVars>): UseQueryResult<TData, TVars> {
  const { fetchFirst = false } = options;
  const queryKey = options.queryKey ?? cache.operationName(query);

  const baseKey = cache.stableStringify(options.variables ?? {});
  const baseVars = useMemo(() => options.variables, [baseKey]); // eslint-disable-line react-hooks/exhaustive-deps -- compare variables by value, not identity

  const [override, setOverride] = useState<Override<TVars> | null>(null);
  const [refetched, setRefetched] = useState(false);
  const [resetKey, setResetKey] = useState<string | null>(null);

  const variables = useMemo(
    () => toCacheVariables(effectiveVars(baseVars, override, baseKey)),
    [baseVars, override, baseKey],
  );
  const key = cache.cacheKey(query, queryKey, variables);
  const active = (fetchFirst || refetched) && resetKey !== key;

  const snapshot = useSyncExternalStore(
    useCallback((l: () => void) => cache.subscribe(key, l), [key]),
    () => cache.getSnapshot<TData>(key),
  );

  useEffect(() => {
    if (!active) return;
    void cache.fetchQuery({ query, queryKey, variables });
  }, [active, key]); // eslint-disable-line react-hooks/exhaustive-deps -- key already encodes query and variables

  const [placeholder, setPlaceholder] = useState<TData | undefined>(undefined);
  if (snapshot.data !== undefined && snapshot.data !== placeholder) setPlaceholder(snapshot.data);
  const placeholderData = snapshot.settled ? undefined : placeholder;

  const latest = useRef({ query, queryKey, baseVars, baseKey });
  useEffect(() => {
    latest.current = { query, queryKey, baseVars, baseKey };
  });

  const refetch = useCallback((vars?: TVars, replace = false): Promise<void> => {
    const l = latest.current;
    const next: Override<TVars> = { baseKey: l.baseKey, variables: vars, replace };
    setOverride(next);
    setRefetched(true);
    setResetKey(null);
    return cache.fetchQuery(
      { query: l.query, queryKey: l.queryKey, variables: toCacheVariables(effectiveVars(l.baseVars, next, l.baseKey)) },
      { force: true },
    );
  }, []);

  const reset = useCallback((target?: string) => {
    const l = latest.current;
    const queryKey = target ?? l.queryKey;
    cache.remove((e) => e.queryKey === queryKey);
    if (queryKey !== l.queryKey) return;
    setPlaceholder(undefined);
    setOverride(null);
    setRefetched(false);
    setResetKey(cache.cacheKey(l.query, l.queryKey, toCacheVariables(effectiveVars(l.baseVars, null, l.baseKey))));
  }, []);

  const graphQLErrors = active ? snapshot.errors : NO_ERRORS;
  const errors = useMemo(() => graphQLErrors.map(formatError), [graphQLErrors]);

  return {
    loading: active && (!snapshot.settled || snapshot.loading),
    errors,
    data: active ? (snapshot.data ?? placeholderData) : undefined,
    refetch,
    reset,
  };
}
