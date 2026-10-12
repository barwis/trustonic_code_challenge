import type { ReactNode } from 'react';
import type { DeviceDetailData } from '../api';
import { useTenantQuery } from '../data/tenantHooks';
import { formatDate } from '../lib/format';
import { ErrorBox } from './ErrorBox';
import { HistoryList } from './HistoryList';
import { LockAction } from './LockAction';
import { Status } from './Status';

const DEVICE_DETAIL = `
  query DeviceDetail($tenantId: String!, $deviceId: String!) {
    deviceDetail(tenantId: $tenantId, deviceId: $deviceId) {
      id
      serialNumber
      deviceBrandName
      deviceModelMarketingName
      imsi
      locale
      firstEnrollAt
      IMEIs {
        imei
        isPrimary
      }
      state {
        id
        name
      }
      policy {
        id
        name
        color
      }
      lastCheckin {
        label
        date
        color
      }
    }
  }
`;

type DeviceDetailVars = {
  deviceId: string;
};

function fieldError(errors: string[], field: string): string | undefined {
  const prefix = `deviceDetail.${field}: `;
  return errors.find((e) => e.startsWith(prefix))?.slice(prefix.length);
}

type FieldProps = {
  label: string;
  children: ReactNode;
  error?: string;
};

function Field({ label, children, error }: FieldProps) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{error ? <span className="error">Unavailable: {error}</span> : children}</dd>
    </>
  );
}

export function DeviceDetailPanel({ deviceId }: { deviceId: string }) {
  const { data, loading, errors, refetch } = useTenantQuery<DeviceDetailData, DeviceDetailVars>(DEVICE_DETAIL, {
    variables: { deviceId },
    fetchFirst: true,
  });

  const d = data?.deviceDetail;

  return (
    <section>
      <h2>Device detail</h2>
      <Status loading={loading} empty={!d && errors.length === 0} emptyText="Device not found." />
      {!d && <ErrorBox errors={errors} onRetry={() => void refetch()} />}
      {d && errors.length > 0 && <div className="warning">Some fields could not be loaded.</div>}

      {d && (
        <>
          <dl className="detail">
            <Field label="Serial number">{d.serialNumber ?? '-'}</Field>
            <Field label="Device">
              {d.deviceBrandName ?? '-'} {d.deviceModelMarketingName ?? ''}
            </Field>
            <Field label="IMEIs">
              {(d.IMEIs ?? [])
                .filter((i) => i !== null)
                .map((i, idx) => (
                  <div key={i.imei ?? idx}>
                    {i.imei} {i.isPrimary ? '(primary)' : ''}
                  </div>
                ))}
            </Field>

            <Field label="IMSI" error={fieldError(errors, 'imsi')}>
              {d.imsi ?? '-'}
            </Field>
            <Field label="State">
              <strong>{d.state?.name ?? 'UNKNOWN'}</strong>
            </Field>
            <Field label="Policy" error={fieldError(errors, 'policy')}>
              {d.policy?.name ?? '-'}
            </Field>
            <Field label="Locale">{d.locale ?? '-'}</Field>
            <Field label={d.lastCheckin?.label ?? 'Last check-in'}>{formatDate(d.lastCheckin?.date)}</Field>
            <Field label="First enrolled">{formatDate(d.firstEnrollAt)}</Field>
          </dl>
          <LockAction deviceId={d.id} state={d.state} />
        </>
      )}

      <HistoryList deviceId={deviceId} />
    </section>
  );
}
