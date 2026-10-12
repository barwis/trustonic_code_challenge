import { useState } from 'react';
import { useTenantQuery } from '../data/tenantHooks';
import { formatDate, pageCount } from '../lib/format';
import { ErrorBox } from './ErrorBox';
import { Pager } from './Pager';
import { Status } from './Status';

const PAGE_SIZE = 5;

const LIST_DEVICE_HISTORY = `
  query ListDeviceHistory($tenantId: String!, $deviceId: String!, $page: Int, $pageSize: Int) {
    listDeviceHistory(tenantId: $tenantId, deviceId: $deviceId, page: $page, pageSize: $pageSize) {
      pageInfo {
        total_count
      }
      histories {
        type
        createdAt
        email
        policyName
        nextPolicyName
        actionName
      }
    }
  }
`;

type HistoryEntry = {
  type: string | null;
  createdAt: string | null;
  email: string | null;
  policyName: string | null;
  nextPolicyName: string | null;
  actionName: string | null;
};

type ListDeviceHistoryData = {
  listDeviceHistory: {
    pageInfo: { total_count: number | null } | null;
    histories: Array<HistoryEntry | null> | null;
  } | null;
};

type ListDeviceHistoryVars = {
  deviceId: string;
  page: number;
  pageSize: number;
};

export function HistoryList({ deviceId }: { deviceId: string }) {
  const [page, setPage] = useState(1);
  const { data, loading, errors, refetch } = useTenantQuery<ListDeviceHistoryData, ListDeviceHistoryVars>(
    LIST_DEVICE_HISTORY,
    { variables: { deviceId, page, pageSize: PAGE_SIZE }, fetchFirst: true },
  );

  const history = data?.listDeviceHistory;
  const rows = (history?.histories ?? []).filter((h) => h !== null);
  const total = history?.pageInfo?.total_count;

  if (total != null && page > pageCount(total, PAGE_SIZE)) {
    setPage(pageCount(total, PAGE_SIZE));
  }

  return (
    <div>
      <h3>History</h3>
      <Status loading={loading} empty={!!data && rows.length === 0} emptyText="No history for this device." />
      <ErrorBox errors={errors} onRetry={() => void refetch()} />
      <ol className={loading ? 'stale' : undefined}>
        {rows.map((h) => (
          <li key={`${h.createdAt}|${h.actionName}|${h.email}`}>
            <div>
              <strong>{h.actionName ?? h.type ?? 'Event'}</strong> <span className="muted">{h.type}</span>
            </div>
            {(h.policyName || h.nextPolicyName) && (
              <div>
                {h.policyName ?? '-'} to {h.nextPolicyName ?? '-'}
              </div>
            )}
            <div className="muted">
              {formatDate(h.createdAt)}, {h.email ?? 'unknown operator'}
            </div>
          </li>
        ))}
      </ol>
      <Pager page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onPage={setPage} />
    </div>
  );
}
