import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updatePassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { initializeApp, getApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocsFromCache,
  getDocFromCache,
  getDocsFromServer,
  getDocFromServer,
  writeBatch,
  runTransaction,
  increment,
  deleteField,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type WriteBatch,
  type Transaction,
  type DocumentReference
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { auth, db, storage, wipeLocalFirestoreCache, hasUnsyncedWrites, PENDING_CACHE_CLEAR_KEY, firebaseConfig, IDENTITY_TOOLKIT_BASE } from './firebase';
export { hasUnsyncedWrites };
import { Product, Client, Provider, Sale, Purchase, Expense, Shift, UserFile, AppConfig, User, License, Quotation, Consignment, StockMovement } from './types';
import { applySaleItemToProduct, applySaleToShift, applySaleToClient, applyPurchaseItemToProduct, applyTransferOut, applyTransferIn, applyStockAdjustment, toNum } from './utils/inventoryMath';
import { compressDataUrlIfNeeded } from './utils/imageCompressor';
import { checkBranchLimit, checkUserLimit, checkProductLimit, getPlanDefinition } from './utils/planLimits';
import { parseSafeDate, toLocalDateString } from './utils/dateHelper';
import { addPending, markSynced, markRejected, removeEntry, readJournal, rejectedEntries, describeRejection, JOURNAL_BASE_KEY } from './utils/offlineJournal';
import type { JournalEntry, JournalKind, JournalCheck } from './utils/offlineJournal';

// In-memory runtime cache stores to eliminate redundant Firestore queries
let cachedProducts: Product[] | null = null;
let cachedConfig: AppConfig | null = null;
let cachedClients: Client[] | null = null;
let cachedProviders: Provider[] | null = null;
let cachedShifts: Shift[] | null = null;
let cachedRecentSales: Sale[] | null = null;

export function clearMemoryCache() {
  cachedProducts = null;
  cachedConfig = null;
  cachedClients = null;
  cachedProviders = null;
  cachedShifts = null;
  cachedRecentSales = null;
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
  }
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

// Helper to query documents from persistent cache first, then fallback to server
export async function getCollectionDocs<T>(colRef: any): Promise<T[]> {
  try {
    const cacheSnap = await getDocsFromCache(colRef);
    if (!cacheSnap.empty) {
      return cacheSnap.docs.map(doc => doc.data() as T);
    }
  } catch (e) {
    // Silent catch, fallback to server
  }
  const serverSnap = await getDocs(colRef);
  return serverSnap.docs.map(doc => doc.data() as T);
}

// Helper to query single document from persistent cache first, then fallback to server
export async function getDocumentSnap(docRef: any): Promise<any> {
  try {
    const cacheSnap = await getDocFromCache(docRef);
    if (cacheSnap.exists()) {
      return cacheSnap;
    }
  } catch (e) {
    // Silent catch, fallback to server
  }
  return await getDoc(docRef);
}

// Helper to query single document from server first when online (critical for license & auth status across devices)
export async function getFreshDocumentSnap(docRef: any): Promise<any> {
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      return await getDocFromServer(docRef);
    }
  } catch (e) {
    // Fallback to standard getDoc / cache if offline or transient error
  }
  return await getDoc(docRef);
}

// Ensure Firebase Auth state is initialized before executing privileged Firestore queries
export async function ensureAuthReady(): Promise<void> {
  if (auth.currentUser) return;
  await new Promise<void>((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 3000);
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!resolved && (u || !getToken())) {
        resolved = true;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}

export const FIRESTORE_UPGRADE_URL = 'https://console.firebase.google.com/project/gen-lang-client-0858502482/firestore/databases/ai-studio-yaapos-acf1b9d4-de65-4b12-9ecf-bbbe308c617d/data?openUpgradeDialog=true';

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : (error instanceof Error ? error.message : JSON.stringify(error));
  return (
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('Free daily read units') ||
    msg.includes('free tier database') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota metric') ||
    msg.includes('quota checks') ||
    msg.includes('Quota exceeded for quota metric')
  );
}

let apiToken: string | null = localStorage.getItem('yaa_pos_token');

export function setToken(token: string | null) {
  apiToken = token;
  if (token) {
    localStorage.setItem('yaa_pos_token', token);
  } else {
    localStorage.removeItem('yaa_pos_token');
  }
}

export function getToken(): string | null {
  return apiToken;
}

export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem('yaa_pos_user_profile');
    const token = getToken();
    if (!raw || !token) return null;
    const parsed = JSON.parse(raw) as User;
    if (parsed && (parsed.id === token || parsed.id)) {
      return parsed;
    }
  } catch (e) {
    console.warn('Error reading cached user profile:', e);
  }
  return null;
}

export function cacheUser(user: User | null): void {
  try {
    if (user && user.id) {
      localStorage.setItem('yaa_pos_user_profile', JSON.stringify(user));
    } else {
      localStorage.removeItem('yaa_pos_user_profile');
    }
  } catch (e) {
    console.warn('Error saving cached user profile:', e);
  }
}

export function formatNameFromEmail(email: string): string {
  if (!email) return 'Usuario';
  const prefix = email.split('@')[0];
  const clean = prefix.replace(/\d+$/, '').replace(/[._-]/g, ' ').trim();
  if (!clean) {
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return clean
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Local (browser) storage keys that hold company data must be scoped to the
// signed-in company, so two companies using the same browser never see or
// re-upload each other's records. Older unscoped keys are left untouched and
// are no longer read.
export function tenantStorageKey(base: string): string {
  const uid = getToken();
  return uid ? `${base}__${uid}` : `${base}__anon`;
}

// Helper to get collection reference inside the user's isolated document
function getCollectionRef(subcollectionName: string) {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  return collection(db, 'users', uid, subcollectionName);
}

// Helper to get a specific document reference inside the user's isolated path
function getDocRef(subcollectionName: string, docId: string) {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  return doc(db, 'users', uid, subcollectionName, docId);
}

// --- AUTH API ---

export async function registerUser(email: string, name: string, password: string): Promise<{ token: string, user: User }> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const firebaseUser = userCredential.user;

  // Persist name directly in Firebase Auth so auth.currentUser preserves it permanently across reloads
  try {
    await updateProfile(firebaseUser, { displayName: cleanName });
  } catch (profErr) {
    console.warn("Could not set displayName on firebaseUser:", profErr);
  }

  const safeUser: User = {
    id: firebaseUser.uid,
    email: firebaseUser.email || cleanEmail,
    name: cleanName,
    createdAt: new Date().toISOString()
  };
  
  // Save user profile metadata to Firestore
  await setDoc(doc(db, 'users', firebaseUser.uid), safeUser);
  
  // Assign default Básico subscription plan to the new company
  const defaultLicense: License = {
    userId: firebaseUser.uid,
    clientName: cleanName,
    clientEmail: firebaseUser.email || cleanEmail,
    application: 'Yaa POS',
    planType: 'Básico',
    expirationDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'Activa',
    licenseStartDate: new Date().toISOString().split('T')[0],
    maxUsers: 3,
    maxBranches: 1
  };
  try {
    await setDoc(doc(db, 'licenses', firebaseUser.uid), defaultLicense);
    const saved = localStorage.getItem('yaa_pos_licenses');
    let list: License[] = [];
    if (saved) {
      try { list = JSON.parse(saved); } catch {}
    }
    list = [defaultLicense, ...list.filter(l => l.userId !== firebaseUser.uid)];
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(list));
    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
  } catch (licErr) {
    console.warn("Could not set initial license in Firestore:", licErr);
  }

  setToken(firebaseUser.uid);
  cacheUser(safeUser);
  return { token: firebaseUser.uid, user: safeUser };
}

export interface Operator {
  id: string;
  name: string;
  email: string;
  role: string;
  password?: string;
  status: 'active' | 'inactive';
  branch?: string;
  branches?: string[];
  ownerId?: string;
  disabledTabs?: string[];
  passwordProtected?: boolean;
  // Firebase Auth UID the operator record is bound to (see firestore.rules).
  authUid?: string;
}

// Helper to register operator accounts in standard Firebase Auth with real passwords.
// Returns the Firebase Auth UID when it could be confirmed (new account, or the
// password given matches the existing account); otherwise undefined.
export async function provisionOperatorAuth(email: string, password?: string, oldPassword?: string): Promise<string | undefined> {
  const normalizedEmail = email.trim().toLowerCase();
  const apiKey = firebaseConfig.apiKey;
  
  if (!password || !password.trim()) {
    return undefined;
  }
  
  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres para ser válida en el sistema de autenticación.');
  }

  // 1. Try to register new user in Firebase Auth via Identity Toolkit
  const signUpUrl = `${IDENTITY_TOOLKIT_BASE}/v1/accounts:signUp?key=${apiKey}`;
  const res = await fetch(signUpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: normalizedEmail,
      password: trimmedPassword,
      returnSecureToken: true
    })
  });
  
  const data = await res.json();
  
  if (res.ok) {
    return typeof data.localId === 'string' ? data.localId : undefined;
  }

  const errorMsg = data.error?.message;
  if (errorMsg === 'EMAIL_EXISTS') {
    const signInUrl = `${IDENTITY_TOOLKIT_BASE}/v1/accounts:signInWithPassword?key=${apiKey}`;
    
    // 2. Check if user already has this exact password
    const checkCurrent = await fetch(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        password: trimmedPassword,
        returnSecureToken: true
      })
    });
    if (checkCurrent.ok) {
      const currentData = await checkCurrent.json().catch(() => ({}));
      return typeof currentData.localId === 'string' ? currentData.localId : undefined;
    }

    // 3. If oldPassword was provided, sign in and update to new password
    if (oldPassword && oldPassword !== trimmedPassword) {
      try {
        const signInOld = await fetch(signInUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            password: oldPassword,
            returnSecureToken: true
          })
        });
        const oldData = await signInOld.json();
        if (signInOld.ok && oldData.idToken) {
          const updateUrl = `${IDENTITY_TOOLKIT_BASE}/v1/accounts:update?key=${apiKey}`;
          const updateRes = await fetch(updateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: oldData.idToken,
              password: trimmedPassword,
              returnSecureToken: true
            })
          });
          if (updateRes.ok) {
            return typeof oldData.localId === 'string' ? oldData.localId : undefined;
          }
        }
      } catch (err) {
        console.warn("Failed to update password with oldPassword:", err);
      }
    }

    // 4. Send official password reset email if it could not be updated directly
    try {
      await sendPasswordReset(normalizedEmail);
    } catch (resetErr) {
      console.warn("Password reset email dispatch:", resetErr);
    }
    return undefined;
  }

  if (errorMsg && (errorMsg.includes('WEAK_PASSWORD') || errorMsg.includes('Password should be at least 6 characters'))) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  if (errorMsg === 'INVALID_EMAIL') {
    throw new Error('El correo electrónico no tiene un formato válido.');
  }

  throw new Error(data.error?.message || 'Error al registrar credenciales en el sistema de autenticación');
}

// Official, secure Firebase Auth password reset service
export async function sendPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Correo electrónico requerido');
  await sendPasswordResetEmail(auth, normalizedEmail);
}

export function isLicenseDateExpired(expirationDate?: string): boolean {
  if (!expirationDate) return false;
  const cleanExp = String(expirationDate).split('T')[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanExp)) return false;
  const todayStr = toLocalDateString();
  return cleanExp < todayStr;
}

export function resolveCompanyLicenseState(
  lic?: License | null | any,
  targetUser?: User | null | any
): 'Pendiente' | 'Activa' | 'Por vencer' | 'Expirada' | 'Suspendida' | 'Desactivada' {
  const rawLicStatus = String(lic?.status || '').trim().toLowerCase();
  const rawAccStatus = String(targetUser?.accountStatus || '').trim().toLowerCase();

  // If a license record exists with an explicit status, use it as the primary authority
  if (rawLicStatus) {
    if (rawLicStatus === 'suspendida' || rawLicStatus === 'suspendido') {
      return 'Suspendida';
    }
    if (rawLicStatus === 'desactivada' || rawLicStatus === 'desactivado') {
      return 'Desactivada';
    }
    if (rawLicStatus === 'pendiente') {
      return 'Pendiente';
    }
    if (rawLicStatus === 'expirada' || rawLicStatus === 'expirado' || rawLicStatus === 'vencida' || rawLicStatus === 'vencido') {
      return 'Expirada';
    }
  } else {
    // Fallback to user profile accountStatus only when license status is not present
    if (rawAccStatus === 'suspendida' || rawAccStatus === 'suspendido') {
      return 'Suspendida';
    }
    if (rawAccStatus === 'desactivada' || rawAccStatus === 'desactivado') {
      return 'Desactivada';
    }
  }

  // Date expiration check (local YYYY-MM-DD)
  if (lic?.expirationDate && isLicenseDateExpired(lic.expirationDate)) {
    return 'Expirada';
  }

  return 'Activa';
}

export function performValidation(lic: License | null | any, currentUser: User | null | any): { isBlocked: boolean; reason: string } {
  if (!currentUser) return { isBlocked: false, reason: '' };
  if (currentUser.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') return { isBlocked: false, reason: '' };

  const state = resolveCompanyLicenseState(lic, currentUser);

  if (state === 'Suspendida') {
    return {
      isBlocked: true,
      reason: 'Su cuenta ha sido suspendida por el administrador.'
    };
  }
  if (state === 'Desactivada') {
    return {
      isBlocked: true,
      reason: 'Su cuenta ha sido desactivada. Comuníquese con el administrador.'
    };
  }
  if (state === 'Pendiente') {
    return {
      isBlocked: true,
      reason: 'Su cuenta aún no ha sido autorizada por el administrador.'
    };
  }
  if (state === 'Expirada') {
    return {
      isBlocked: true,
      reason: 'Su licencia ha expirado. No puede utilizar el sistema hasta que el administrador la renueve.'
    };
  }

  return { isBlocked: false, reason: '' };
}

export async function loginUser(email: string, password: string): Promise<{ token: string, user: User }> {
  // First, authenticate with standard Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;
  const normalizedEmail = (firebaseUser.email || email).trim().toLowerCase();
  
  // Check if this user is configured as an operator globally or in owner subcollections
  try {
    let opData: Operator | null = null;
    const globalRef = doc(db, 'operators', normalizedEmail);
    const opSnap = await getFreshDocumentSnap(globalRef);
    if (opSnap.exists()) {
      opData = opSnap.data() as Operator;
    }

    if (opData) {
      if (opData.status !== 'active') {
        await signOut(auth);
        throw new Error('Su cuenta de operador ha sido desactivada por el administrador.');
      }
      
      const ownerId = opData.ownerId;
      if (!ownerId) throw new Error('Operador sin propietario asignado');
      
      // Load the owner's profile info directly from server when online
      const userDoc = await getFreshDocumentSnap(doc(db, 'users', ownerId));
      const baseUser = userDoc.exists() ? (userDoc.data() as User) : { id: ownerId, name: 'Propietario / Administrador', email: '' };
      
      // Validate the owner's account status and license directly from server when online
      if (ownerId !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
        const licenseDoc = await getFreshDocumentSnap(doc(db, 'licenses', ownerId));
        const license = licenseDoc.exists() ? licenseDoc.data() as License : null;
        const validation = performValidation(license, baseUser);
        if (validation.isBlocked) {
          await signOut(auth);
          throw new Error(validation.reason);
        }
      }

      const safeUser: User = {
        ...baseUser,
        id: ownerId,
        name: opData.name || firebaseUser.displayName || formatNameFromEmail(normalizedEmail),
        email: opData.email || normalizedEmail,
        role: opData.role || 'Cajero',
        isOperator: true,
        operatorId: opData.id,
        branch: opData.branch,
        branches: opData.branches || (opData.branch && opData.branch !== 'Todas' ? [opData.branch] : []),
        disabledTabs: opData.disabledTabs || []
      };
      
      setToken(ownerId);
      localStorage.setItem('yaa_pos_operator_email', opData.email);
      cacheUser(safeUser);
      return { token: ownerId, user: safeUser };
    }
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw err;
    }
    if (err instanceof Error && (err.message.includes('desactivada') || err.message.includes('suspendida') || err.message.includes('licencia') || err.message.includes('expirado') || err.message.includes('autorizada'))) {
      throw err;
    }
    console.warn("Operator profile load failed, treating as standard owner:", err);
  }

  // Treat as standard user (owner) - fetch fresh from server when online
  const userDoc = await getFreshDocumentSnap(doc(db, 'users', firebaseUser.uid));
  let safeUser: User;
  if (userDoc.exists()) {
    safeUser = userDoc.data() as User;
    // Heal missing or generic name if needed
    if (!safeUser.name || safeUser.name.trim() === 'Usuario Yaa POS') {
      let resolvedName = firebaseUser.displayName;
      if (!resolvedName || resolvedName.trim() === 'Usuario Yaa POS') {
        const licDoc = await getFreshDocumentSnap(doc(db, 'licenses', firebaseUser.uid)).catch(() => null);
        if (licDoc && licDoc.exists() && licDoc.data().clientName && licDoc.data().clientName !== 'Empresa') {
          resolvedName = licDoc.data().clientName;
        }
      }
      if (!resolvedName || resolvedName.trim() === 'Usuario Yaa POS') {
        resolvedName = formatNameFromEmail(normalizedEmail);
      }
      safeUser.name = resolvedName;
      await setDoc(doc(db, 'users', firebaseUser.uid), cleanDataForFirestore(safeUser), { merge: true }).catch(() => {});
    }
    if (!safeUser.email) {
      safeUser.email = normalizedEmail;
      await setDoc(doc(db, 'users', firebaseUser.uid), cleanDataForFirestore(safeUser), { merge: true }).catch(() => {});
    }
    if (!safeUser.createdAt) {
      safeUser.createdAt = new Date().toISOString();
      await setDoc(doc(db, 'users', firebaseUser.uid), cleanDataForFirestore(safeUser), { merge: true }).catch(() => {});
    }
  } else {
    let resolvedName = firebaseUser.displayName;
    if (!resolvedName || resolvedName.trim() === 'Usuario Yaa POS') {
      const licDoc = await getFreshDocumentSnap(doc(db, 'licenses', firebaseUser.uid)).catch(() => null);
      if (licDoc && licDoc.exists() && licDoc.data().clientName && licDoc.data().clientName !== 'Empresa') {
        resolvedName = licDoc.data().clientName;
      }
    }
    if (!resolvedName || resolvedName.trim() === 'Usuario Yaa POS') {
      resolvedName = formatNameFromEmail(normalizedEmail);
    }
    safeUser = {
      id: firebaseUser.uid,
      email: normalizedEmail,
      name: resolvedName,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), cleanDataForFirestore(safeUser)).catch(() => {});
  }

  // Ensure Firebase Auth displayName is synchronized in Auth persistence
  if (safeUser.name && (!firebaseUser.displayName || firebaseUser.displayName !== safeUser.name)) {
    try {
      await updateProfile(firebaseUser, { displayName: safeUser.name });
    } catch {}
  }

  // Validate standard owner profile and license status from live server document
  if (firebaseUser.uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    const licenseDoc = await getFreshDocumentSnap(doc(db, 'licenses', firebaseUser.uid));
    const license = licenseDoc.exists() ? licenseDoc.data() as License : null;
    const validation = performValidation(license, safeUser);
    if (validation.isBlocked) {
      await signOut(auth);
      throw new Error(validation.reason);
    }
  }
  
  setToken(firebaseUser.uid);
  localStorage.removeItem('yaa_pos_operator_email');
  cacheUser(safeUser);
  return { token: firebaseUser.uid, user: safeUser };
}

export async function logoutUser(): Promise<void> {
  // Never schedule the cache wipe while this device has unsynced writes:
  // deleting the cache would delete them.
  const unsynced = await hasUnsyncedWrites(1500);
  clearMemoryCache();
  await signOut(auth);
  setToken(null);
  cacheUser(null);
  localStorage.removeItem('yaa_pos_operator_email');
  // Remove company data cached in this browser so the next person who signs in
  // here does not inherit it.
  try {
    localStorage.removeItem('yaa_pos_branch_sync_event');
    localStorage.removeItem('yaa_pos_active_branch_id');
    localStorage.removeItem('yaa_pos_licenses');
    // If this sign-out does not wipe the cache right away (automatic sign-out
    // of a blocked account), the next page load does it before reading data.
    if (!unsynced) localStorage.setItem(PENDING_CACHE_CLEAR_KEY, String(Date.now()));
  } catch {}
  window.dispatchEvent(new Event('yaa_pos_logout'));
}

// Merges only the given fields into the store configuration, leaving the
// rest of the document as it is on the server.
export async function updateConfigFields(fields: Partial<AppConfig>): Promise<void> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  const clean = cleanDataForFirestore(fields);
  const docRef = doc(db, 'users', uid, 'configs', 'storeConfig');
  const write = setDoc(docRef, clean, { merge: true });
  if (cachedConfig) cachedConfig = { ...cachedConfig, ...clean };
  if (isLikelyOffline()) {
    write.catch(err => console.error('[Yaa POS] Error al sincronizar la configuración:', err));
    return;
  }
  await write;
}

// Reads one list of the store configuration directly from the server.
// Returns 'unknown' when the server cannot be reached.
export async function getConfigListFromServer(field: keyof AppConfig): Promise<unknown[] | null | 'unknown'> {
  const uid = getToken();
  if (!uid || isLikelyOffline()) return 'unknown';
  try {
    const snap = await getDocFromServer(doc(db, 'users', uid, 'configs', 'storeConfig'));
    const value = snap.exists() ? (snap.data() as any)[field] : undefined;
    return Array.isArray(value) ? value : null;
  } catch {
    return 'unknown';
  }
}

// One-time import of a list that older versions kept only in this browser
// (combos, services, promotions, laboratories). It is written only if the
// company's configuration does not have that list yet, checked on the server.
export async function importLegacyConfigList(field: keyof AppConfig, items: unknown[]): Promise<boolean> {
  const uid = getToken();
  if (!uid || isLikelyOffline()) return false;
  const docRef = doc(db, 'users', uid, 'configs', 'storeConfig');
  return runTransaction(db, async (tx: Transaction) => {
    const snap = await tx.get(docRef);
    if (snap.exists() && Array.isArray((snap.data() as any)[field])) return false;
    tx.set(docRef, cleanDataForFirestore({ [field]: items }), { merge: true });
    return true;
  });
}

// True only for the company owner: the signed-in Firebase account IS the
// company (operators sign in with their own account, whose UID differs from
// the company UID). Does not rely on the cached isOperator flag, which is also
// true for owners that have an operator record of themselves.
export function isAccountOwner(): boolean {
  const companyId = getToken();
  return !!companyId && auth.currentUser?.uid === companyId;
}

// Deletes the company data Firestore keeps in this browser (IndexedDB cache)
// in this tab and every other open tab (see wipeLocalFirestoreCache). The
// caller must reload the page afterwards.
export async function clearLocalCompanyCache(): Promise<boolean> {
  clearMemoryCache();
  return wipeLocalFirestoreCache();
}

export async function getMe(): Promise<User> {
  // Ensure Firebase Auth is loaded to prevent race conditions on page refresh (with 3-second safety timeout)
  if (!auth.currentUser) {
    await new Promise<void>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 3000);

      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (!resolved && (user || !getToken())) {
          resolved = true;
          clearTimeout(timer);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  const uid = getToken();
  if (!uid) {
    throw new Error('No hay sesión activa');
  }

  const firebaseUser = auth.currentUser;
  const cachedUser = getCachedUser();

  // If there is no authenticated Firebase session, do not make unauthenticated Firestore calls
  if (!firebaseUser) {
    if (cachedUser && (cachedUser.id === uid || cachedUser.id)) {
      return cachedUser;
    }
    throw new Error('Sesión expirada. Inicie sesión nuevamente.');
  }

  const userEmail = (firebaseUser.email || cachedUser?.email || '').toLowerCase().trim();

  // 1. Check if user is an operator (global collection or owner's subcollection)
  if (userEmail) {
    try {
      let opData: Operator | null = null;
      
      // Global operators lookup
      const globalRef = doc(db, 'operators', userEmail);
      const opSnap = await getFreshDocumentSnap(globalRef);
      if (opSnap.exists()) {
        opData = opSnap.data() as Operator;
      } else {
        // Fallback: check tenant's operator subcollection
        const tenantOpRef = doc(db, 'users', uid, 'operators', userEmail);
        const tenantOpSnap = await getFreshDocumentSnap(tenantOpRef);
        if (tenantOpSnap.exists()) {
          opData = tenantOpSnap.data() as Operator;
        }
      }

      if (opData) {
        if (opData.status !== 'active') {
          throw new Error('Su cuenta de operador ha sido desactivada por el administrador.');
        }

        const userDoc = await getFreshDocumentSnap(doc(db, 'users', uid));
        const baseUser = userDoc.exists() 
          ? (userDoc.data() as User) 
          : { id: uid, name: opData.name || 'Operador', email: userEmail };
        
        // Validate block/suspension for the owner in operator session
        if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
          const licenseDoc = await getFreshDocumentSnap(doc(db, 'licenses', uid));
          const license = licenseDoc.exists() ? licenseDoc.data() as License : null;
          const validation = performValidation(license, baseUser);
          if (validation.isBlocked) {
            throw new Error(validation.reason);
          }
        }

        const resolvedOperator: User = {
          ...baseUser,
          id: uid,
          name: opData.name || firebaseUser.displayName || formatNameFromEmail(userEmail),
          email: opData.email || userEmail,
          role: opData.role || 'Cajero',
          isOperator: true,
          operatorId: opData.id,
          branch: opData.branch,
          branches: opData.branches || (opData.branch && opData.branch !== 'Todas' ? [opData.branch] : []),
          disabledTabs: opData.disabledTabs || []
        };
        cacheUser(resolvedOperator);
        return resolvedOperator;
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        throw err;
      }
      if (err instanceof Error && (err.message.includes('desactivada') || err.message.includes('suspendida') || err.message.includes('licencia') || err.message.includes('expirado') || err.message.includes('autorizada'))) {
        throw err;
      }
      console.warn("Failed to reconstruct operator profile, falling back to base user:", err);
    }
  }

  // 2. Standard user (owner) identity recovery
  let userData: User | null = null;
  try {
    const userDoc = await getFreshDocumentSnap(doc(db, 'users', uid));
    if (userDoc.exists()) {
      userData = userDoc.data() as User;
    }
  } catch (err) {
    console.warn("Could not fetch user document from Firestore:", err);
  }

  let resolvedName = '';
  if (userData?.name && userData.name.trim() !== 'Usuario Yaa POS') {
    resolvedName = userData.name.trim();
  } else if (firebaseUser.displayName && firebaseUser.displayName.trim() !== 'Usuario Yaa POS') {
    resolvedName = firebaseUser.displayName.trim();
  } else if (cachedUser && cachedUser.id === uid && cachedUser.name && cachedUser.name.trim() !== 'Usuario Yaa POS') {
    resolvedName = cachedUser.name.trim();
  }

  if (!resolvedName || resolvedName === 'Usuario Yaa POS') {
    try {
      const licDoc = await getFreshDocumentSnap(doc(db, 'licenses', uid));
      if (licDoc.exists()) {
        const licData = licDoc.data() as License;
        if (licData.clientName && licData.clientName !== 'Empresa' && licData.clientName.trim() !== 'Usuario Yaa POS') {
          resolvedName = licData.clientName.trim();
        }
      }
    } catch {}
  }

  if (!resolvedName || resolvedName === 'Usuario Yaa POS') {
    try {
      const opSnapshot = await getDocs(collection(db, 'users', uid, 'operators'));
      const adminOp = opSnapshot.docs.find(d => {
        const dData = d.data();
        return dData.role === 'Propietario / Administrador' || dData.id === '1';
      });
      if (adminOp && adminOp.data()?.name && adminOp.data().name.trim() !== 'Usuario Yaa POS') {
        resolvedName = adminOp.data().name.trim();
      }
    } catch {}
  }

  if (!resolvedName || resolvedName === 'Usuario Yaa POS') {
    resolvedName = formatNameFromEmail(userEmail);
  }

  const resolvedEmail = userData?.email || userEmail || cachedUser?.email || '';

  const safeUser: User = {
    ...(userData || {}),
    id: uid,
    name: resolvedName,
    email: resolvedEmail,
    createdAt: userData?.createdAt || new Date().toISOString()
  };

  // Sync back to Firestore if name or email was restored/corrected
  if (!userData || userData.name !== resolvedName || userData.email !== resolvedEmail) {
    setDoc(doc(db, 'users', uid), cleanDataForFirestore(safeUser), { merge: true }).catch(() => {});
  }

  // Sync to Firebase Auth displayName
  if (firebaseUser && (!firebaseUser.displayName || firebaseUser.displayName !== resolvedName)) {
    try {
      updateProfile(firebaseUser, { displayName: resolvedName }).catch(() => {});
    } catch {}
  }

  // Validate standard owner profile and license status from live server document
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    const licenseDoc = await getFreshDocumentSnap(doc(db, 'licenses', uid));
    const license = licenseDoc.exists() ? licenseDoc.data() as License : null;
    const validation = performValidation(license, safeUser);
    if (validation.isBlocked) {
      throw new Error(validation.reason);
    }
  }

  cacheUser(safeUser);
  return safeUser;
}

// --- OPERATORS REAL API ---
export async function getOperators(): Promise<Operator[]> {
  const uid = getToken();
  if (!uid) return [];
  try {
    const snapshot = await getDocs(getCollectionRef('operators'));
    let list = snapshot.docs.map(doc => doc.data() as Operator);
    
    // Get the real owner's profile details to seed or dynamic correction
    const userDoc = await getDoc(doc(db, 'users', uid));
    const baseUser = userDoc.exists() ? (userDoc.data() as User) : { id: uid, name: 'Propietario / Administrador', email: '' };

    // Detect if this is an owner/admin session to get the most accurate current credentials from Auth
    const isOperatorSession = !!localStorage.getItem('yaa_pos_operator_email');
    const authEmail = (!isOperatorSession && auth.currentUser?.email) ? auth.currentUser.email : '';
    const authName = (!isOperatorSession && auth.currentUser?.displayName) ? auth.currentUser.displayName : '';

    const correctEmail = baseUser.email || authEmail || 'propietario@yaapos.com';
    const correctName = baseUser.name || authName || 'Propietario / Administrador';

    // Clean up legacy fictitious operators if present in Firestore (cajero1@yaapos.com, almacen@yaapos.com)
    const cleanedList = list.filter(op => {
      const email = (op.email || '').toLowerCase();
      if (email === 'cajero1@yaapos.com' || email === 'almacen@yaapos.com') {
        try {
          deleteDoc(doc(db, 'users', uid, 'operators', email));
          deleteDoc(doc(db, 'operators', email));
        } catch {}
        return false;
      }
      return true;
    });

    if (cleanedList.length === 0) {
      // Default to only the authenticated owner, protected by Firebase Auth
      const ownerOp: Operator = { 
        id: '1', 
        name: correctName, 
        email: correctEmail, 
        role: 'Propietario / Administrador', 
        status: 'active', 
        branch: 'Todas',
        ownerId: uid,
        disabledTabs: [],
        passwordProtected: true
      };
      await saveOperator(ownerOp);
      return [ownerOp];
    }

    // Dynamic retroactive correction and real password security assurance
    const correctedList = await Promise.all(cleanedList.map(async (op) => {
      const isOwner = op.role === 'Propietario / Administrador' || op.email === 'juancastr19.14@gmail.com' || op.id === '1';
      
      // Strictly ensure passwords are never stored in plaintext in Firestore
      const hasStalePlaintextPassword = !!op.password;

      const updatedOp: Operator = {
        ...op,
        name: isOwner ? correctName : op.name,
        email: isOwner ? correctEmail : op.email,
        password: undefined, // Never store or expose plaintext passwords
        passwordProtected: true
      };

      // If document had a stale plaintext password or owner details changed, clean it in Firestore
      if (hasStalePlaintextPassword || (isOwner && (op.email !== correctEmail || op.name !== correctName))) {
        if (isOwner && op.email && op.email.toLowerCase() !== correctEmail.toLowerCase()) {
          const oldNormalized = op.email.toLowerCase();
          try {
            await deleteDoc(doc(db, 'users', uid, 'operators', oldNormalized));
            await deleteDoc(doc(db, 'operators', oldNormalized));
          } catch (delErr) {
            console.warn("Failed to delete stale admin operator doc:", delErr);
          }
        }

        try {
          await saveOperator(updatedOp);
        } catch (e) {
          console.error("Failed to clean operator document:", e);
        }
      }

      return updatedOp;
    }));

    // Filter out duplicates by operator id or email to ensure we never have non-unique keys in React
    const uniqueList: Operator[] = [];
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    for (const op of correctedList) {
      if (!op || !op.id || !op.email) continue;
      const normalizedEmail = op.email.toLowerCase();
      if (!seenIds.has(op.id) && !seenEmails.has(normalizedEmail)) {
        seenIds.add(op.id);
        seenEmails.add(normalizedEmail);
        uniqueList.push(op);
      } else {
        // If it's a duplicate entry under a different email/ID, delete it from Firestore
        if (op.email.toLowerCase() !== correctEmail.toLowerCase()) {
          try {
            await deleteDoc(doc(db, 'users', uid, 'operators', normalizedEmail));
            await deleteDoc(doc(db, 'operators', normalizedEmail));
          } catch (delErr) {
            console.warn("Deleted duplicate operator on key conflict error:", delErr);
          }
        }
      }
    }

    return uniqueList;
  } catch (error) {
    console.error('Error fetching operators:', error);
    return [];
  }
}

export async function saveOperator(operator: Operator): Promise<Operator> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado');
  
  const normalizedEmail = operator.email.toLowerCase().trim();
  const rawPassword = operator.password;

  // Validate plan limit on total users (owner + operators)
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    const existingSnap = await getDoc(doc(db, 'users', uid, 'operators', normalizedEmail));
    if (!existingSnap.exists()) {
      const allOpsSnap = await getDocs(getCollectionRef('operators'));
      const currentOpCount = allOpsSnap.docs.length;
      const totalUsers = currentOpCount + 1; // owner + existing operators
      const lic = await getUserLicense(uid);
      const userCheck = checkUserLimit(totalUsers, lic?.planType);
      if (!userCheck.allowed) {
        throw new Error(userCheck.message);
      }
    }
  }

  // Retrieve existing operator to get oldPassword if updating
  let oldPassword: string | undefined;
  try {
    const existingSnap = await getDoc(doc(db, 'operators', normalizedEmail));
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as Operator;
      oldPassword = existingData.password;
    }
  } catch {}

  // Keep the Auth UID this operator is already bound to, if any.
  let authUid: string | undefined;
  let tenantRecordExisted = false;
  try {
    const tenantSnap = await getDoc(doc(db, 'users', uid, 'operators', normalizedEmail));
    if (tenantSnap.exists()) {
      tenantRecordExisted = true;
      const existingAuthUid = (tenantSnap.data() as Operator).authUid;
      if (typeof existingAuthUid === 'string' && existingAuthUid) authUid = existingAuthUid;
    }
  } catch {}

  // Provision real credentials in Firebase Auth if a valid password is provided.
  // When the account's UID is confirmed, bind the operator record to it.
  if (rawPassword && rawPassword.trim()) {
    const confirmedUid = await provisionOperatorAuth(normalizedEmail, rawPassword.trim(), oldPassword);
    if (confirmedUid) authUid = confirmedUid;
  }

  // Strictly enforce security: NEVER save passwords in plain text in Firestore.
  // Passwords are authenticated and encrypted exclusively in Firebase Authentication.
  const opToSave: any = {
    id: operator.id,
    name: operator.name.trim(),
    email: normalizedEmail,
    role: operator.role,
    status: operator.status || 'active',
    branch: operator.branch || 'Todas',
    branches: operator.branches || [],
    disabledTabs: operator.disabledTabs || [],
    ownerId: uid,
    passwordProtected: true
  };
  if (authUid) opToSave.authUid = authUid;
  
  // 1. Save in the owner's isolated subcollection using email as doc ID
  await setDoc(doc(db, 'users', uid, 'operators', normalizedEmail), opToSave);
  
  // 2. Save in the global collection for login lookup
  const globalRef = doc(db, 'operators', normalizedEmail);
  try {
    await setDoc(globalRef, opToSave);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      // The global record belongs to another company: undo the tenant copy
      // we just created (an existing record is left as it was).
      if (!tenantRecordExisted) {
        await deleteDoc(doc(db, 'users', uid, 'operators', normalizedEmail)).catch(() => {});
      }
      throw new Error('Este correo ya está registrado como operador de otra empresa. Usa un correo distinto.');
    }
    throw err;
  }
  
  return opToSave as Operator;
}

export async function deleteOperator(id: string, email: string): Promise<void> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado');
  
  const normalizedEmail = email.toLowerCase();
  
  // 1. Delete from owner's operators subcollection
  await deleteDoc(doc(db, 'users', uid, 'operators', normalizedEmail));
  
  // 2. Delete from global operators collection
  const globalRef = doc(db, 'operators', normalizedEmail);
  await deleteDoc(globalRef);
}

// --- ADMIN API ---

export async function getAdminUsers(): Promise<User[]> {
  await ensureAuthReady();
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    const colRef = collection(db, 'users');
    let snapshot;
    try {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        snapshot = await getDocsFromServer(colRef);
      } else {
        snapshot = await getDocs(colRef);
      }
    } catch {
      snapshot = await getDocs(colRef);
    }
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id
      } as User;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function getAdminUserFiles(userId: string): Promise<UserFile[]> {
  await ensureAuthReady();
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'files'));
    return snapshot.docs.map(docSnap => docSnap.data() as UserFile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/files`);
  }
}

export async function getAdminLicenses(): Promise<License[]> {
  await ensureAuthReady();
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  const colRef = collection(db, 'licenses');
  let snapshot;
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      snapshot = await getDocsFromServer(colRef);
    } else {
      snapshot = await getDocs(colRef);
    }
  } catch {
    snapshot = await getDocs(colRef);
  }
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data() as License;
    return {
      ...data,
      userId: data.userId || docSnap.id
    };
  });
}

export function subscribeAdminUsers(callback: (users: User[]) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  ensureAuthReady().then(() => {
    if (cancelled) return;
    const uid = getToken();
    if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') return;
    try {
      unsub = onSnapshot(
        collection(db, 'users'),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (snapshot.metadata.fromCache && typeof navigator !== 'undefined' && navigator.onLine && snapshot.empty) {
            return;
          }
          const list = snapshot.docs.map(docSnap => ({
            ...(docSnap.data() as User),
            id: docSnap.id
          }));
          callback(list);
        },
        (error) => {
          console.error('Error listening to admin users in Firestore:', error);
        }
      );
    } catch (error) {
      console.error('Error subscribing to admin users:', error);
    }
  });
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export function subscribeAdminLicenses(callback: (licenses: License[]) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  ensureAuthReady().then(() => {
    if (cancelled) return;
    const uid = getToken();
    if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') return;
    try {
      unsub = onSnapshot(
        collection(db, 'licenses'),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (snapshot.metadata.fromCache && typeof navigator !== 'undefined' && navigator.onLine && snapshot.empty) {
            return;
          }
          const list = snapshot.docs.map(docSnap => {
            const data = docSnap.data() as License;
            return {
              ...data,
              userId: data.userId || docSnap.id
            };
          });
          callback(list);
        },
        (error) => {
          console.error('Error listening to admin licenses in Firestore:', error);
        }
      );
    } catch (error) {
      console.error('Error subscribing to admin licenses:', error);
    }
  });
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export async function saveAdminLicense(license: License): Promise<License> {
  await ensureAuthReady();
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    const cleanLic = cleanDataForFirestore({
      ...license,
      userId: license.userId || license.id || ''
    });
    await setDoc(doc(db, 'licenses', cleanLic.userId), cleanLic, { merge: true });
    return cleanLic;
  } catch (error) {
    console.error('Error saving admin license to Firestore:', error);
    throw error;
  }
}

export async function saveAdminUser(user: User): Promise<User> {
  await ensureAuthReady();
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    const cleanUser = cleanDataForFirestore(user);
    await setDoc(doc(db, 'users', cleanUser.id), cleanUser, { merge: true });
    return cleanUser;
  } catch (error) {
    console.error('Error saving admin user to Firestore:', error);
    throw error;
  }
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await ensureAuthReady();
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    await deleteDoc(doc(db, 'users', userId));
    await deleteDoc(doc(db, 'licenses', userId));
  } catch (error) {
    console.error('Error deleting user from Firestore:', error);
    throw error;
  }
}

export async function getUserLicense(userId: string): Promise<License | null> {
  try {
    await ensureAuthReady();
    const docSnap = await getFreshDocumentSnap(doc(db, 'licenses', userId));
    if (docSnap.exists()) {
      const data = docSnap.data() as License;
      return {
        ...data,
        userId: data.userId || docSnap.id
      };
    }
    // Automatically seed default Básico license if none exists on server
    const userSnap = await getFreshDocumentSnap(doc(db, 'users', userId));
    const uData = userSnap.exists() ? userSnap.data() as User : null;
    const initialStatus = uData?.accountStatus === 'Suspendida' ? 'Suspendida' : 'Activa';
    const defaultLic: License = {
      userId,
      clientName: uData?.name || 'Empresa',
      clientEmail: uData?.email || '',
      application: 'Yaa POS',
      planType: 'Básico',
      expirationDate: toLocalDateString(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
      status: initialStatus,
      licenseStartDate: toLocalDateString(),
      maxUsers: 3,
      maxBranches: 1
    };
    try {
      await setDoc(doc(db, 'licenses', userId), cleanDataForFirestore(defaultLic));
    } catch {}
    return defaultLic;
  } catch (error) {
    console.error('Error fetching user license from Firestore:', error);
    return null;
  }
}

export async function changeUserPlan(userId: string, newPlanType: string): Promise<License> {
  const planDef = getPlanDefinition(newPlanType);
  const currentLic = await getUserLicense(userId);
  const updatedLicense: License = {
    ...(currentLic || {}),
    userId,
    clientName: currentLic?.clientName || 'Empresa',
    clientEmail: currentLic?.clientEmail || '',
    application: 'Yaa POS',
    planType: planDef.name,
    maxUsers: planDef.maxUsers,
    maxBranches: planDef.maxBranches,
    expirationDate: currentLic?.expirationDate || toLocalDateString(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
    status: currentLic?.status || 'Activa',
    licenseStartDate: currentLic?.licenseStartDate || toLocalDateString()
  };

  await setDoc(doc(db, 'licenses', userId), cleanDataForFirestore(updatedLicense), { merge: true });

  // Sync locally
  const saved = localStorage.getItem('yaa_pos_licenses');
  let list: License[] = [];
  if (saved) {
    try { list = JSON.parse(saved); } catch {}
  }
  const idx = list.findIndex(l => l.userId === userId);
  if (idx >= 0) list[idx] = updatedLicense;
  else list.push(updatedLicense);
  localStorage.setItem('yaa_pos_licenses', JSON.stringify(list));
  window.dispatchEvent(new Event('yaa_pos_licenses_updated'));

  return updatedLicense;
}

export function subscribeUserLicense(userId: string, callback: (license: License | null) => void): () => void {
  try {
    const docRef = doc(db, 'licenses', userId);
    if (typeof navigator === 'undefined' || navigator.onLine) {
      getDocFromServer(docRef)
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data() as License;
            callback({ ...data, userId: data.userId || snap.id });
          }
        })
        .catch(() => {});
    }
    const unsub = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (docSnap) => {
        if (docSnap.metadata.fromCache && typeof navigator !== 'undefined' && navigator.onLine) {
          return;
        }
        if (docSnap.exists()) {
          const data = docSnap.data() as License;
          callback({ ...data, userId: data.userId || docSnap.id });
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error listening to user license in Firestore:', error);
      }
    );
    return unsub;
  } catch (error) {
    console.error('Error subscribing to user license:', error);
    return () => {};
  }
}

export function subscribeUserProfile(userId: string, callback: (user: User | null) => void): () => void {
  try {
    const docRef = doc(db, 'users', userId);
    if (typeof navigator === 'undefined' || navigator.onLine) {
      getDocFromServer(docRef)
        .then((snap) => {
          if (snap.exists()) {
            callback({ ...(snap.data() as User), id: snap.id });
          }
        })
        .catch(() => {});
    }
    const unsub = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (docSnap) => {
        if (docSnap.metadata.fromCache && typeof navigator !== 'undefined' && navigator.onLine) {
          return;
        }
        if (docSnap.exists()) {
          callback({ ...(docSnap.data() as User), id: docSnap.id });
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error listening to user profile in Firestore:', error);
      }
    );
    return unsub;
  } catch (error) {
    console.error('Error subscribing to user profile:', error);
    return () => {};
  }
}

// Helper to remove any undefined fields before writing to Firestore
export function cleanDataForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data, (key, value) => {
    return value === undefined ? undefined : value;
  }));
}

// --- CLOUD CRUD API (Isolated under /users/{userId}/... for complete security) ---

// --- CLOUD CRUD API (Optimized with Persistent IndexedDB & In-Memory Cache) ---

// Products
export async function getProducts(forceServer = false): Promise<Product[]> {
  if (!forceServer && cachedProducts && cachedProducts.length > 0) {
    return cachedProducts;
  }
  const colRef = getCollectionRef('products');
  if (!forceServer) {
    try {
      const cacheSnap = await getDocsFromCache(colRef);
      if (!cacheSnap.empty) {
        cachedProducts = cacheSnap.docs.map(doc => doc.data() as Product);
        return cachedProducts;
      }
    } catch {}
  }
  const prods = await getCollectionDocs<Product>(colRef);
  cachedProducts = prods;
  return prods;
}

export async function saveProduct(product: Product): Promise<Product> {
  const uid = getToken();
  let docId = product.id;
  if (!docId) {
    const colRef = getCollectionRef('products');
    docId = doc(colRef).id;
    product = { ...product, id: docId };
  }

  // Validate product limit on creation
  if (uid && uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    // Check local cache first before doing server read
    const isExisting = cachedProducts?.some(p => p.id === docId);
    if (!isExisting) {
      const existingDoc = await getDocumentSnap(getDocRef('products', docId));
      if (!existingDoc.exists()) {
        const existingList = cachedProducts || await getProducts();
        const lic = await getUserLicense(uid);
        const check = checkProductLimit(existingList.length, lic?.planType);
        if (!check.allowed) {
          throw new Error(check.message);
        }
      }
    }
  }

  // Ensure image is compressed if it's a large base64 data URL
  if (product.imageUrl && product.imageUrl.startsWith('data:image/') && product.imageUrl.length > 100000) {
    try {
      const compressed = await compressDataUrlIfNeeded(product.imageUrl, 600, 0.75);
      product = { ...product, imageUrl: compressed };
    } catch (e) {
      console.warn('Could not compress image in saveProduct:', e);
    }
  }

  const cleanDoc = cleanDataForFirestore(product);
  await setDoc(getDocRef('products', docId), cleanDoc);

  // Update in-memory cache directly (0 additional reads)
  if (cachedProducts && cachedProducts.length > 0) {
    const idx = cachedProducts.findIndex(p => p.id === docId);
    if (idx >= 0) {
      cachedProducts = cachedProducts.map((item, i) => (i === idx ? product : item));
    } else {
      cachedProducts = [...cachedProducts, product];
    }
  }

  return product;
}

export async function deleteProduct(id: string): Promise<{ success: boolean }> {
  await deleteDoc(getDocRef('products', id));
  if (cachedProducts) {
    cachedProducts = cachedProducts.filter(p => p.id !== id);
  }
  return { success: true };
}

// Clients
export async function getClients(forceServer = false): Promise<Client[]> {
  if (!forceServer && cachedClients && cachedClients.length > 0) {
    return cachedClients;
  }
  const colRef = getCollectionRef('clients');
  if (!forceServer) {
    try {
      const cacheSnap = await getDocsFromCache(colRef);
      if (!cacheSnap.empty) {
        cachedClients = cacheSnap.docs.map(doc => doc.data() as Client);
        return cachedClients;
      }
    } catch {}
  }
  const clis = await getCollectionDocs<Client>(colRef);
  cachedClients = clis;
  return clis;
}

export async function saveClient(client: Client): Promise<Client> {
  let docId = client.id;
  if (!docId) {
    const colRef = getCollectionRef('clients');
    docId = doc(colRef).id;
    client = { ...client, id: docId };
  }
  await setDoc(getDocRef('clients', docId), cleanDataForFirestore(client));
  if (cachedClients && cachedClients.length > 0) {
    const idx = cachedClients.findIndex(c => c.id === docId);
    if (idx >= 0) cachedClients = cachedClients.map((item, i) => (i === idx ? client : item));
    else cachedClients = [...cachedClients, client];
  }
  return client;
}

export async function deleteClient(id: string): Promise<{ success: boolean }> {
  await deleteDoc(getDocRef('clients', id));
  if (cachedClients) {
    cachedClients = cachedClients.filter(c => c.id !== id);
  }
  return { success: true };
}

// Providers
export async function getProviders(forceServer = false): Promise<Provider[]> {
  if (!forceServer && cachedProviders && cachedProviders.length > 0) {
    return cachedProviders;
  }
  const colRef = getCollectionRef('providers');
  if (!forceServer) {
    try {
      const cacheSnap = await getDocsFromCache(colRef);
      if (!cacheSnap.empty) {
        cachedProviders = cacheSnap.docs.map(doc => doc.data() as Provider);
        return cachedProviders;
      }
    } catch {}
  }
  const provs = await getCollectionDocs<Provider>(colRef);
  cachedProviders = provs;
  return provs;
}

export async function saveProvider(provider: Provider): Promise<Provider> {
  let docId = provider.id;
  if (!docId) {
    const colRef = getCollectionRef('providers');
    docId = doc(colRef).id;
    provider = { ...provider, id: docId };
  }
  await setDoc(getDocRef('providers', docId), cleanDataForFirestore(provider));
  if (cachedProviders && cachedProviders.length > 0) {
    const idx = cachedProviders.findIndex(p => p.id === docId);
    if (idx >= 0) cachedProviders = cachedProviders.map((item, i) => (i === idx ? provider : item));
    else cachedProviders = [...cachedProviders, provider];
  }
  return provider;
}

export async function deleteProvider(id: string): Promise<{ success: boolean }> {
  await deleteDoc(getDocRef('providers', id));
  if (cachedProviders) {
    cachedProviders = cachedProviders.filter(p => p.id !== id);
  }
  return { success: true };
}

// Sales - Bounded queries to prevent downloading entire historical collections
export async function getSales(options?: { limitCount?: number; forceServer?: boolean }): Promise<Sale[]> {
  const colRef = getCollectionRef('sales');
  const limitCount = options?.limitCount || 500; // Generous ceiling to prevent truncating business records
  
  if (!options?.forceServer) {
    try {
      const q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
      const cacheSnap = await getDocsFromCache(q);
      if (!cacheSnap.empty) {
        const docs = cacheSnap.docs.map(doc => doc.data() as Sale);
        return docs.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
      }
    } catch {}
  }
  
  try {
    const q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
    const serverSnap = await getDocs(q);
    const docs = serverSnap.docs.map(doc => doc.data() as Sale);
    return docs.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
  } catch (e) {
    // Fallback if index on date is not ready or documents contain mixed date types
    try {
      const qSimple = query(colRef, limit(limitCount));
      const serverSnap = await getDocs(qSimple);
      const docs = serverSnap.docs.map(doc => doc.data() as Sale);
      return docs.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
    } catch (fallbackErr) {
      const docs = await getCollectionDocs<Sale>(colRef);
      return docs.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
    }
  }
}

export async function getRecentSales(limitCount = 50): Promise<Sale[]> {
  return getSales({ limitCount });
}

export async function saveSale(sale: Sale): Promise<Sale> {
  // Ensure idempotent deterministic sale ID to completely prevent duplicate records
  let docId = sale.id;
  if (!docId) {
    docId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  const normalizedSale: Sale = {
    ...sale,
    id: docId,
    date: sale.date ? parseSafeDate(sale.date).toISOString() : new Date().toISOString()
  };
  await setDoc(getDocRef('sales', docId), cleanDataForFirestore(normalizedSale));
  return normalizedSale;
}

// =========================================================================
// TRANSACTIONAL OPERATIONS
// Online: a Firestore transaction re-reads the affected documents and
// computes stock, cash and balances from the server values, so two cash
// registers selling the same product never overwrite each other.
// Offline: one atomic batch with increment() for every counter. It is saved
// in the local cache immediately and sent when the connection returns.
// =========================================================================

export function newDocId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function isLikelyOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isUnavailableError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  return err?.code === 'unavailable' || msg.includes('client is offline') || msg.includes('offline');
}

// Operation described for the offline journal (see utils/offlineJournal.ts).
interface JournalDraft {
  id: string;
  kind: JournalKind;
  title: string;
  detail: string;
  amount?: number;
  branch?: string;
  check?: JournalCheck;
  retry?: any;
}

function journalKey(): string {
  return tenantStorageKey(JOURNAL_BASE_KEY);
}

const money = (n: any) => `Q${toNum(n).toFixed(2)}`;

// Offline commits resolve only when the server answers, so they are not
// awaited: the write is already in the local cache and the UI can continue.
// Every offline operation is written to the journal first, so that if the
// server rejects it the user is told and the data is not lost.
async function commitBatch(batch: WriteBatch, offline: boolean, entry?: JournalDraft): Promise<void> {
  if (offline) {
    const key = journalKey();
    if (entry) addPending(key, entry);
    batch.commit()
      .then(() => { if (entry) markSynced(key, entry.id); })
      .catch(err => {
        console.error('[Yaa POS] El servidor rechazó una operación guardada sin conexión:', err);
        if (entry) markRejected(key, entry.id, describeRejection(err));
      });
    return;
  }
  await batch.commit();
}

async function runOnlineOrOffline<T>(online: () => Promise<T>, offline: () => Promise<T>): Promise<T> {
  if (isLikelyOffline()) return offline();
  try {
    return await online();
  } catch (err) {
    if (isUnavailableError(err)) return offline();
    throw err;
  }
}

function withoutUndefined<T extends Record<string, any>>(data: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) out[k] = v;
  return out;
}

// Fields that inventory operations own on a product. Other fields (name,
// price, etc.) are left as they are on the server.
function stockPatch(updated: Product, stockDelta: number, extra: Record<string, any> = {}): Record<string, any> {
  return withoutUndefined({
    ...extra,
    stock: increment(stockDelta),
    branch: updated.branch || undefined,
    expirationDates: updated.expirationDates ? cleanDataForFirestore(updated.expirationDates) : deleteField(),
    expirationDate: updated.expirationDate ?? deleteField(),
    initialBatch: updated.initialBatch ?? deleteField(),
  });
}

function buildMovements(
  type: StockMovement['type'],
  refId: string,
  deltas: Map<string, number>,
  products: Product[],
  meta: { branch?: string; date: string; operatorName?: string }
): StockMovement[] {
  const out: StockMovement[] = [];
  for (const [productId, quantity] of deltas.entries()) {
    if (!quantity) continue;
    out.push(cleanDataForFirestore({
      id: `${refId}_${productId}`,
      productId,
      productName: products.find(p => p.id === productId)?.name || '',
      type,
      quantity,
      refId,
      branch: meta.branch,
      date: meta.date,
      operatorName: meta.operatorName,
    }) as StockMovement);
  }
  return out;
}

function snapToEntity<T extends { id: string }>(snap: any): T | undefined {
  return snap && snap.exists() ? ({ ...(snap.data() as T), id: snap.id }) : undefined;
}

function refreshCaches(r: { products?: Product[]; shift?: Shift; client?: Client; provider?: Provider }) {
  if (cachedProducts && r.products && r.products.length > 0) {
    const map = new Map(r.products.map(p => [p.id, p]));
    cachedProducts = cachedProducts.map(p => map.get(p.id) || p);
    for (const p of r.products) if (!cachedProducts.some(x => x.id === p.id)) cachedProducts = [...cachedProducts, p];
  }
  if (cachedShifts && r.shift) {
    const s = r.shift;
    cachedShifts = cachedShifts.some(x => x.id === s.id) ? cachedShifts.map(x => (x.id === s.id ? s : x)) : [...cachedShifts, s];
  }
  if (cachedClients && r.client) {
    const c = r.client;
    cachedClients = cachedClients.map(x => (x.id === c.id ? c : x));
  }
  if (cachedProviders && r.provider) {
    const pv = r.provider;
    cachedProviders = cachedProviders.map(x => (x.id === pv.id ? pv : x));
  }
}

// ---------------------------------------------------------------- Sales ---

export interface SaleTxInput {
  sale: Sale;               // id generated once by the caller (stable on retries)
  saleBranch: string;
  productIds: string[];     // product resolved for each sale item ('' = none)
  localProducts: Product[];
  shift?: Shift;
  client?: Client;
}

export interface SaleTxResult {
  sale: Sale;
  products: Product[];
  shift?: Shift;
  client?: Client;
  alreadyRegistered: boolean;
  pendingSync: boolean;
}

function computeSaleEffects(input: SaleTxInput, sale: Sale, productsById: Map<string, Product>, shift?: Shift, client?: Client) {
  const working = new Map(productsById);
  const deltas = new Map<string, number>();
  sale.items.forEach((item, i) => {
    const pid = input.productIds[i];
    const product = pid ? working.get(pid) : undefined;
    if (!pid || !product) return;
    const r = applySaleItemToProduct(product, item, input.saleBranch);
    working.set(pid, r.product);
    deltas.set(pid, (deltas.get(pid) || 0) + r.stockDelta);
  });
  const products = [...deltas.keys()].map(id => working.get(id)!).filter(Boolean);
  return {
    products,
    deltas,
    shiftFx: shift ? applySaleToShift(shift, sale, input.saleBranch) : undefined,
    clientFx: client ? applySaleToClient(client, sale, input.saleBranch) : undefined,
    movements: buildMovements(sale.originalSaleId ? 'devolucion' : 'venta', sale.id, deltas, products, {
      branch: sale.branch, date: sale.date, operatorName: sale.operatorName,
    }),
  };
}

export async function executeSaleTransaction(input: SaleTxInput): Promise<SaleTxResult> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');

  const sale: Sale = cleanDataForFirestore({
    ...input.sale,
    id: input.sale.id || newDocId('sale'),
    date: input.sale.date ? parseSafeDate(input.sale.date).toISOString() : new Date().toISOString(),
  });
  const saleRef = getDocRef('sales', sale.id);
  const originalRef = sale.originalSaleId ? getDocRef('sales', sale.originalSaleId) : null;
  const returnMark = { returnSaleId: sale.id, returnedAt: sale.date };

  const online = () => runTransaction(db, async (tx: Transaction): Promise<SaleTxResult> => {
    const existing = await tx.get(saleRef);
    if (existing.exists()) {
      return { sale: existing.data() as Sale, products: [], alreadyRegistered: true, pendingSync: false };
    }
    if (originalRef) {
      const orig = await tx.get(originalRef);
      if (!orig.exists()) throw new Error('No se encontró la venta original.');
      if ((orig.data() as Sale).returnSaleId) throw new Error('Esta venta ya tiene una devolución registrada.');
    }
    const ids = [...new Set(input.productIds.filter(Boolean))];
    const snaps = await Promise.all(ids.map(id => tx.get(getDocRef('products', id))));
    const fresh = new Map<string, Product>();
    snaps.forEach(s => { const p = snapToEntity<Product>(s); if (p) fresh.set(p.id, p); });
    const shift = input.shift ? snapToEntity<Shift>(await tx.get(getDocRef('shifts', input.shift.id))) : undefined;
    const client = input.client ? snapToEntity<Client>(await tx.get(getDocRef('clients', input.client.id))) : undefined;

    const fx = computeSaleEffects(input, sale, fresh, shift, client);
    tx.set(saleRef, sale);
    for (const p of fx.products) tx.set(getDocRef('products', p.id), cleanDataForFirestore(p));
    if (fx.shiftFx) tx.set(getDocRef('shifts', fx.shiftFx.shift.id), cleanDataForFirestore(fx.shiftFx.shift));
    if (fx.clientFx) tx.set(getDocRef('clients', fx.clientFx.client.id), cleanDataForFirestore(fx.clientFx.client));
    for (const m of fx.movements) tx.set(getDocRef('stockMovements', m.id), m);
    if (originalRef) tx.update(originalRef, returnMark);
    return { sale, products: fx.products, shift: fx.shiftFx?.shift, client: fx.clientFx?.client, alreadyRegistered: false, pendingSync: false };
  });

  const offline = async (): Promise<SaleTxResult> => {
    const local = new Map(input.localProducts.map(p => [p.id, p]));
    const fx = computeSaleEffects(input, sale, local, input.shift, input.client);
    const batch = writeBatch(db);
    batch.set(saleRef, sale);
    for (const p of fx.products) batch.update(getDocRef('products', p.id), stockPatch(p, fx.deltas.get(p.id) || 0));
    if (fx.shiftFx && input.shift) {
      batch.update(getDocRef('shifts', input.shift.id), withoutUndefined({
        salesTotal: increment(fx.shiftFx.salesTotalDelta),
        // Older shifts without cashSales derive it from salesTotal: write it once as a value.
        cashSales: input.shift.cashSales !== undefined ? increment(fx.shiftFx.cashSalesDelta) : fx.shiftFx.shift.cashSales,
        branch: fx.shiftFx.shift.branch || undefined,
      }));
    }
    if (fx.clientFx && input.client) {
      batch.update(getDocRef('clients', input.client.id), withoutUndefined({
        totalSpent: increment(fx.clientFx.totalSpentDelta),
        loyaltyPoints: increment(fx.clientFx.loyaltyPointsDelta),
        balanceCredit: increment(fx.clientFx.balanceCreditDelta),
        lastPurchaseDate: fx.clientFx.client.lastPurchaseDate,
        branch: fx.clientFx.client.branch || undefined,
      }));
    }
    for (const m of fx.movements) batch.set(getDocRef('stockMovements', m.id), m);
    if (originalRef) batch.update(originalRef, returnMark);
    const isReturn = !!sale.originalSaleId;
    await commitBatch(batch, true, {
      id: sale.id,
      kind: isReturn ? 'devolucion' : 'venta',
      title: `${isReturn ? 'Devolución' : 'Venta'} ${money(sale.total)}${sale.branch ? ` · ${sale.branch}` : ''}`,
      detail: (sale.items || []).map(i => `${i.quantity} x ${i.name}`).join(', ').slice(0, 400)
        + (input.client ? ` · Cliente: ${input.client.name}` : ''),
      amount: toNum(sale.total),
      branch: sale.branch,
      check: { collection: 'sales', docId: sale.id, expect: 'exists' },
      retry: {
        sale,
        saleBranch: input.saleBranch,
        productIds: input.productIds,
        shiftId: input.shift?.id,
        clientId: input.client?.id,
      },
    });
    return { sale, products: fx.products, shift: fx.shiftFx?.shift, client: fx.clientFx?.client, alreadyRegistered: false, pendingSync: true };
  };

  const result = await runOnlineOrOffline(online, offline);
  refreshCaches(result);
  return result;
}

// ------------------------------------------------------------ Purchases ---

export interface PurchaseTxInput {
  purchase: Purchase;        // id generated once by the caller
  targets: (Product | undefined)[]; // product (existing or new draft) for each item
  provider?: Provider;
  shift?: Shift;
  expenseDraft?: Expense;    // cash expense to register when the stock is received
  previous?: Purchase;       // local copy of the stored purchase (offline fallback)
  newProductIds?: string[];  // targets that are new drafts (not yet in Firestore)
  operatorName?: string;
}

export interface PurchaseTxResult {
  purchase: Purchase;
  products: Product[];
  provider?: Provider;
  shift?: Shift;
  expense?: Expense;
  alreadyApplied: boolean;
  pendingSync: boolean;
}

function computePurchaseEffects(input: PurchaseTxInput, prev: Purchase | undefined, fresh: Map<string, Product>, provider?: Provider, shift?: Shift) {
  const pur = input.purchase;
  // Stock, cash expense and movements are applied once: when the purchase
  // reaches "completed" for the first time. Provider totals are counted once:
  // when the purchase is created.
  const receiveNow = pur.status === 'completed' && prev?.status !== 'completed';
  const isNew = !prev;
  const working = new Map<string, Product>();
  const deltas = new Map<string, number>();
  const existing = new Set<string>();
  if (receiveNow) {
    pur.items.forEach((item, i) => {
      const target = input.targets[i];
      if (!item || !target) return;
      if (fresh.has(target.id)) existing.add(target.id);
      const base = working.get(target.id) || fresh.get(target.id) || target;
      const before = toNum(base.stock);
      const updated: Product = { ...applyPurchaseItemToProduct(base, item), ...(pur.branch ? { branch: pur.branch } : {}) };
      working.set(target.id, updated);
      deltas.set(target.id, (deltas.get(target.id) || 0) + (toNum(updated.stock) - before));
    });
  }
  const products = [...working.values()];
  const totalPurchasesDelta = isNew ? pur.total : 0;
  const creditPendingDelta = isNew && pur.paymentType === 'credit' ? pur.total : 0;
  const providerUpdated = provider && (totalPurchasesDelta || creditPendingDelta)
    ? { ...provider, branch: provider.branch || pur.branch, totalPurchases: (provider.totalPurchases || 0) + totalPurchasesDelta, creditPending: (provider.creditPending || 0) + creditPendingDelta }
    : undefined;
  const payCashNow = receiveNow && pur.paymentType === 'cash';
  const expense = payCashNow ? input.expenseDraft : undefined;
  const shiftUpdated = payCashNow && shift ? { ...shift, expensesTotal: (shift.expensesTotal || 0) + pur.total } : undefined;
  return {
    products, deltas, existing, providerUpdated, totalPurchasesDelta, creditPendingDelta, expense, shiftUpdated,
    movements: buildMovements('compra', pur.id, deltas, products, { branch: pur.branch, date: pur.date || new Date().toISOString(), operatorName: input.operatorName }),
  };
}

export async function executePurchaseTransaction(input: PurchaseTxInput): Promise<PurchaseTxResult> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  const purchase: Purchase = cleanDataForFirestore({ ...input.purchase, id: input.purchase.id || newDocId('pur') });
  const purchaseRef = getDocRef('purchases', purchase.id);
  const inputWithId = { ...input, purchase };

  const online = () => runTransaction(db, async (tx: Transaction): Promise<PurchaseTxResult> => {
    const prev = snapToEntity<Purchase>(await tx.get(purchaseRef));
    if (prev && prev.status === 'completed' && purchase.status === 'completed') {
      return { purchase: prev, products: [], alreadyApplied: true, pendingSync: false };
    }
    const ids = [...new Set(input.targets.filter(Boolean).map(t => t!.id))];
    const snaps = await Promise.all(ids.map(id => tx.get(getDocRef('products', id))));
    const fresh = new Map<string, Product>();
    snaps.forEach(s => { const p = snapToEntity<Product>(s); if (p) fresh.set(p.id, p); });
    const provider = input.provider ? snapToEntity<Provider>(await tx.get(getDocRef('providers', input.provider.id))) : undefined;
    const shift = input.shift ? snapToEntity<Shift>(await tx.get(getDocRef('shifts', input.shift.id))) : undefined;

    const fx = computePurchaseEffects(inputWithId, prev, fresh, provider, shift);
    for (const p of fx.products) tx.set(getDocRef('products', p.id), cleanDataForFirestore(p));
    if (fx.providerUpdated) tx.set(getDocRef('providers', fx.providerUpdated.id), cleanDataForFirestore(fx.providerUpdated));
    if (fx.expense) tx.set(getDocRef('expenses', fx.expense.id), cleanDataForFirestore(fx.expense));
    if (fx.shiftUpdated) tx.set(getDocRef('shifts', fx.shiftUpdated.id), cleanDataForFirestore(fx.shiftUpdated));
    for (const m of fx.movements) tx.set(getDocRef('stockMovements', m.id), m);
    tx.set(purchaseRef, purchase);
    return { purchase, products: fx.products, provider: fx.providerUpdated, shift: fx.shiftUpdated, expense: fx.expense, alreadyApplied: false, pendingSync: false };
  });

  const offline = async (): Promise<PurchaseTxResult> => {
    const prev = input.previous;
    if (prev && prev.status === 'completed' && purchase.status === 'completed') {
      return { purchase: prev, products: [], alreadyApplied: true, pendingSync: true };
    }
    const local = new Map<string, Product>();
    const newIds = new Set(input.newProductIds || []);
    for (const t of input.targets) if (t && !newIds.has(t.id)) local.set(t.id, t);
    const fx = computePurchaseEffects(inputWithId, prev, local, input.provider, input.shift);
    const batch = writeBatch(db);
    for (const p of fx.products) {
      const ref = getDocRef('products', p.id);
      if (fx.existing.has(p.id)) {
        const { stock: _s, ...rest } = cleanDataForFirestore(p) as any;
        batch.update(ref, stockPatch(p, fx.deltas.get(p.id) || 0, rest));
      } else {
        batch.set(ref, cleanDataForFirestore(p));
      }
    }
    if (fx.providerUpdated && input.provider) {
      batch.update(getDocRef('providers', input.provider.id), {
        totalPurchases: increment(fx.totalPurchasesDelta),
        creditPending: increment(fx.creditPendingDelta),
      });
    }
    if (fx.expense) batch.set(getDocRef('expenses', fx.expense.id), cleanDataForFirestore(fx.expense));
    if (fx.shiftUpdated && input.shift) batch.update(getDocRef('shifts', input.shift.id), { expensesTotal: increment(purchase.total) });
    for (const m of fx.movements) batch.set(getDocRef('stockMovements', m.id), m);
    batch.set(purchaseRef, purchase);
    await commitBatch(batch, true, {
      id: fx.movements[0]?.id || `${purchase.id}_${purchase.status || 'save'}`,
      kind: 'compra',
      title: `Compra ${money(purchase.total)}${purchase.branch ? ` · ${purchase.branch}` : ''}`,
      detail: `${input.provider?.name ? `Proveedor: ${input.provider.name} · ` : ''}${(purchase.items || []).length} producto(s)`,
      amount: toNum(purchase.total),
      branch: purchase.branch,
      // Receiving stock writes kardex movements: their presence proves the purchase arrived.
      check: fx.movements[0]
        ? { collection: 'stockMovements', docId: fx.movements[0].id, expect: 'exists' }
        : (prev ? undefined : { collection: 'purchases', docId: purchase.id, expect: 'exists' }),
    });
    return { purchase, products: fx.products, provider: fx.providerUpdated, shift: fx.shiftUpdated, expense: fx.expense, alreadyApplied: false, pendingSync: true };
  };

  const result = await runOnlineOrOffline(online, offline);
  refreshCaches(result);
  return result;
}

// ------------------------------------------------------------ Transfers ---

export interface TransferTxInput {
  source: Product;
  target?: Product;          // existing product in the target branch, if any
  quantity: number;
  sourceBranchName: string;
  targetBranchName: string;
  operatorName?: string;
}

export async function executeStockTransfer(input: TransferTxInput): Promise<{ source: Product; target: Product; pendingSync: boolean }> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  const transferId = newDocId('trf');
  const newTargetId = input.target?.id || newDocId('prod');
  const date = new Date().toISOString();

  const movements = (source: Product, target: Product) => [
    ...buildMovements('transferencia_salida', transferId, new Map([[source.id, -input.quantity]]), [source], { branch: input.sourceBranchName, date, operatorName: input.operatorName }),
    ...buildMovements('transferencia_entrada', transferId, new Map([[target.id, input.quantity]]), [target], { branch: input.targetBranchName, date, operatorName: input.operatorName }),
  ];

  const online = () => runTransaction(db, async (tx: Transaction) => {
    const source = snapToEntity<Product>(await tx.get(getDocRef('products', input.source.id)));
    if (!source) throw new Error('Producto a transferir no encontrado.');
    const available = Math.max(0, toNum(source.stock));
    if (input.quantity <= 0 || input.quantity > available) {
      throw new Error(`Cantidad inválida. Stock disponible en ${input.sourceBranchName}: ${available}`);
    }
    const target = input.target ? snapToEntity<Product>(await tx.get(getDocRef('products', input.target.id))) : undefined;
    const updatedSource = applyTransferOut(source, input.quantity, input.sourceBranchName);
    const updatedTarget = applyTransferIn(source, target, input.quantity, input.targetBranchName, newTargetId);
    tx.set(getDocRef('products', updatedSource.id), cleanDataForFirestore(updatedSource));
    tx.set(getDocRef('products', updatedTarget.id), cleanDataForFirestore(updatedTarget));
    for (const m of movements(updatedSource, updatedTarget)) tx.set(getDocRef('stockMovements', m.id), m);
    return { source: updatedSource, target: updatedTarget, pendingSync: false };
  });

  const offline = async () => {
    const available = Math.max(0, toNum(input.source.stock));
    if (input.quantity <= 0 || input.quantity > available) {
      throw new Error(`Cantidad inválida. Stock disponible en ${input.sourceBranchName}: ${available}`);
    }
    const updatedSource = applyTransferOut(input.source, input.quantity, input.sourceBranchName);
    const updatedTarget = applyTransferIn(input.source, input.target, input.quantity, input.targetBranchName, newTargetId);
    const batch = writeBatch(db);
    batch.update(getDocRef('products', updatedSource.id), stockPatch(updatedSource, -input.quantity));
    if (input.target) batch.update(getDocRef('products', updatedTarget.id), stockPatch(updatedTarget, input.quantity));
    else batch.set(getDocRef('products', updatedTarget.id), cleanDataForFirestore(updatedTarget));
    const mv = movements(updatedSource, updatedTarget);
    for (const m of mv) batch.set(getDocRef('stockMovements', m.id), m);
    await commitBatch(batch, true, {
      id: transferId,
      kind: 'transferencia',
      title: `Transferencia de ${input.quantity} · ${input.sourceBranchName} → ${input.targetBranchName}`,
      detail: input.source.name || '',
      branch: input.sourceBranchName,
      check: mv[0] ? { collection: 'stockMovements', docId: mv[0].id, expect: 'exists' } : undefined,
    });
    return { source: updatedSource, target: updatedTarget, pendingSync: true };
  };

  const result = await runOnlineOrOffline(online, offline);
  refreshCaches({ products: [result.source, result.target] });
  return result;
}

// ---------------------------------------------------- Stock adjustments ---

// Manual adjustment from the inventory screen, recorded in the kardex
// (stockMovements, type "ajuste") instead of this browser's localStorage.
export async function executeStockAdjustment(input: {
  product: Product;
  delta: number;
  reason: string;
  operatorName?: string;
  extraFields?: Partial<Product>;
}): Promise<{ product: Product; pendingSync: boolean }> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  if (!input.delta) throw new Error('La cantidad del ajuste debe ser distinta de cero.');
  const adjustmentId = newDocId('adj');
  const date = new Date().toISOString();
  const productRef = getDocRef('products', input.product.id);
  const movementFor = (p: Product): StockMovement => cleanDataForFirestore({
    id: `${adjustmentId}_${p.id}`,
    productId: p.id,
    productName: p.name || '',
    type: 'ajuste',
    quantity: input.delta,
    refId: adjustmentId,
    branch: p.branch,
    date,
    operatorName: input.operatorName,
    reason: (input.reason || 'Ajuste de inventario').slice(0, 200),
  }) as StockMovement;
  const check = (p: Product) => {
    if (input.delta < 0 && -input.delta > toNum(p.stock)) {
      throw new Error('No puedes retirar más de lo que hay en stock actual.');
    }
  };

  const online = () => runTransaction(db, async (tx: Transaction) => {
    const fresh = snapToEntity<Product>(await tx.get(productRef));
    if (!fresh) throw new Error('Producto no encontrado.');
    check(fresh);
    const updated = { ...applyStockAdjustment(fresh, input.delta), ...(input.extraFields || {}) };
    tx.set(productRef, cleanDataForFirestore(updated));
    const m = movementFor(updated);
    tx.set(getDocRef('stockMovements', m.id), m);
    return { product: updated, pendingSync: false };
  });

  const offline = async () => {
    check(input.product);
    const updated = { ...applyStockAdjustment(input.product, input.delta), ...(input.extraFields || {}) };
    const batch = writeBatch(db);
    batch.update(productRef, stockPatch(updated, input.delta, cleanDataForFirestore(input.extraFields || {})));
    const m = movementFor(updated);
    batch.set(getDocRef('stockMovements', m.id), m);
    await commitBatch(batch, true, {
      id: m.id,
      kind: 'ajuste',
      title: `Ajuste de inventario ${input.delta > 0 ? '+' : ''}${input.delta} · ${input.product.name || ''}`,
      detail: m.reason || '',
      branch: input.product.branch,
      check: { collection: 'stockMovements', docId: m.id, expect: 'exists' },
    });
    return { product: updated, pendingSync: true };
  };

  const result = await runOnlineOrOffline(online, offline);
  refreshCaches({ products: [result.product] });
  return result;
}

export async function getStockMovements(productId: string, type?: StockMovement['type']): Promise<StockMovement[]> {
  const constraints = [where('productId', '==', productId)];
  if (type) constraints.push(where('type', '==', type));
  const q = query(getCollectionRef('stockMovements'), ...constraints);
  try {
    const snap = isLikelyOffline() ? await getDocsFromCache(q) : await getDocs(q);
    return snap.docs.map(d => d.data() as StockMovement);
  } catch (err) {
    console.warn('[Yaa POS] No se pudieron leer los movimientos de kardex:', err);
    return [];
  }
}

// ------------------------------------------------- Expenses and payments ---

// Saves or deletes an expense and moves the shift's expensesTotal by the
// difference only (editing an expense no longer adds its amount again).
export async function executeExpenseChange(input: {
  expense: Expense;
  previous?: Expense;
  shift?: Shift;
  remove?: boolean;
}): Promise<{ expense: Expense; shift?: Shift }> {
  const expense: Expense = cleanDataForFirestore({ ...input.expense, id: input.expense.id || newDocId('exp') });
  const delta = input.remove
    ? -toNum((input.previous || input.expense).amount)
    : toNum(expense.amount) - (input.previous ? toNum(input.previous.amount) : 0);
  const batch = writeBatch(db);
  if (input.remove) batch.delete(getDocRef('expenses', expense.id));
  else batch.set(getDocRef('expenses', expense.id), expense);
  let shift: Shift | undefined;
  if (input.shift && delta !== 0) {
    shift = { ...input.shift, expensesTotal: Math.max(0, (input.shift.expensesTotal || 0) + delta) };
    batch.update(getDocRef('shifts', input.shift.id), withoutUndefined({
      expensesTotal: increment(delta),
      branch: input.shift.branch || expense.branch || undefined,
    }));
  }
  await commitBatch(batch, isLikelyOffline(), {
    id: `${expense.id}_${input.remove ? 'del' : Date.now()}`,
    kind: 'gasto',
    title: `${input.remove ? 'Borrar gasto' : 'Gasto'} ${money(expense.amount)}${expense.branch ? ` · ${expense.branch}` : ''}`,
    detail: expense.description || '',
    amount: toNum(expense.amount),
    branch: expense.branch,
    check: { collection: 'expenses', docId: expense.id, expect: input.remove ? 'missing' : 'exists' },
  });
  refreshCaches({ shift });
  return { expense, shift };
}

export async function executeClientPayment(input: { client: Client; amount: number; shift?: Shift }): Promise<{ client: Client; shift?: Shift }> {
  const applied = Math.min(Math.max(0, input.amount), Math.max(0, input.client.balanceCredit || 0));
  const client: Client = { ...input.client, balanceCredit: Math.max(0, (input.client.balanceCredit || 0) - applied) };
  const batch = writeBatch(db);
  batch.update(getDocRef('clients', client.id), { balanceCredit: increment(-applied) });
  let shift: Shift | undefined;
  if (input.shift) {
    const s = input.shift;
    const baseCash = (s.cashSales !== undefined ? s.cashSales : s.salesTotal) || 0;
    shift = { ...s, salesTotal: (s.salesTotal || 0) + input.amount, cashSales: baseCash + input.amount };
    batch.update(getDocRef('shifts', s.id), {
      salesTotal: increment(input.amount),
      cashSales: s.cashSales !== undefined ? increment(input.amount) : shift.cashSales,
    });
  }
  await commitBatch(batch, isLikelyOffline(), {
    id: newDocId('abono'),
    kind: 'abono_cliente',
    title: `Abono de cliente ${money(input.amount)}`,
    detail: `Cliente: ${input.client.name || ''}`,
    amount: toNum(input.amount),
    branch: input.shift?.branch,
  });
  refreshCaches({ client, shift });
  return { client, shift };
}

export async function executeProviderPayment(input: { provider: Provider; amount: number; expense?: Expense; shift?: Shift }): Promise<{ provider: Provider; expense?: Expense; shift?: Shift }> {
  const applied = Math.min(Math.max(0, input.amount), Math.max(0, input.provider.creditPending || 0));
  const provider: Provider = { ...input.provider, creditPending: Math.max(0, (input.provider.creditPending || 0) - applied) };
  const batch = writeBatch(db);
  batch.update(getDocRef('providers', provider.id), { creditPending: increment(-applied) });
  const expense = input.expense ? cleanDataForFirestore({ ...input.expense, id: input.expense.id || newDocId('exp') }) : undefined;
  if (expense) batch.set(getDocRef('expenses', expense.id), expense);
  let shift: Shift | undefined;
  if (expense && input.shift) {
    shift = { ...input.shift, expensesTotal: (input.shift.expensesTotal || 0) + input.amount };
    batch.update(getDocRef('shifts', input.shift.id), { expensesTotal: increment(input.amount) });
  }
  await commitBatch(batch, isLikelyOffline(), {
    id: expense?.id ? `pago_${expense.id}` : newDocId('pago'),
    kind: 'pago_proveedor',
    title: `Pago a proveedor ${money(input.amount)}`,
    detail: `Proveedor: ${input.provider.name || ''}`,
    amount: toNum(input.amount),
    branch: input.shift?.branch,
    check: expense ? { collection: 'expenses', docId: expense.id, expect: 'exists' } : undefined,
  });
  refreshCaches({ provider, shift });
  return { provider, expense, shift };
}

// ------------------------------------------- Offline journal (rejections) ---

export type { JournalEntry };

// Operations saved without connection that the server rejected, for this company.
export function getRejectedOperations(): JournalEntry[] {
  return getToken() ? rejectedEntries(journalKey()) : [];
}

// The user decided not to keep a rejected operation.
export function discardRejectedOperation(id: string): void {
  removeEntry(journalKey(), id);
}

let reconciling = false;

// Checks operations that were still waiting for the server's answer when the
// page was closed or reloaded: Firestore resends them on its own, but nobody
// hears the answer. Once this device has nothing left to send, an operation
// whose document is not on the server was rejected.
export async function reconcileOfflineJournal(): Promise<void> {
  if (reconciling || !getToken() || isLikelyOffline()) return;
  reconciling = true;
  try {
    const key = journalKey();
    const pending = readJournal(key).filter(e => e.status === 'pending');
    if (pending.length === 0) return;
    // Still sending: decide later.
    if (await hasUnsyncedWrites(8000)) return;
    for (const entry of readJournal(key).filter(e => e.status === 'pending')) {
      if (!entry.check) {
        // Nothing to compare with: everything was sent, assume it arrived.
        markSynced(key, entry.id);
        continue;
      }
      try {
        const snap = await getDocFromServer(getDocRef(entry.check.collection, entry.check.docId));
        const arrived = entry.check.expect === 'exists' ? snap.exists() : !snap.exists();
        if (arrived) markSynced(key, entry.id);
        else markRejected(key, entry.id, 'El servidor no guardó esta operación. Se detectó al volver a conectarse (la página se había cerrado o recargado antes de recibir la respuesta).');
      } catch (err) {
        // Could not ask the server now (offline again, no permission...): try later.
        console.warn('[Yaa POS] No se pudo comprobar una operación pendiente:', err);
      }
    }
  } finally {
    reconciling = false;
  }
}

// Registers again a sale or return the server rejected. It needs connection:
// it runs as a normal online transaction (fresh stock, never duplicated).
// The sale goes to its original shift if it is still open, otherwise to the
// open shift of the same branch, otherwise to no shift.
export async function retryRejectedSale(id: string): Promise<SaleTxResult> {
  const key = journalKey();
  const entry = readJournal(key).find(e => e.id === id);
  if (!entry || !entry.retry?.sale) throw new Error('Esta operación no se puede reintentar automáticamente.');
  if (isLikelyOffline()) throw new Error('Necesita conexión a internet para reintentar.');
  const r = entry.retry as { sale: Sale; saleBranch: string; productIds: string[]; shiftId?: string; clientId?: string };

  let shift: Shift | undefined;
  if (r.shiftId) {
    const snap = await getDocFromServer(getDocRef('shifts', r.shiftId)).catch(() => null);
    const s = snap && snap.exists() ? ({ ...(snap.data() as Shift), id: snap.id }) : undefined;
    if (s && s.state === 'open') shift = s;
  }
  if (!shift) {
    const open = await getOpenShifts();
    const target = (r.saleBranch || r.sale.branch || '').trim().toLowerCase();
    shift = open.find(s => (s.branch || '').trim().toLowerCase() === target);
  }
  let client: Client | undefined;
  if (r.clientId) {
    const snap = await getDocFromServer(getDocRef('clients', r.clientId)).catch(() => null);
    if (snap && snap.exists()) client = { ...(snap.data() as Client), id: snap.id };
  }

  const result = await executeSaleTransaction({
    sale: { ...r.sale, shiftId: shift?.id || r.sale.shiftId },
    saleBranch: r.saleBranch,
    productIds: r.productIds || [],
    localProducts: [],
    shift,
    client,
  });
  if (result.pendingSync) {
    // The connection dropped during the retry: it is journaled again as a new pending entry.
    return result;
  }
  removeEntry(key, id);
  return result;
}

// Open shifts as stored (server when online, local cache when offline). Used
// to allow only one open shift per branch.
export async function getOpenShifts(): Promise<Shift[]> {
  const q = query(getCollectionRef('shifts'), where('state', '==', 'open'));
  try {
    const snap = isLikelyOffline() ? await getDocsFromCache(q) : await getDocsFromServer(q);
    return snap.docs.map(d => ({ ...(d.data() as Shift), id: d.id }));
  } catch {
    const snap = await getDocsFromCache(q).catch(() => null);
    return snap ? snap.docs.map(d => ({ ...(d.data() as Shift), id: d.id })) : [];
  }
}

// Purchases
export async function getPurchases(): Promise<Purchase[]> {
  const colRef = getCollectionRef('purchases');
  try {
    const q = query(colRef, limit(100));
    return await getCollectionDocs<Purchase>(q);
  } catch {
    return getCollectionDocs<Purchase>(colRef);
  }
}

export async function savePurchase(purchase: Purchase): Promise<Purchase> {
  let docId = purchase.id;
  if (!docId) {
    const colRef = getCollectionRef('purchases');
    docId = doc(colRef).id;
    purchase = { ...purchase, id: docId };
  }
  await setDoc(getDocRef('purchases', docId), cleanDataForFirestore(purchase));
  return purchase;
}

// Expenses
export async function getExpenses(): Promise<Expense[]> {
  const colRef = getCollectionRef('expenses');
  try {
    const q = query(colRef, limit(150));
    return await getCollectionDocs<Expense>(q);
  } catch {
    return getCollectionDocs<Expense>(colRef);
  }
}

export async function saveExpense(expense: Expense): Promise<Expense> {
  let docId = expense.id;
  if (!docId) {
    const colRef = getCollectionRef('expenses');
    docId = doc(colRef).id;
    expense = { ...expense, id: docId };
  }
  await setDoc(getDocRef('expenses', docId), cleanDataForFirestore(expense));
  return expense;
}

export async function deleteExpense(id: string): Promise<{ success: boolean }> {
  await deleteDoc(getDocRef('expenses', id));
  return { success: true };
}

// Shifts
export async function getShifts(forceServer = false): Promise<Shift[]> {
  if (!forceServer && cachedShifts && cachedShifts.length > 0) {
    return cachedShifts;
  }
  const colRef = getCollectionRef('shifts');
  if (!forceServer) {
    try {
      const cacheSnap = await getDocsFromCache(colRef);
      if (!cacheSnap.empty) {
        cachedShifts = cacheSnap.docs.map(doc => doc.data() as Shift);
        return cachedShifts;
      }
    } catch {}
  }
  const sfts = await getCollectionDocs<Shift>(colRef);
  cachedShifts = sfts;
  return sfts;
}

export async function saveShift(shift: Shift): Promise<Shift> {
  let docId = shift.id;
  if (!docId) {
    const colRef = getCollectionRef('shifts');
    docId = doc(colRef).id;
    shift = { ...shift, id: docId };
  }
  await setDoc(getDocRef('shifts', docId), shift);
  if (cachedShifts && cachedShifts.length > 0) {
    const idx = cachedShifts.findIndex(s => s.id === docId);
    if (idx >= 0) cachedShifts = cachedShifts.map((item, i) => (i === idx ? shift : item));
    else cachedShifts = [...cachedShifts, shift];
  }
  return shift;
}

// AppConfig - Cached in-memory and in IndexedDB (0 server reads on repeated queries)
export async function getConfig(forceServer = false): Promise<AppConfig> {
  if (!forceServer && cachedConfig) {
    return cachedConfig;
  }
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  const docRef = doc(db, 'users', uid, 'configs', 'storeConfig');

  if (!forceServer) {
    try {
      const cacheSnap = await getDocFromCache(docRef);
      if (cacheSnap.exists()) {
        cachedConfig = cacheSnap.data() as AppConfig;
        return cachedConfig;
      }
    } catch {}
  }

  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    cachedConfig = docSnap.data() as AppConfig;
    return cachedConfig;
  }
  const defaultConfig: AppConfig = {
    storeName: 'Yaa POS',
    currency: 'Q',
    alertDaysBeforeExpiration: 30,
    businessType: 'general'
  };
  await setDoc(docRef, defaultConfig);
  cachedConfig = defaultConfig;
  return defaultConfig;
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');

  // Validate branch limit if new branches were added
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' && config.branches && config.branches.length > 0) {
    const prevBranches = cachedConfig?.branches || [];
    if (config.branches.length > prevBranches.length) {
      const lic = await getUserLicense(uid);
      const branchCheck = checkBranchLimit(prevBranches.length, lic?.planType);
      if (!branchCheck.allowed) {
        throw new Error(branchCheck.message);
      }
    }
  }

  const docRef = doc(db, 'users', uid, 'configs', 'storeConfig');
  await setDoc(docRef, config);
  cachedConfig = config;
  return config;
}

// --- FILE STORAGE API ---

export async function getFiles(): Promise<UserFile[]> {
  return getCollectionDocs<UserFile>(getCollectionRef('files'));
}

export async function deleteFile(id: string): Promise<{ success: boolean }> {
  const fileRef = getDocRef('files', id);
  const fileSnap = await getDoc(fileRef);
  if (fileSnap.exists()) {
    const fileData = fileSnap.data() as UserFile;
    try {
      const uid = getToken();
      const storageRef = ref(storage, `users/${uid}/${id}-${fileData.name}`);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn("Error deleting file from Storage, continuing to remove metadata: ", err);
    }
  }
  await deleteDoc(fileRef);
  return { success: true };
}

export async function uploadFile(file: File): Promise<UserFile> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');

  const fileId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const fileRef = ref(storage, `users/${uid}/${fileId}-${file.name}`);
  
  await uploadBytes(fileRef, file);
  const downloadUrl = await getDownloadURL(fileRef);

  const userFile: UserFile = {
    id: fileId,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    path: downloadUrl,
    uploadedAt: new Date().toISOString()
  };

  await setDoc(getDocRef('files', fileId), userFile);
  return userFile;
}

// --- GEMINI AI ASSISTANT PROXIED AGENT ---

export async function askAI(
  prompt: string, 
  products: Product[] = [], 
  sales: Sale[] = [], 
  expenses: Expense[] = [], 
  config?: AppConfig
): Promise<{ reply: string }> {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  // The server verifies a real Firebase ID token (not the tenant id).
  await ensureAuthReady();
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  if (!idToken) {
    throw new Error('Sesión expirada. Inicie sesión nuevamente para usar el asistente.');
  }
  headers.set('Authorization', `Bearer ${idToken}`);
  
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, products, sales, expenses, config })
  });
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error del asistente: ${res.status}`);
  }
  
  return res.json();
}

// --- REAL-TIME SUBSCRIPTIONS FOR INTER-TAB AND GLOBAL SYNC ---

export interface SyncMetadata {
  hasPendingWrites: boolean;
  fromCache: boolean;
}

export function subscribeProducts(callback: (products: Product[], metadata?: SyncMetadata) => void): () => void {
  try {
    const colRef = getCollectionRef('products');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Product);
      cachedProducts = list;
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.error('Error in subscribeProducts:', error);
    });
  } catch (err) {
    console.warn('Could not establish products subscription:', err);
    return () => {};
  }
}

export function subscribeClients(callback: (clients: Client[], metadata?: SyncMetadata) => void): () => void {
  try {
    const colRef = getCollectionRef('clients');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Client);
      cachedClients = list;
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.error('Error in subscribeClients:', error);
    });
  } catch (err) {
    console.warn('Could not establish clients subscription:', err);
    return () => {};
  }
}

export function subscribeProviders(callback: (providers: Provider[], metadata?: SyncMetadata) => void): () => void {
  try {
    const colRef = getCollectionRef('providers');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Provider);
      cachedProviders = list;
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.error('Error in subscribeProviders:', error);
    });
  } catch (err) {
    console.warn('Could not establish providers subscription:', err);
    return () => {};
  }
}

// How many of the most recent records each live listener keeps in memory.
// Reports that need older records query them by date range
// (fetchCollectionInRange) instead of silently using a partial list.
export const LIVE_LIMITS = { sales: 300, purchases: 150, expenses: 150, shifts: 50 } as const;

export type RangeCollection = 'sales' | 'purchases' | 'expenses';

// All documents of a collection whose "date" falls between fromIso and toIso
// (ISO strings, both optional), read page by page. When maxDocs is reached
// the result is marked as truncated so the screen can say so.
export async function fetchCollectionInRange<T>(
  col: RangeCollection,
  fromIso: string | null,
  toIso: string | null,
  maxDocs = 20000
): Promise<{ items: T[]; truncated: boolean; fromCache: boolean }> {
  const PAGE = 500;
  const base: QueryConstraint[] = [];
  if (fromIso) base.push(where('date', '>=', fromIso));
  if (toIso) base.push(where('date', '<=', toIso));
  base.push(orderBy('date', 'desc'));
  const colRef = getCollectionRef(col);

  if (isLikelyOffline()) {
    const snap = await getDocsFromCache(query(colRef, ...base, limit(maxDocs)));
    return { items: snap.docs.map(d => d.data() as T), truncated: snap.size >= maxDocs, fromCache: true };
  }

  const items: T[] = [];
  let last: QueryDocumentSnapshot | null = null;
  while (items.length < maxDocs) {
    const constraints = [...base, ...(last ? [startAfter(last)] : []), limit(Math.min(PAGE, maxDocs - items.length))];
    const snap = await getDocs(query(colRef, ...constraints));
    snap.docs.forEach(d => items.push(d.data() as T));
    if (snap.size === 0 || snap.size < PAGE) return { items, truncated: false, fromCache: false };
    last = snap.docs[snap.docs.length - 1];
  }
  return { items, truncated: true, fromCache: false };
}

export function subscribeSales(callback: (sales: Sale[], metadata?: SyncMetadata) => void, limitCount = LIVE_LIMITS.sales): () => void {
  try {
    const colRef = getCollectionRef('sales');
    // Order by date descending so the newest sales are always streamed
    const q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Sale);
      list.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.warn('subscribeSales with orderBy error, trying fallback query:', error);
      try {
        const qSimple = query(colRef, limit(limitCount));
        return onSnapshot(qSimple, (snapshot) => {
          const list = snapshot.docs.map(doc => doc.data() as Sale);
          list.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
          callback(list, {
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache
          });
        });
      } catch (err2) {
        console.error('Error in subscribeSales fallback:', err2);
      }
    });
  } catch (err) {
    console.warn('Could not establish sales subscription:', err);
    return () => {};
  }
}

export function subscribePurchases(callback: (purchases: Purchase[], metadata?: SyncMetadata) => void, limitCount = LIVE_LIMITS.purchases): () => void {
  try {
    const colRef = getCollectionRef('purchases');
    const q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Purchase);
      list.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, () => {
      try {
        const qSimple = query(colRef, limit(limitCount));
        return onSnapshot(qSimple, (snapshot) => {
          const list = snapshot.docs.map(doc => doc.data() as Purchase);
          list.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
          callback(list, {
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache
          });
        });
      } catch {}
    });
  } catch (err) {
    console.warn('Could not establish purchases subscription:', err);
    return () => {};
  }
}

export function subscribeExpenses(callback: (expenses: Expense[], metadata?: SyncMetadata) => void, limitCount = LIVE_LIMITS.expenses): () => void {
  try {
    const colRef = getCollectionRef('expenses');
    const q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Expense);
      list.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, () => {
      try {
        const qSimple = query(colRef, limit(limitCount));
        return onSnapshot(qSimple, (snapshot) => {
          const list = snapshot.docs.map(doc => doc.data() as Expense);
          list.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
          callback(list, {
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache
          });
        });
      } catch {}
    });
  } catch (err) {
    console.warn('Could not establish expenses subscription:', err);
    return () => {};
  }
}

export function subscribeShifts(callback: (shifts: Shift[], metadata?: SyncMetadata) => void, limitCount = LIVE_LIMITS.shifts): () => void {
  try {
    const colRef = getCollectionRef('shifts');
    const q = query(colRef, orderBy('openedAt', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Shift);
      list.sort((a, b) => parseSafeDate(b.openedAt).getTime() - parseSafeDate(a.openedAt).getTime());
      cachedShifts = list;
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, () => {
      try {
        const qSimple = query(colRef, limit(limitCount));
        return onSnapshot(qSimple, (snapshot) => {
          const list = snapshot.docs.map(doc => doc.data() as Shift);
          list.sort((a, b) => parseSafeDate(b.openedAt).getTime() - parseSafeDate(a.openedAt).getTime());
          cachedShifts = list;
          callback(list, {
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache
          });
        });
      } catch {}
    });
  } catch (err) {
    console.warn('Could not establish shifts subscription:', err);
    return () => {};
  }
}

export function subscribeFiles(callback: (files: UserFile[], metadata?: SyncMetadata) => void): () => void {
  try {
    const colRef = getCollectionRef('files');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as UserFile);
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.error('Error in subscribeFiles:', error);
    });
  } catch (err) {
    console.warn('Could not establish files subscription:', err);
    return () => {};
  }
}

export function subscribeConfig(callback: (config: AppConfig, metadata?: SyncMetadata) => void): () => void {
  try {
    const uid = getToken();
    if (!uid) return () => {};
    const docRef = doc(db, 'users', uid, 'configs', 'storeConfig');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cfg = docSnap.data() as AppConfig;
        cachedConfig = cfg;
        callback(cfg, {
          hasPendingWrites: docSnap.metadata.hasPendingWrites,
          fromCache: docSnap.metadata.fromCache
        });
      }
    }, (error) => {
      console.error('Error in subscribeConfig:', error);
    });
  } catch (err) {
    console.warn('Could not establish config subscription:', err);
    return () => {};
  }
}

// --- SYSTEM RESET API ---
export async function resetUserDatabase(): Promise<void> {
  // Only the account owner may wipe the company data. Operators sign in with
  // their own Firebase account, so their uid differs from the company id.
  await ensureAuthReady();
  const companyId = getToken();
  if (!auth.currentUser || !companyId || auth.currentUser.uid !== companyId) {
    throw new Error('Solo el propietario de la cuenta puede reiniciar la base de datos.');
  }

  // First delete files properly from storage and database
  try {
    const filesCol = getCollectionRef('files');
    const filesSnap = await getDocs(filesCol);
    for (const d of filesSnap.docs) {
      await deleteFile(d.id);
    }
  } catch (error) {
    console.error('Error clearing files:', error);
  }

  // Clear other collections
  const collectionsToClear = [
    'products',
    'clients',
    'providers',
    'sales',
    'purchases',
    'expenses',
    'shifts',
    'operators',
    'quotations',
    'consignments',
    'stockMovements'
  ];

  for (const colName of collectionsToClear) {
    try {
      const colRef = getCollectionRef(colName);
      const snapshot = await getDocs(colRef);
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error(`Error clearing collection ${colName}:`, error);
    }
  }
}

// =========================================================================
// QUOTATIONS / PROFORMAS
// =========================================================================

export async function getQuotations(): Promise<Quotation[]> {
  try {
    const colRef = getCollectionRef('quotations');
    const snapshot = await getDocs(colRef);
    const quotes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Quotation));
    
    // Check and merge any local proformas saved in localStorage
    try {
      const local = localStorage.getItem(tenantStorageKey('yaa_pos_quotations'));
      if (local) {
        const localQuotes: Quotation[] = JSON.parse(local);
        const map = new Map<string, Quotation>();
        quotes.forEach(q => map.set(q.id, q));
        localQuotes.forEach(q => {
          if (!map.has(q.id)) {
            map.set(q.id, q);
          }
        });
        return Array.from(map.values()).sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      }
    } catch (e) {
      // ignore
    }

    return quotes.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  } catch (error) {
    console.warn('Firestore quotations fallback to localStorage:', error);
    try {
      const local = localStorage.getItem(tenantStorageKey('yaa_pos_quotations'));
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  }
}

export async function saveQuotation(quotation: Quotation): Promise<Quotation> {
  const quoteToSave = { ...quotation };
  if (!quoteToSave.id) {
    quoteToSave.id = `COT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
  }
  if (!quoteToSave.createdAt) {
    quoteToSave.createdAt = new Date().toISOString();
  }
  quoteToSave.updatedAt = new Date().toISOString();

  // Save to local storage for immediate offline reliability
  try {
    const local = localStorage.getItem(tenantStorageKey('yaa_pos_quotations'));
    const list: Quotation[] = local ? JSON.parse(local) : [];
    const idx = list.findIndex(q => q.id === quoteToSave.id);
    if (idx >= 0) {
      list[idx] = quoteToSave;
    } else {
      list.unshift(quoteToSave);
    }
    localStorage.setItem(tenantStorageKey('yaa_pos_quotations'), JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving quotation to localStorage', e);
  }

  try {
    const docRef = getDocRef('quotations', quoteToSave.id);
    await setDoc(docRef, quoteToSave);
  } catch (error) {
    console.warn('Could not sync quotation to Firestore (saved offline):', error);
  }

  return quoteToSave;
}

export async function deleteQuotation(id: string): Promise<{ success: boolean }> {
  try {
    const local = localStorage.getItem(tenantStorageKey('yaa_pos_quotations'));
    if (local) {
      const list: Quotation[] = JSON.parse(local);
      const filtered = list.filter(q => q.id !== id);
      localStorage.setItem(tenantStorageKey('yaa_pos_quotations'), JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Error removing quote from local storage', e);
  }

  try {
    const docRef = getDocRef('quotations', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Could not delete quotation from Firestore:', error);
  }

  return { success: true };
}

// =========================================================================
// CONSIGNMENTS (Consignaciones)
// =========================================================================

export async function getConsignments(): Promise<Consignment[]> {
  try {
    const colRef = getCollectionRef('consignments');
    const snapshot = await getDocs(colRef);
    const consignments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Consignment));
    
    try {
      const local = localStorage.getItem(tenantStorageKey('yaa_pos_consignments'));
      if (local) {
        const localCons: Consignment[] = JSON.parse(local);
        const map = new Map<string, Consignment>();
        consignments.forEach(c => map.set(c.id, c));
        localCons.forEach(c => {
          if (!map.has(c.id)) {
            map.set(c.id, c);
          }
        });
        return Array.from(map.values()).sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      }
    } catch (e) {
      // ignore
    }

    return consignments.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  } catch (error) {
    console.warn('Firestore consignments fallback to localStorage:', error);
    try {
      const local = localStorage.getItem(tenantStorageKey('yaa_pos_consignments'));
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  }
}

export async function saveConsignment(consignment: Consignment): Promise<Consignment> {
  const consToSave = { ...consignment };
  if (!consToSave.id) {
    consToSave.id = `CSG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
  }
  if (!consToSave.createdAt) {
    consToSave.createdAt = new Date().toISOString();
  }

  try {
    const local = localStorage.getItem(tenantStorageKey('yaa_pos_consignments'));
    const list: Consignment[] = local ? JSON.parse(local) : [];
    const idx = list.findIndex(c => c.id === consToSave.id);
    if (idx >= 0) {
      list[idx] = consToSave;
    } else {
      list.unshift(consToSave);
    }
    localStorage.setItem(tenantStorageKey('yaa_pos_consignments'), JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving consignment to localStorage', e);
  }

  try {
    const docRef = getDocRef('consignments', consToSave.id);
    await setDoc(docRef, consToSave);
  } catch (error) {
    console.warn('Could not sync consignment to Firestore (saved offline):', error);
  }

  return consToSave;
}

export async function deleteConsignment(id: string): Promise<{ success: boolean }> {
  try {
    const local = localStorage.getItem(tenantStorageKey('yaa_pos_consignments'));
    if (local) {
      const list: Consignment[] = JSON.parse(local);
      const filtered = list.filter(c => c.id !== id);
      localStorage.setItem(tenantStorageKey('yaa_pos_consignments'), JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Error removing consignment from local storage', e);
  }

  try {
    const docRef = getDocRef('consignments', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Could not delete consignment from Firestore:', error);
  }

  return { success: true };
}



