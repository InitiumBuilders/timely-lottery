/**
 * PM2 Ecosystem Config — Timely.Works
 * Both processes run on this VPS alongside each other.
 */
const path = require('path');

// Load .env.local for the worker
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '.env.local');
let localEnv = {};
try { localEnv = dotenv.parse(require('fs').readFileSync(envPath)); } catch {}

module.exports = {
  apps: [
    {
      name: 'timely-lottery',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ...localEnv,
      },
    },
    {
      name: 'timely-worker',
      script: 'scripts/worker.mjs',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        WORKER_URL: 'http://localhost:3000',
        ...localEnv,
      },
    },
  ],
};
