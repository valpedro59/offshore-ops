import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { loadEnv } from './env';

const env = loadEnv();
const pool = new pg.Pool({ connectionString: env.STOCK_DATABASE_URL });
await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
await pool.end();
console.log('✔ migrations stock-service appliquées');
