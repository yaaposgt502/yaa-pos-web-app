import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific custom database ID requested by AI Studio
// Enabled robust persistent local cache (IndexedDB) with multi-tab support for offline compatibility.
// Using experimentalForceLongPolling to ensure robust connectivity in iframe/container environments where WebSockets are restricted
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
