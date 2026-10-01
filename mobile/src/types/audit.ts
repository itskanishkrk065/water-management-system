import { SyncStatus } from './sync';

export interface LocalAuditEvent {
  audit_id: string;
  auditId?: string;
  user_id: string;
  userId?: string;
  user_role: string;
  userRole?: string;
  device_id: string;
  deviceId?: string;
  entity_type: string;
  entityType?: string;
  entity_id: string;
  entityId?: string;
  action: string;
  details_json?: string | null;
  details?: Record<string, any> | string;
  timestamp: string;
  sync_status?: SyncStatus;
  isSynced?: boolean;
}
