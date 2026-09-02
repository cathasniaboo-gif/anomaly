import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './server';
import { startScheduler } from './scheduler';

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.ADMIN_API_KEY) {
  console.warn(
    '[startup] ADMIN_API_KEY is not set — all /api/admin/* routes will return 500. ' +
      'Set it in backend/.env (copy backend/.env.example) before curating updates.'
  );
}

const app = createServer();
app.listen(PORT, () => {
  console.log(`[startup] UAE Reg backend listening on http://localhost:${PORT}`);
  startScheduler();
});
