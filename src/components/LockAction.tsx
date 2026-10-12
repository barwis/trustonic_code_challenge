import { useCallback, useState } from 'react';
import { DEVICE_STATES, type DeviceDetailData, type DeviceState, type ListDevicesData } from '../api';
import * as cache from '../data/cache';
import { useTenantMutation, useTenantQuery } from '../data/tenantHooks';
import { useTenant } from '../TenantContext';
import { ErrorBox } from './ErrorBox';
import { Status } from './Status';

const LIST_AVAILABLE_ACTIONS = `
  query ListAvailableActions($tenantId: String, $stateId: String) {
    listAvailableActions(tenantId: $tenantId, stateId: $stateId) {
      id
      actionName
      policyName
      stateId
    }
  }
`;

const ASSIGN_ACTION = `
  mutation AssignAction($tenantId: String!, $deviceId: String!, $actionId: String!) {
    assignAction(tenantId: $tenantId, deviceId: $deviceId, actionId: $actionId)
  }
`;

type Action = {
  id: string;
  actionName: string | null;
  policyName: string | null;
  stateId: number | null;
};

type ListAvailableActionsData = {
  listAvailableActions: Array<Action | null> | null;
};

type ListAvailableActionsVars = {
  stateId: string;
};

type AssignActionData = {
  assignAction: boolean | null;
};

type AssignActionVars = {
  deviceId: string;
  actionId: string;
};

type LockActionProps = {
  deviceId: string;
  state: DeviceState | null;
};

function isDeviceList(tenantId: string): cache.Predicate {
  return (e) => e.variables.tenantId === tenantId && e.queryKey === 'ListDevices';
}

function isDetailFor(tenantId: string, deviceId: string): cache.Predicate {
  return (e) => e.variables.tenantId === tenantId && e.queryKey === 'DeviceDetail' && e.variables.deviceId === deviceId;
}

function isDetailOrHistoryFor(tenantId: string, deviceId: string): cache.Predicate {
  return (e) =>
    e.variables.tenantId === tenantId &&
    (e.queryKey === 'DeviceDetail' || e.queryKey === 'ListDeviceHistory') &&
    e.variables.deviceId === deviceId;
}

function patchList(deviceId: string, state: DeviceState): cache.Updater<ListDevicesData> {
  return (data) => {
    const list = data.listDevices;
    if (!list?.deviceList?.some((r) => r?.id === deviceId)) return data;
    return {
      listDevices: {
        ...list,
        deviceList: list.deviceList.map((r) => (r?.id === deviceId ? { ...r, state } : r)),
      },
    };
  };
}

function patchDetail(state: DeviceState): cache.Updater<DeviceDetailData> {
  return (data) => (data.deviceDetail ? { deviceDetail: { ...data.deviceDetail, state } } : data);
}

function stateForAction(action: Action): DeviceState | undefined {
  return DEVICE_STATES.find((s) => s.id === action.stateId);
}

function useAssignAction() {
  const { tenantId } = useTenant();
  const { mutateData, loading } = useTenantMutation<AssignActionData, AssignActionVars>(ASSIGN_ACTION, {
    throwError: true,
  });
  const [error, setError] = useState<string | null>(null);

  const assign = useCallback(
    async (deviceId: string, action: Action) => {
      setError(null);
      const nextState = stateForAction(action);
      if (!nextState) return;

      const removeListPatch = cache.addOptimisticLayer(isDeviceList(tenantId), patchList(deviceId, nextState));
      const removeDetailPatch = cache.addOptimisticLayer(isDetailFor(tenantId, deviceId), patchDetail(nextState));
      const removePatches = () => {
        removeListPatch();
        removeDetailPatch();
      };

      try {
        const data = await mutateData({ deviceId, actionId: action.id });

        if (!data?.assignAction) throw new Error('Lock failed.');

        cache.updateServerData(isDeviceList(tenantId), patchList(deviceId, nextState));
        cache.updateServerData(isDetailFor(tenantId, deviceId), patchDetail(nextState));

        removePatches();

        // TODO: mark state-filtered list pages (e.g. ACTIVE) stale
        cache.invalidate(isDetailOrHistoryFor(tenantId, deviceId));
      } catch (e) {
        removePatches();
        // TODO: refetch detail on failure (view was probably stale)
        setError((e as Error).message);
      }
    },
    [mutateData, tenantId],
  );

  return { assign, pending: loading, error, clearError: () => setError(null) };
}

// TODO: Lock is never offered on a LOCKED device, so the server rejection and rollback are unreachable from the UI
export function LockAction({ deviceId, state }: LockActionProps) {
  const { assign, pending, error, clearError } = useAssignAction();

  const actions = useTenantQuery<ListAvailableActionsData, ListAvailableActionsVars>(LIST_AVAILABLE_ACTIONS, {
    variables: { stateId: String(state?.id) },
    fetchFirst: state != null,
  });
  const lock = actions.data?.listAvailableActions?.find((a) => a && stateForAction(a)?.name === 'LOCKED');

  return (
    <div>
      <Status
        loading={actions.loading}
        empty={!!actions.data && !lock}
        emptyText="Lock is not available in this state."
      />
      <ErrorBox errors={actions.errors} onRetry={() => void actions.refetch()} />
      {lock && (
        <button type="button" disabled={pending} onClick={() => void assign(deviceId, lock)}>
          {pending ? 'Locking...' : (lock.actionName ?? 'Lock device')}
        </button>
      )}
      {error && (
        <div className="error" role="alert">
          {error} The change has been rolled back.
          <button type="button" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
