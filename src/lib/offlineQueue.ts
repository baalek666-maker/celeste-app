// Queue d'actions offline : persistent localStorage, replay auto sur reconnect.
// Actions mutatrices (POST/PUT/DELETE) interceptées par api.ts => enqueue si offline.

const STORAGE_KEY = 'celeste:offline_queue:v1';
const MAX_QUEUE_SIZE = 100;
const MAX_ATTEMPTS = 10;

export interface QueuedAction {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
  attempts: number;
}

function read(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(arr: QueuedAction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { size: arr.length } }));
  } catch {
    // localStorage plein ou indisponible : silencieux
  }
}

export function getQueue(): QueuedAction[] {
  return read();
}

export function getQueueSize(): number {
  return read().length;
}

/** Génère un ID unique via crypto.randomUUID si disponible, fallback Date+random. */
function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallback */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt' | 'attempts'>): QueuedAction {
  const q = read();

  // Dé-duplication : si une action identique (même url+method+body) existe déjà, on la remplace
  const bodyStr = action.body !== undefined ? JSON.stringify(action.body) : '';
  const dupIdx = q.findIndex(
    (a) => a.url === action.url && a.method === action.method && JSON.stringify(a.body ?? '') === bodyStr
  );
  if (dupIdx >= 0) {
    q.splice(dupIdx, 1);
  }

  // FIFO eviction si la queue est pleine
  while (q.length >= MAX_QUEUE_SIZE) {
    q.shift();
  }

  const queued: QueuedAction = {
    id: genId(),
    createdAt: Date.now(),
    attempts: 0,
    ...action,
  };
  q.push(queued);
  write(q);
  return queued;
}

export function removeById(id: string) {
  write(read().filter((a) => a.id !== id));
}

export function clear() {
  write([]);
}

export type DrainResult = {
  replayed: number;
  failed: QueuedAction[];
};

// Verrou anti-drain concurrent : réutilise la Promise en cours
let drainingPromise: Promise<DrainResult> | null = null;

/**
 * Rejoue la queue séquentiellement.
 * - 401/403/422 ⇒ on retire l'action (erreur de payload)
 * - 5xx / network error ⇒ on garde (retry plus tard)
 * - Après MAX_ATTEMPTS ⇒ on retire (dead-letter)
 */
export function drain(): Promise<DrainResult> {
  // Réutilise le drain en cours s'il existe (anti race condition)
  if (drainingPromise) return drainingPromise;

  drainingPromise = (async () => {
    const q = read();
    if (q.length === 0) return { replayed: 0, failed: [] };

    let replayed = 0;
    const remaining: QueuedAction[] = [];

    for (const action of q) {
      try {
        const res = await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json', ...(action.headers || {}) },
          body: action.body !== undefined ? JSON.stringify(action.body) : undefined,
        });
        if (res.ok) {
          replayed++;
          // Action réussie → ne pas ajouter à remaining
        } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          // Payload invalide (4xx) : on retire définitivement
        } else {
          // 5xx ou 408/429 : on garde pour retry
          action.attempts++;
          if (action.attempts < MAX_ATTEMPTS) {
            remaining.push(action);
          }
          // else: dead-letter, on ne push pas → retiré de la queue
        }
      } catch {
        // Plus de réseau en cours de drain : on garde cette action ET toutes les suivantes
        action.attempts++;
        if (action.attempts < MAX_ATTEMPTS) {
          remaining.push(action);
        }
        // IMPORTANT: on conserve aussi toutes les actions restantes non traitées
        const currentIdx = q.indexOf(action);
        for (let i = currentIdx + 1; i < q.length; i++) {
          remaining.push(q[i]);
        }
        break;
      }
    }

    // Persiste l'état final de la queue (échecs + non tentées)
    write(remaining);
    return { replayed, failed: remaining };
  })().finally(() => {
    drainingPromise = null;
  });

  return drainingPromise;
}

let listenerInstalled = false;

/**
 * Installe les listeners online/offline pour drain auto.
 * À appeler une seule fois au boot client (App.tsx).
 */
export function installAutoDrain(onDrained?: (r: DrainResult) => void) {
  if (listenerInstalled) return;
  listenerInstalled = true;

  const tryDrain = async () => {
    if (!navigator.onLine) return;
    const result = await drain();
    if (result.replayed > 0 && onDrained) onDrained(result);
  };

  window.addEventListener('online', () => {
    // Laisse un peu de temps au réseau pour stabiliser
    setTimeout(tryDrain, 800);
  });

  // Drain au boot si on est déjà online
  if (navigator.onLine) {
    setTimeout(tryDrain, 2000);
  }
}
