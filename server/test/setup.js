/**
 * Loaded before every test file (node --import). Points the app at a dedicated test database
 * so tests can wipe data freely, creates it if missing, and applies all migrations.
 * Override with TEST_DATABASE_URL.
 */
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/stocksense_test';
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error(`Refusing to run tests against "${url}": the database name must contain "test".`);
}
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough';

// Create the database on first run (connect to the server's default "postgres" database).
const admin = new URL(url);
const dbName = admin.pathname.slice(1);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
if (!rowCount) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
await client.end();

const { migrate } = await import('../src/db/migrate.js');
await migrate({ log: () => {} });
