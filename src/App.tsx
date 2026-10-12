import { useState } from 'react';
import { DeviceDetailPanel } from './components/DeviceDetailPanel';
import { DeivcesList } from './components/DevicesList';
import { TenantProvider, useTenant, type TenantId } from './TenantContext';

const TENANTS: TenantId[] = ['tenant-alpha', 'tenant-beta'];

function ConsoleForTenant() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <main>
      <DeivcesList selectedId={selectedId} onSelect={setSelectedId} />

      {selectedId ? (
        <DeviceDetailPanel key={selectedId} deviceId={selectedId} />
      ) : (
        <section className="muted">Select a device to see its detail and history.</section>
      )}
    </main>
  );
}

function Shell() {
  const { tenantId, setTenantId } = useTenant();

  return (
    <>
      <header>
        <h1>ALPS Device Console</h1>
        <label>
          Tenant
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value as TenantId)}>
            {TENANTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </header>
      <ConsoleForTenant key={tenantId} />
    </>
  );
}

export default function App() {
  return (
    <TenantProvider initial="tenant-alpha">
      <Shell />
    </TenantProvider>
  );
}
