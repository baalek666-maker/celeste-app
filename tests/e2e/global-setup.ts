/**
 * Global setup Playwright.
 *
 * Si on est en CI et que le workflow n'a pas démarré le backend Node lui-même
 * (cas actuel), on le démarre ici pour que les tests API aient un serveur
 * à interroger sur http://localhost:3001.
 *
 * En local, on suppose que l'utilisateur a déjà un serveur sur 3001.
 * On vérifie via /api/health et on ne démarre rien si déjà up.
 */
import { spawn, ChildProcess } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const SERVER_DIR = './server';
const START_TIMEOUT_MS = 30_000;

let serverProc: ChildProcess | null = null;

async function isServerUp(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < START_TIMEOUT_MS) {
    if (await isServerUp()) return;
    await wait(500);
  }
  throw new Error(`Server didn't start on ${API_BASE} within ${START_TIMEOUT_MS}ms`);
}

export default async function globalSetup() {
  if (await isServerUp()) {
    console.log(`[global-setup] Backend already up on ${API_BASE}, nothing to do`);
    return;
  }

  console.log(`[global-setup] Starting backend Node (cd ${SERVER_DIR} && node server.js)...`);
  serverProc = spawn('node', ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: '3001' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  serverProc.stdout?.on('data', (chunk) => {
    process.stdout.write(`[server] ${chunk}`);
  });
  serverProc.stderr?.on('data', (chunk) => {
    process.stderr.write(`[server] ${chunk}`);
  });

  await waitForServer();
  console.log('[global-setup] Backend OK ✓');

  // Stocker le PID pour teardown
  if (serverProc.pid) {
    process.env.__BACKEND_PID__ = String(serverProc.pid);
  }
}
