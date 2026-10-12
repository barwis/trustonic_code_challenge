export const LIST_DEVICES = `
  query ListDevices(
    $tenantId: String
    $imei: String
    $serialNumber: String
    $stateId: Int
    $page: Int
    $pageSize: Int
  ) {
    listDevices(
      tenantId: $tenantId
      imei: $imei
      serialNumber: $serialNumber
      stateId: $stateId
      page: $page
      pageSize: $pageSize
    ) {
      pageInfo {
        total_count
      }
      deviceList {
        id
        serialNumber
        modelMarketingName
        brandName
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
        lastCheckin
      }
    }
  }
`;

export type Imei = {
  imei: string | null;
  isPrimary: boolean | null;
};
export type DeviceState = {
  id: number;
  name: string | null;
};
type Policy = {
  id: string;
  name: string | null;
  color: string | null;
};

type DeviceRow = {
  id: string;
  serialNumber: string | null;
  modelMarketingName: string | null;
  brandName: string | null;
  IMEIs: Array<Imei | null> | null;
  state: DeviceState | null;
  policy: Policy;
  lastCheckin: string | null;
};

export type ListDevicesData = {
  listDevices: {
    pageInfo: { total_count: number | null } | null;
    deviceList: Array<DeviceRow | null> | null;
  } | null;
};

export type ListDevicesVars = {
  imei?: string;
  serialNumber?: string;
  stateId?: number;
  page: number;
  pageSize: number;
};

type DeviceDetail = {
  id: string;
  serialNumber: string | null;
  deviceBrandName: string | null;
  deviceModelMarketingName: string | null;
  imsi: string | null;
  locale: string | null;
  firstEnrollAt: string | null;
  IMEIs: Array<Imei | null> | null;
  state: DeviceState | null;
  policy: Policy | null;
  lastCheckin: {
    label: string | null;
    date: string | null;
    color: string | null;
  } | null;
};

export type DeviceDetailData = { deviceDetail: DeviceDetail | null };

export const DEVICE_STATES: DeviceState[] = [
  { id: 1, name: 'ENROLLED' },
  { id: 2, name: 'ACTIVE' },
  { id: 3, name: 'LOCKED' },
  { id: 4, name: 'RELEASED' },
];
