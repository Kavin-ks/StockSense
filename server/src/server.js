import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`StockSense API listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown: stop accepting requests, then close DB connections.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
}
