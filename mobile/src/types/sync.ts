export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'VOID';
export type SyncItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CONFLICT' | 'SYNCED';

export interface SyncQueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncOperationType;
  payload: string; // JSON
  status: SyncItemStatus;
  retry_count: number;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncSummary {
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  conflict: number;
  total: number;
  synced?: number;
  last_sync_timestamp?: string;
}

export type SyncStatus = 'LOCAL_ONLY' | 'PENDING_SYNC' | 'SYNCED' | 'SYNC_FAILED' | 'CONFLICT';

export interface SyncMetadata {
  sync_status?: SyncStatus;
  local_version?: number;
  server_version?: number;
  last_synced_at?: string | null;
}
