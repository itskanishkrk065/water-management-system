export type SyncStatus = 'LOCAL_ONLY' | 'PENDING_SYNC' | 'SYNCED' | 'SYNC_FAILED' | 'CONFLICT';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncEntityType =
  | 'BENEFICIARY'
  | 'LAND_HOLDING'
  | 'SURVEY_PARCEL'
  | 'WATER_APPLICATION'
  | 'WATER_ALLOTMENT'
  | 'DEVELOPMENT_BILL'
  | 'INSTALLMENT'
  | 'PAYMENT'
  | 'LOCAL_DRAFT';

export interface SyncMetadata {
  sync_status?: SyncStatus;
  syncStatus?: SyncStatus;
  last_synced_at?: string | null;
  lastSyncedAt?: string | null;
  local_version?: number;
  localVersion?: number;
  server_version?: number | null;
  serverVersion?: number | null;
}

export interface SyncQueueItem {
  id: string;
  operation_id?: string;
  operationId?: string;
  entity_type: SyncEntityType;
  entityType?: SyncEntityType;
  entity_id: string;
  entityId?: string;
  operation_type: SyncOperationType;
  operationType?: SyncOperationType;
  payload: string; // JSON string
  created_at: string;
  createdAt?: string;
  attempt_count: number;
  attemptCount?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'FAILED' | 'COMPLETED' | 'CONFLICT';
  last_error?: string | null;
  lastError?: string | null;
  last_attempt_at?: string | null;
  lastAttemptAt?: string | null;
}

export interface SyncSummary {
  pending: number;
  in_progress?: number;
  failed: number;
  conflict: number;
  completed?: number;
  total?: number;
  last_sync_timestamp?: string | null;
  lastSyncTimestamp?: string | null;
}
