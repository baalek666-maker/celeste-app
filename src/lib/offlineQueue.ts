// Queue d'actions offline : persistent localStorage, replay auto sur reconnect.
// Actions mutatrices (POST/PUT/DELETE) interceptées par api.ts => enqueue si offline.

const STORAGE_KEY = 'celeste:offline_queue:v1';

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

export function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt' | 'attempts'>): QueuedAction {
  const q = read();
  const queued: QueuedAction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

/**
 * Rejoue la queue séquentiellement.
 * - 401/403/422 ⇒ on retire l'action (erreur de payload)
 * - 5xx / network error ⇒ on garde (retry plus tard)
 */
export async function drain(): Promise<DrainResult> {
  const q = read();
  if (q.length === 0) return { replayed: 0, failed: [] };
  let replayed = 0;
  const failed: QueuedAction[] = [];

  for (const action of q) {
    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body !== undefined ? JSON.stringify(action.body) : undefined,
      });
      if (res.ok) {
        removeById(action.id);
        replayed++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        // Payload invalide : retirer (sinon on boucle pour rien)
        removeById(action.id);
      } else {
        // 5xx ou 408/429 : on garde pour retry
        action.attempts++;
        failed.push(action);
      }
    } catch {
      // Plus de réseau en cours de drain : on garde tout
      action.attempts++;
      failed.push(action);
      break;
    }
  }

  // Persist updated attempts
  write(failed);
  return { replayed, failed };
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
