import { apiClient } from './api';

export interface ClientSyncDiagnostics {
  state: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ATTENTION_REQUIRED';
  deviceId: string;
  pendingOutboxCount: number;
  conflictCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

export async function getClientDeviceId(): Promise<string> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getDeviceId) {
    try {
      const devId = await (window as any).electronAPI.getDeviceId();
      if (devId && devId.trim()) return devId.trim();
    } catch {}
  }
  if (typeof window !== 'undefined') {
    let localDev = localStorage.getItem('water_device_id');
    if (!localDev) {
      localDev = `DEV-DESKTOP-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
      localStorage.setItem('water_device_id', localDev);
    }
    return localDev;
  }
  return 'LOCAL-DESKTOP';
}

export async function fetchSyncDiagnostics(): Promise<ClientSyncDiagnostics> {
  const deviceId = await getClientDeviceId();

  let serverReachable = false;
  let serverSyncStatus: any = null;

  try {
    const statusRes = await apiClient.get('/sync/status', { params: { deviceId } });
    if (statusRes.data && statusRes.data.serverTime) {
      serverReachable = true;
      serverSyncStatus = statusRes.data;
    }
  } catch {
    try {
      const healthRes = await apiClient.get('/health');
      if (healthRes.data && (healthRes.data.status === 'HEALTHY' || healthRes.data.status === 'UP')) {
        serverReachable = true;
      }
    } catch {
      serverReachable = false;
    }
  }

  let clientDiag: any = null;
  try {
    const diagRes = await apiClient.get('/sync/client-diagnostics');
    if (diagRes.data && diagRes.data.state) {
      clientDiag = diagRes.data;
    }
  } catch {}

  const state: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ATTENTION_REQUIRED' = clientDiag?.state
    ? clientDiag.state
    : serverReachable
    ? 'ONLINE'
    : 'OFFLINE';

  const lastSyncAt = clientDiag?.lastSyncAt
    ? clientDiag.lastSyncAt
    : serverSyncStatus?.device?.lastSyncAt
    ? serverSyncStatus.device.lastSyncAt
    : null;

  return {
    state,
    deviceId: clientDiag?.deviceId || deviceId,
    pendingOutboxCount: clientDiag?.pendingOutboxCount || 0,
    conflictCount: clientDiag?.conflictCount || 0,
    lastSyncAt,
    lastError: serverReachable ? null : 'Server unreachable',
  };
}

export async function triggerDeviceSync(): Promise<{
  appliedCount: number;
  conflictCount: number;
  failedCount: number;
}> {
  const deviceId = await getClientDeviceId();

  try {
    await apiClient.post('/sync/register-device', {
      deviceId,
      deviceName: 'WaterGrid Desktop Client Node',
      deviceType: 'ELECTRON_DESKTOP',
      appVersion: '2.0.0',
    });
  } catch {}

  try {
    const res = await apiClient.post('/sync/client-drain');
    return {
      appliedCount: res.data?.appliedCount || 0,
      conflictCount: res.data?.conflictCount || 0,
      failedCount: res.data?.failedCount || 0,
    };
  } catch {
    return { appliedCount: 0, conflictCount: 0, failedCount: 0 };
  }
}
