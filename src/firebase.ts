import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  getDocFromServer,
  Firestore,
  terminate,
  clearIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with multi-tab IndexedDB persistent cache.
// Enables seamless real-time synchronization between different tabs without lock contention
// while caching documents locally so repeat queries consume 0 cloud reads.
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance; /* CRITICAL: The app will break without this database ID */
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection check: the client is offline.');
    }
  }
}
// =========================================================================
// LOCAL CACHE WIPE (sign-out)
// Firestore keeps the company's documents in this browser (IndexedDB). On
// sign-out they must be deleted, but that is only possible when NO tab is
// using Firestore. The tab that signs out asks the other tabs to stop
// Firestore, waits for their answers, deletes the cache and then tells them
// to reload. If it still fails, a flag makes the next page load delete the
// cache before Firestore is used at all.
// =========================================================================
export const PENDING_CACHE_CLEAR_KEY = 'yaa_pos_pending_cache_clear';
const SESSION_CHANNEL = 'yaa_pos_session';
const TAB_ID = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function markPendingClear(on: boolean) {
  try {
    if (on) localStorage.setItem(PENDING_CACHE_CLEAR_KEY, String(Date.now()));
    else localStorage.removeItem(PENDING_CACHE_CLEAR_KEY);
  } catch {}
}

async function tryClear(attempts: number): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await clearIndexedDbPersistence(firestoreInstance);
      return true;
    } catch {
      await sleep(400);
    }
  }
  return false;
}

// Runs before the app renders (see main.tsx): finishes a wipe that could not
// be completed during the last sign-out.
export const firestoreReady: Promise<void> = (async () => {
  let pending = false;
  try { pending = !!localStorage.getItem(PENDING_CACHE_CLEAR_KEY); } catch {}
  if (!pending) return;
  if (await tryClear(1)) {
    markPendingClear(false);
  } else {
    console.warn('[Yaa POS] La caché local se borrará cuando se cierren las demás pestañas.');
  }
})();

export async function wipeLocalFirestoreCache(): Promise<boolean> {
  markPendingClear(true);
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(SESSION_CHANNEL);
  } catch {}

  // 1. Ask every other tab to stop Firestore and wait for their answers.
  if (channel) {
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let lastAck = Date.now();
    let acks = 0;
    channel.onmessage = (ev) => {
      if (ev.data?.type === 'shutdown_ack' && ev.data.requestId === requestId) { acks++; lastAck = Date.now(); }
    };
    channel.postMessage({ type: 'shutdown', requestId, from: TAB_ID });
    const started = Date.now();
    // Wait at least 500 ms, then until 400 ms pass without new answers (max 2.5 s).
    while (Date.now() - started < 2500) {
      await sleep(100);
      if (Date.now() - started >= 500 && Date.now() - lastAck >= 400) break;
    }
    console.info(`[Yaa POS] Pestañas que detuvieron Firestore: ${acks}`);
  }

  // 2. Stop Firestore here and delete the cache.
  try { await terminate(firestoreInstance); } catch {}
  const cleared = await tryClear(5);
  markPendingClear(!cleared);
  if (!cleared) console.warn('[Yaa POS] No se pudo borrar la caché local ahora; se borrará al volver a abrir la app.');

  // 3. Let the other tabs reload (they show the sign-in screen).
  if (channel) {
    channel.postMessage({ type: 'cleared', cleared, from: TAB_ID });
    channel.close();
  }
  return cleared;
}

// Other tabs: stop Firestore when asked, then reload once the cache is gone.
if (typeof BroadcastChannel !== 'undefined') {
  try {
    const listener = new BroadcastChannel(SESSION_CHANNEL);
    let stopped = false;
    listener.onmessage = async (ev) => {
      const msg = ev.data;
      if (!msg || msg.from === TAB_ID) return;
      if (msg.type === 'shutdown' && !stopped) {
        stopped = true;
        try { await terminate(firestoreInstance); } catch {}
        listener.postMessage({ type: 'shutdown_ack', requestId: msg.requestId });
        // Safety net: reload even if the "cleared" message never arrives.
        setTimeout(() => window.location.reload(), 6000);
      } else if (msg.type === 'cleared' && stopped) {
        window.location.reload();
      }
    };
  } catch {}
}

firestoreReady.finally(() => { testConnection().catch(() => {}); });

export { app };

