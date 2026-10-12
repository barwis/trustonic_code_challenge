import { act, renderHook, waitFor } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';
import { LIST_DEVICES, type ListDevicesData, type ListDevicesVars } from '../api';
import { TenantProvider } from '../TenantContext';
import { server } from '../test/setup';
import * as cache from './cache';
import { useTenantQuery } from './tenantHooks';

afterEach(() => cache.clearCache());

function wrapper({ children }: { children: ReactNode }) {
  return <TenantProvider initial="tenant-alpha">{children}</TenantProvider>;
}

function vars(serialNumber: string): ListDevicesVars {
  return { serialNumber, page: 1, pageSize: 10 };
}

function serials(d: ListDevicesData | undefined) {
  return d?.listDevices?.deviceList?.map((r) => r?.serialNumber);
}

it('shows the latest search when an older response arrives last', async () => {
  const gates = new Map<string, () => void>();
  server.use(
    graphql.link('http://localhost:3000/graphql').query('ListDevices', async ({ variables }) => {
      const term = String(variables.serialNumber);
      await new Promise<void>((release) => gates.set(term, release));
      return HttpResponse.json({
        data: { listDevices: { pageInfo: { total_count: 1 }, deviceList: [{ id: term, serialNumber: term }] } },
      });
    }),
  );

  const rendered: ReturnType<typeof serials>[] = [];
  const { result, rerender } = renderHook(
    ({ term }: { term: string }) => {
      const q = useTenantQuery<ListDevicesData, ListDevicesVars>(LIST_DEVICES, {
        variables: vars(term),
        fetchFirst: true,
      });
      rendered.push(serials(q.data));
      return q;
    },
    { wrapper, initialProps: { term: 'old' } },
  );
  await waitFor(() => expect(gates.has('old')).toBe(true));

  rerender({ term: 'new' });
  await waitFor(() => expect(gates.has('new')).toBe(true));

  act(() => gates.get('new')!());
  await waitFor(() => expect(serials(result.current.data)).toEqual(['new']));
  act(() => gates.get('old')!());

  const oldKey = cache.cacheKey(LIST_DEVICES, 'ListDevices', { ...vars('old'), tenantId: 'tenant-alpha' });
  await waitFor(() => expect(serials(cache.getSnapshot<ListDevicesData>(oldKey).data)).toEqual(['old']));

  expect(serials(result.current.data)).toEqual(['new']);
  expect(rendered.some((s) => s?.includes('old'))).toBe(false);
});
