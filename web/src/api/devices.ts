import { request } from './client';

export type DeviceRole = 'host' | 'discovered';

export type Device = {
  id: number;
  name: string;
  hostname?: string;
  description?: string;
  roles?: string[];
  scope: DeviceRole;
  online?: boolean;
  last_seen_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // — points at the row in topology.nodes that fronts this
  // device. Null until topology.Migrate's backfill has run.
  node_id?: number | null;
};

export function listDevices() {
  return request<{ items: Device[]; total: number }>('GET', '/devices');
}

export function getDevice(id: string | number) {
  return request<Device>('GET', `/devices/${encodeURIComponent(String(id))}`);
}
