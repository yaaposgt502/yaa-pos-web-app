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
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  waitForPendingWrites
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import productionConfig from '../firebase-applet-config.json';

// =========================================================================
// STAGING (test environment)
// With VITE_USE_EMULATORS=true (npm run dev:staging) the app talks ONLY to
// the local Firebase emulators and uses a fake "demo-" project. Any call
// that is not emulated fails instead of reaching the production project.
// A production build with this flag is refused (vite.config.ts).
// =========================================================================
export const USING_EMULATORS = (import.meta as any).env?.VITE_USE_EMULATORS === 'true';

export const EMULATOR_HOSTS = {
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8085 },
  storage: { host: '127.0.0.1', port: 9199 },
};

export const firebaseConfig = USING_EMULATORS
  ? {
      ...productionConfig,
      projectId: 'demo-yaa-pos',
      apiKey: 'demo-api-key',
      authDomain: 'localhost',
      appId: '1:000000000000:web:demo',
      messagingSenderId: '000000000000',
      measurementId: undefined as unknown as string,
      storageBucket: 'demo-yaa-pos.appspot.com',
      firestoreDatabaseId: '(default)',
    }
  : productionConfig;

// Base URL of the Identity Toolkit REST API (operator accounts).
export const IDENTITY_TOOLKIT_BASE = USING_EMULATORS
  ? `${EMULATOR_HOSTS.auth}/identitytoolkit.googleapis.com`
  : 'https://identitytoolkit.googleapis.com';

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

if (USING_EMULATORS) {
  connectFirestoreEmulator(firestoreInstance, EMULATOR_HOSTS.firestore.host, EMULATOR_HOSTS.firestore.port);
}

export const db = firestoreInstance; /* CRITICAL: The app will break without this database ID */
export const auth = getAuth(app);
export const storage = getStorage(app);

if (USING_EMULATORS) {
  connectAuthEmulator(auth, EMULATOR_HOSTS.auth, { disableWarnings: true });
  connectStorageEmulator(storage, EMULATOR_HOSTS.storage.host, EMULATOR_HOSTS.storage.port);
}

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

// True when this device still has writes (sales, purchases...) saved in the
// local cache that the server has not confirmed. waitForPendingWrites
// resolves at once when there are none; offline it waits until the
// connection returns, so the timeout means "still pending".
export async function hasUnsyncedWrites(timeoutMs = 4000): Promise<boolean> {
  try {
    const synced = await Promise.race([
      waitForPendingWrites(firestoreInstance).then(() => true),
      sleep(timeoutMs).then(() => false),
    ]);
    return !synced;
  } catch {
    // Firestore already stopped: nothing can be pending in this tab.
    return false;
  }
}

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
    let refused = 0;
    channel.onmessage = (ev) => {
      if (ev.data?.requestId !== requestId) return;
      if (ev.data.type === 'shutdown_ack') { acks++; lastAck = Date.now(); }
      if (ev.data.type === 'shutdown_refused') { refused++; lastAck = Date.now(); }
    };
    channel.postMessage({ type: 'shutdown', requestId, from: TAB_ID });
    const started = Date.now();
    // Each tab needs up to 1.5 s to check its unsynced writes: wait at least
    // 2 s, then until 400 ms pass without new answers (max 4 s).
    while (Date.now() - started < 4000) {
      await sleep(100);
      if (Date.now() - started >= 2000 && Date.now() - lastAck >= 400) break;
    }
    console.info(`[Yaa POS] Pestañas que detuvieron Firestore: ${acks}; con datos sin enviar: ${refused}`);
    if (refused > 0) {
      // Another tab still has unsynced writes: deleting the cache would delete
      // them. Keep it; it is deleted on a later sign-out with nothing pending.
      markPendingClear(false);
      channel.postMessage({ type: 'cleared', cleared: false, from: TAB_ID });
      channel.close();
      console.warn('[Yaa POS] Otra pestaña tiene operaciones sin enviar: la caché local no se borró para no perderlas.');
      return false;
    }
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
        // Refuse if this tab still has operations the server has not received.
        if (await hasUnsyncedWrites(1500)) {
          listener.postMessage({ type: 'shutdown_refused', requestId: msg.requestId, from: TAB_ID });
          return;
        }
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

