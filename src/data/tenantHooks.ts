import { useCallback } from 'react';
import { useTenant } from '../TenantContext';
import { useMutation, type UseMutationOptions, type UseMutationResult } from './useMutation';
import { useQuery, type UseQueryOptions, type UseQueryResult } from './useQuery';

type WithTenant<TVars> = TVars & { tenantId: string };

function withTenant<TVars extends object>(vars: TVars | undefined, tenantId: string): WithTenant<TVars> {
  return { ...(vars as TVars), tenantId };
}

export function useTenantQuery<TData, TVars extends object = Record<string, never>>(
  query: string,
  options: UseQueryOptions<TVars>,
): UseQueryResult<TData, TVars> {
  const { tenantId } = useTenant();
  const inner = useQuery<TData, WithTenant<TVars>>(query, {
    ...options,
    variables: withTenant(options.variables, tenantId),
  });
  const { refetch: innerRefetch } = inner;
  const refetch = useCallback(
    (vars?: TVars, replace?: boolean) => innerRefetch(withTenant(vars, tenantId), replace),
    [innerRefetch, tenantId],
  );
  return { loading: inner.loading, errors: inner.errors, data: inner.data, reset: inner.reset, refetch };
}

export function useTenantMutation<TData, TVars extends object = Record<string, never>>(
  query: string,
  options: UseMutationOptions<TVars>,
): UseMutationResult<TData, TVars> {
  const { tenantId } = useTenant();
  const inner = useMutation<TData, WithTenant<TVars>>(query, {
    ...options,
    variables: withTenant(options.variables, tenantId),
  });
  const { mutateData: innerMutate } = inner;
  const mutateData = useCallback(
    (vars?: TVars, replace?: boolean) => innerMutate(withTenant(vars, tenantId), replace),
    [innerMutate, tenantId],
  );
  return { loading: inner.loading, errors: inner.errors, mutateData };
}
