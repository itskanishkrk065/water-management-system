import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';
import { seedDatabase } from './seed';

const DATABASE_NAME = 'watergrid_mobile.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

/**
 * Gets or opens the singleton SQLite database instance.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbInstance;
}

/**
 * Initializes the database schema, enables WAL mode, and seeds initial data if empty.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (isInitialized && dbInstance) {
    return dbInstance;
  }

  const db = await getDatabase();

  // Pragmas for performance and data integrity
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run schema creation
  await db.execAsync(CREATE_TABLES_SQL);

  // Check if users exist; if not, seed initial baseline
  const userCountResult = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM users;'
  );

  if (!userCountResult || userCountResult.count === 0) {
    await seedDatabase(db);
  }

  isInitialized = true;
  return db;
}

/**
 * Close database connection (e.g. for Clean State reset).
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    isInitialized = false;
  }
}
