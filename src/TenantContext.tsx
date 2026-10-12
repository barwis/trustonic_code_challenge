import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as cache from './data/cache';

export type TenantId = 'tenant-alpha' | 'tenant-beta';

type TenantContextValue = {
  tenantId: TenantId;
  setTenantId: (next: TenantId) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

type TenantProviderProps = {
  initial: TenantId;
  children: ReactNode;
};

export function TenantProvider({ initial, children }: TenantProviderProps) {
  const [tenantId, setTenant] = useState<TenantId>(initial);

  const setTenantId = useCallback(
    (next: TenantId) => {
      if (next === tenantId) return;
      cache.remove((e) => e.variables.tenantId === tenantId);
      setTenant(next);
    },
    [tenantId],
  );

  const value = useMemo(() => ({ tenantId, setTenantId }), [tenantId, setTenantId]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenant must be used inside <TenantProvider>');
  return value;
}
