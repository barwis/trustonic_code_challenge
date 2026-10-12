import { useEffect, useState } from 'react';
import { DEVICE_STATES, LIST_DEVICES, type Imei, type ListDevicesData, type ListDevicesVars } from '../api';
import { useTenantQuery } from '../data/tenantHooks';
import { formatDate, pageCount } from '../lib/format';
import { ErrorBox } from './ErrorBox';
import { Pager } from './Pager';
import { Status } from './Status';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

type DevicesListProps = {
  selectedId: string | null;
  onSelect: (deviceId: string) => void;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

function primaryImei(imeis: Array<Imei | null> | null): string {
  return imeis?.find((i) => i?.isPrimary)?.imei ?? '-';
}

function searchVars(term: string): Pick<ListDevicesVars, 'imei' | 'serialNumber'> {
  if (!term) return {};
  return /^\d+$/.test(term) ? { imei: term } : { serialNumber: term };
}

export function DeivcesList({ selectedId, onSelect }: DevicesListProps) {
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [stateId, setStateId] = useState<number | undefined>(undefined);

  const filterKey = `${term}|${stateId ?? ''}`;
  const [paging, setPaging] = useState({ filterKey, page: 1 });
  const page = paging.filterKey === filterKey ? paging.page : 1;

  const { data, loading, errors, refetch } = useTenantQuery<ListDevicesData, ListDevicesVars>(LIST_DEVICES, {
    variables: {
      ...searchVars(term),
      ...(stateId !== undefined ? { stateId } : {}),
      page,
      pageSize: PAGE_SIZE,
    },
    fetchFirst: true,
  });

  const list = data?.listDevices;
  const rows = (list?.deviceList ?? []).filter((r) => r !== null);
  const total = list?.pageInfo?.total_count;

  if (total != null && page > pageCount(total, PAGE_SIZE)) {
    setPaging({ filterKey, page: pageCount(total, PAGE_SIZE) });
  }

  return (
    <section>
      <h2>Devices</h2>
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label>
          Search
          <input
            type="search"
            placeholder="IMEI or serial number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <label>
          State
          <select
            value={stateId ?? ''}
            onChange={(e) => setStateId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All states</option>
            {DEVICE_STATES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </form>

      <Status loading={loading} empty={!!data && rows.length === 0} emptyText="No devices match these filters." />

      <ErrorBox errors={errors} onRetry={() => void refetch()} />

      <table className={loading ? 'stale' : undefined} aria-busy={loading}>
        <thead>
          <tr>
            <th>Serial number</th>
            <th>Primary IMEI</th>
            <th>Model</th>
            <th>State</th>
            <th>Last check-in</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr
              key={d.id}
              className={d.id === selectedId ? 'selected' : undefined}
              aria-current={d.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(d.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(d.id);
                }
              }}
            >
              <td>{d.serialNumber ?? '-'}</td>
              <td>{primaryImei(d.IMEIs)}</td>
              <td>{d.modelMarketingName ?? '-'}</td>
              <td>
                <strong>{d.state?.name ?? 'UNKNOWN'}</strong>
              </td>
              <td>{formatDate(d.lastCheckin)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pager
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        loading={loading}
        onPage={(p) => setPaging({ filterKey, page: p })}
      />
    </section>
  );
}
