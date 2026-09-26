import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { startListener, stopListener } from './modules/realtime/realtime.bus.js';

await startListener();

const server = createApp().listen(env.PORT, () => {
  console.log(`StockSense API listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown: stop accepting requests, then close DB connections.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await stopListener();
    server.closeAllConnections(); // open live-update streams would otherwise keep the server alive
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
