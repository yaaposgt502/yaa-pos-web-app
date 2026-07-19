import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updatePassword
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
  onSnapshot,
  getDocsFromCache,
  getDocFromCache
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { auth, db, storage } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { Product, Client, Provider, Sale, Purchase, Expense, Shift, UserFile, AppConfig, User, License } from './types';

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
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;
  const safeUser: User = {
    id: firebaseUser.uid,
    email: firebaseUser.email || email,
    name: name,
    createdAt: new Date().toISOString()
  };
  
  // Save user profile metadata to Firestore
  await setDoc(doc(db, 'users', firebaseUser.uid), safeUser);
  setToken(firebaseUser.uid);
  return { token: firebaseUser.uid, user: safeUser };
}

export interface Operator {
  id: string;
  name: string;
  email: string;
  role: string;
  password?: string;
  status: 'active' | 'inactive';
  ownerId?: string;
  disabledTabs?: string[];
}

// Helper to register standard user or sync operator passwords across standard Firebase Auth and Firestore
async function syncOperatorAuth(email: string, oldPassword?: string, newPassword?: string) {
  const normalizedEmail = email.toLowerCase();
  const apiKey = firebaseConfig.apiKey;
  
  try {
    // 1. Try to create standard Firebase Auth user account via REST API
    const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
    const res = await fetch(signUpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        password: newPassword || 'cajero123',
        returnSecureToken: true
      })
    });
    const data = await res.json();
    
    // 2. If user already exists and we want to change their password:
    if (!res.ok && data.error?.message === 'EMAIL_EXISTS' && oldPassword && newPassword && oldPassword !== newPassword) {
      const tempAppName = 'TempApp_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      let tempApp;
      try {
        tempApp = initializeApp(firebaseConfig, tempAppName);
      } catch {
        tempApp = getApp(tempAppName);
      }
      const tempAuth = getAuth(tempApp);
      try {
        const cred = await signInWithEmailAndPassword(tempAuth, normalizedEmail, oldPassword);
        if (cred.user) {
          await updatePassword(cred.user, newPassword);
        }
      } catch (err) {
        console.warn("Failed to update operator password on temporary auth instance:", err);
      } finally {
        await signOut(tempAuth);
        await deleteApp(tempApp);
      }
    }
  } catch (err) {
    console.warn("Operator Auth Sync failed:", err);
  }
}

export function performValidation(lic: License | null | any, currentUser: User | null | any): { isBlocked: boolean; reason: string } {
  if (!currentUser) return { isBlocked: false, reason: '' };
  if (currentUser.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') return { isBlocked: false, reason: '' };

  // 1. Account status validation
  if (currentUser.accountStatus === 'Suspendida') {
    return {
      isBlocked: true,
      reason: 'Su cuenta ha sido suspendida por el administrador.'
    };
  }
  if (currentUser.accountStatus === 'Desactivada') {
    return {
      isBlocked: true,
      reason: 'Su cuenta ha sido desactivada. Comuníquese con el administrador.'
    };
  }

  // 2. License status validation
  if (lic) {
    if (lic.status === 'Suspendida') {
      return {
        isBlocked: true,
        reason: 'Su cuenta ha sido suspendida por el administrador.'
      };
    }
    if (lic.status === 'Desactivada') {
      return {
        isBlocked: true,
        reason: 'Su cuenta ha sido desactivada. Comuníquese con el administrador.'
      };
    }
    if (lic.status === 'Pendiente') {
      return {
        isBlocked: true,
        reason: 'Su cuenta aún no ha sido autorizada por el administrador.'
      };
    }
    if (lic.status === 'Expirada') {
      return {
        isBlocked: true,
        reason: 'Su licencia ha expirado. No puede utilizar el sistema hasta que el administrador la renueve.'
      };
    }

    // 3. Expiration date check
    if (lic.expirationDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (lic.expirationDate < todayStr) {
        return {
          isBlocked: true,
          reason: 'Su licencia ha expirado. No puede utilizar el sistema hasta que el administrador la renueve.'
        };
      }
    }
  }

  return { isBlocked: false, reason: '' };
}

export async function loginUser(email: string, password: string): Promise<{ token: string, user: User }> {
  // First, authenticate with standard Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;
  
  // Check if this user is configured as an operator globally
  try {
    const globalRef = doc(db, 'operators', email.toLowerCase());
    const opSnap = await getDoc(globalRef);
    if (opSnap.exists()) {
      const opData = opSnap.data() as Operator;
      if (opData.status !== 'active') {
        await signOut(auth);
        throw new Error('Su cuenta de operador ha sido desactivada por el administrador.');
      }
      
      const ownerId = opData.ownerId;
      if (!ownerId) throw new Error('Operador sin propietario asignado');
      
      // Load the owner's profile info
      const userDoc = await getDoc(doc(db, 'users', ownerId));
      const baseUser = userDoc.exists() ? (userDoc.data() as User) : { id: ownerId, name: 'Usuario Yaa POS', email: '' };
      
      // Validate the owner's account status and license
      if (ownerId !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
        const licenseDoc = await getDoc(doc(db, 'licenses', ownerId));
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
        name: opData.name,
        email: opData.email,
        role: opData.role,
        isOperator: true,
        operatorId: opData.id,
        disabledTabs: opData.disabledTabs || []
      };
      
      setToken(ownerId);
      localStorage.setItem('yaa_pos_operator_email', opData.email);
      return { token: ownerId, user: safeUser };
    }
  } catch (err) {
    if (err instanceof Error && (err.message.includes('desactivada') || err.message.includes('suspendida') || err.message.includes('licencia') || err.message.includes('expirado'))) {
      throw err;
    }
    console.warn("Operator profile load failed, treating as standard owner:", err);
  }

  // Treat as standard user (owner)
  const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
  let safeUser: User;
  if (userDoc.exists()) {
    safeUser = userDoc.data() as User;
    if (!safeUser.createdAt) {
      safeUser.createdAt = new Date().toISOString();
      await setDoc(doc(db, 'users', firebaseUser.uid), safeUser);
    }
  } else {
    safeUser = {
      id: firebaseUser.uid,
      email: firebaseUser.email || email,
      name: firebaseUser.displayName || 'Usuario Yaa POS',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), safeUser);
  }

  // Validate standard owner profile and license status
  if (firebaseUser.uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    const licenseDoc = await getDoc(doc(db, 'licenses', firebaseUser.uid));
    const license = licenseDoc.exists() ? licenseDoc.data() as License : null;
    const validation = performValidation(license, safeUser);
    if (validation.isBlocked) {
      await signOut(auth);
      throw new Error(validation.reason);
    }
  }
  
  setToken(firebaseUser.uid);
  localStorage.removeItem('yaa_pos_operator_email');
  return { token: firebaseUser.uid, user: safeUser };
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
  setToken(null);
  localStorage.removeItem('yaa_pos_operator_email');
  window.dispatchEvent(new Event('yaa_pos_logout'));
}

export async function getMe(): Promise<User> {
  // Ensure Firebase Auth is loaded to prevent race conditions on page refresh
  await new Promise<void>((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve();
    });
  });

  const uid = getToken();
  if (!uid) {
    throw new Error('No hay sesión activa');
  }

  const firebaseUser = auth.currentUser;
  if (firebaseUser?.email) {
    try {
      const globalRef = doc(db, 'operators', firebaseUser.email.toLowerCase());
      const opSnap = await getDoc(globalRef);
      if (opSnap.exists()) {
        const opData = opSnap.data() as Operator;
        if (opData.status !== 'active') {
          throw new Error('Su cuenta de operador ha sido desactivada por el administrador.');
        }

        const userDoc = await getDoc(doc(db, 'users', uid));
        const baseUser = userDoc.exists() ? (userDoc.data() as User) : { id: uid, name: 'Usuario Yaa POS', email: '' };
        
        // Validate block/suspension for the owner in operator session
        if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
          const licenseDoc = await getDoc(doc(db, 'licenses', uid));
          const license = licenseDoc.exists() ? licenseDoc.data() as License : null;
          const validation = performValidation(license, baseUser);
          if (validation.isBlocked) {
            throw new Error(validation.reason);
          }
        }

        return {
          ...baseUser,
          id: uid,
          name: opData.name,
          email: opData.email,
          role: opData.role,
          isOperator: true,
          operatorId: opData.id,
          disabledTabs: opData.disabledTabs || []
        };
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes('desactivada') || err.message.includes('suspendida') || err.message.includes('licencia') || err.message.includes('expirado'))) {
        throw err;
      }
      console.warn("Failed to reconstruct operator profile, falling back to base user:", err);
    }
  }

  const userDoc = await getDoc(doc(db, 'users', uid));
  const baseUser = userDoc.exists() ? (userDoc.data() as User) : { id: uid, name: 'Usuario Yaa POS', email: '' };

  // Validate standard owner profile and license status
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    const licenseDoc = await getDoc(doc(db, 'licenses', uid));
    const license = licenseDoc.exists() ? licenseDoc.data() as License : null;
    const validation = performValidation(license, baseUser);
    if (validation.isBlocked) {
      throw new Error(validation.reason);
    }
  }

  return baseUser;
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

    if (list.length === 0) {
      // Prepopulate with default operators using real owner info
      const defaults: Operator[] = [
        { 
          id: '1', 
          name: correctName, 
          email: correctEmail, 
          role: 'Propietario / Administrador', 
          password: 'adminpassword123', 
          status: 'active', 
          ownerId: uid,
          disabledTabs: []
        },
        { id: '2', name: 'Cajero Principal', email: 'cajero1@yaapos.com', role: 'Cajero', password: 'cajero123', status: 'active', ownerId: uid, disabledTabs: [] },
        { id: '3', name: 'Almacenero Turno Mañana', email: 'almacen@yaapos.com', role: 'Supervisor de Almacén', password: 'almacen123', status: 'active', ownerId: uid, disabledTabs: [] }
      ];
      for (const op of defaults) {
        await saveOperator(op);
      }
      return defaults;
    }

    // Dynamic retroactive correction:
    // If we have an existing operator that is ID "1", has the role "Propietario / Administrador", 
    // or has the old placeholder email "juancastr19.14@gmail.com", we correct its info with the real owner's details.
    let updatedAny = false;
    const correctedList = await Promise.all(list.map(async (op) => {
      if (op.role === 'Propietario / Administrador' || op.email === 'juancastr19.14@gmail.com' || op.id === '1') {
        if (op.email !== correctEmail || op.name !== correctName) {
          const updatedOp: Operator = {
            ...op,
            name: correctName,
            email: correctEmail,
            role: 'Propietario / Administrador'
          };
          
          // Delete old document if the email changed to prevent duplicate keys
          if (op.email && op.email.toLowerCase() !== correctEmail.toLowerCase()) {
            const oldNormalized = op.email.toLowerCase();
            try {
              await deleteDoc(doc(db, 'users', uid, 'operators', oldNormalized));
              await deleteDoc(doc(db, 'operators', oldNormalized));
            } catch (delErr) {
              console.warn("Failed to delete stale/pre-migrated admin operator doc:", delErr);
            }
          }

          try {
            await saveOperator(updatedOp);
            updatedAny = true;
          } catch (e) {
            console.error("Failed to dynamically update admin operator seed info:", e);
          }
          return updatedOp;
        }
      }
      return op;
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
  
  const opToSave = { ...operator, ownerId: uid };
  const normalizedEmail = opToSave.email.toLowerCase();
  
  // Fetch existing operator password if any, to check if password changed
  let oldPassword: string | undefined;
  try {
    const existingSnap = await getDoc(doc(db, 'operators', normalizedEmail));
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as Operator;
      oldPassword = existingData.password;
    }
  } catch (err) {
    console.warn("Could not read existing operator password for sync:", err);
  }

  // Create standard Auth user or sync credentials
  await syncOperatorAuth(opToSave.email, oldPassword, opToSave.password);
  
  // 1. Save in the owner's isolated subcollection using email as doc ID
  await setDoc(doc(db, 'users', uid, 'operators', normalizedEmail), opToSave);
  
  // 2. Save in the global collection for login lookup
  const globalRef = doc(db, 'operators', normalizedEmail);
  await setDoc(globalRef, opToSave);
  
  return opToSave;
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
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id
      } as User;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function getAdminUserFiles(userId: string): Promise<UserFile[]> {
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'files'));
    return snapshot.docs.map(doc => doc.data() as UserFile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/files`);
  }
}

export async function getAdminLicenses(): Promise<License[]> {
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    const snapshot = await getDocs(collection(db, 'licenses'));
    return snapshot.docs.map(doc => doc.data() as License);
  } catch (error) {
    console.error('Error fetching admin licenses from Firestore:', error);
    return [];
  }
}

export async function saveAdminLicense(license: License): Promise<License> {
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    await setDoc(doc(db, 'licenses', license.userId), license);
    return license;
  } catch (error) {
    console.error('Error saving admin license to Firestore:', error);
    throw error;
  }
}

export async function saveAdminUser(user: User): Promise<User> {
  const uid = getToken();
  if (uid !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
    throw new Error('Acceso no autorizado: Solo administradores.');
  }
  try {
    await setDoc(doc(db, 'users', user.id), user);
    return user;
  } catch (error) {
    console.error('Error saving admin user to Firestore:', error);
    throw error;
  }
}

export async function deleteAdminUser(userId: string): Promise<void> {
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
    const docSnap = await getDoc(doc(db, 'licenses', userId));
    if (docSnap.exists()) {
      return docSnap.data() as License;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user license from Firestore:', error);
    return null;
  }
}

export function subscribeUserLicense(userId: string, callback: (license: License | null) => void): () => void {
  try {
    const unsub = onSnapshot(doc(db, 'licenses', userId), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as License);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error listening to user license in Firestore:', error);
    });
    return unsub;
  } catch (error) {
    console.error('Error subscribing to user license:', error);
    return () => {};
  }
}

export function subscribeUserProfile(userId: string, callback: (user: User | null) => void): () => void {
  try {
    const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as User);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error listening to user profile in Firestore:', error);
    });
    return unsub;
  } catch (error) {
    console.error('Error subscribing to user profile:', error);
    return () => {};
  }
}

// --- CLOUD CRUD API (Isolated under /users/{userId}/... for complete security) ---

// Products
export async function getProducts(): Promise<Product[]> {
  return getCollectionDocs<Product>(getCollectionRef('products'));
}

export async function saveProduct(product: Product): Promise<Product> {
  let docId = product.id;
  if (!docId) {
    const colRef = getCollectionRef('products');
    docId = doc(colRef).id;
    product = { ...product, id: docId };
  }
  await setDoc(getDocRef('products', docId), product);
  return product;
}

export async function deleteProduct(id: string): Promise<{ success: boolean }> {
  await deleteDoc(getDocRef('products', id));
  return { success: true };
}

// Clients
export async function getClients(): Promise<Client[]> {
  return getCollectionDocs<Client>(getCollectionRef('clients'));
}

export async function saveClient(client: Client): Promise<Client> {
  let docId = client.id;
  if (!docId) {
    const colRef = getCollectionRef('clients');
    docId = doc(colRef).id;
    client = { ...client, id: docId };
  }
  await setDoc(getDocRef('clients', docId), client);
  return client;
}

export async function deleteClient(id: string): Promise<{ success: boolean }> {
  await deleteDoc(getDocRef('clients', id));
  return { success: true };
}

// Providers
export async function getProviders(): Promise<Provider[]> {
  return getCollectionDocs<Provider>(getCollectionRef('providers'));
}

export async function saveProvider(provider: Provider): Promise<Provider> {
  let docId = provider.id;
  if (!docId) {
    const colRef = getCollectionRef('providers');
    docId = doc(colRef).id;
    provider = { ...provider, id: docId };
  }
  await setDoc(getDocRef('providers', docId), provider);
  return provider;
}

export async function deleteProvider(id: string): Promise<{ success: boolean }> {
  await deleteDoc(getDocRef('providers', id));
  return { success: true };
}

// Sales
export async function getSales(): Promise<Sale[]> {
  return getCollectionDocs<Sale>(getCollectionRef('sales'));
}

export async function saveSale(sale: Sale): Promise<Sale> {
  let docId = sale.id;
  if (!docId) {
    const colRef = getCollectionRef('sales');
    docId = doc(colRef).id;
    sale = { ...sale, id: docId };
  }
  await setDoc(getDocRef('sales', docId), sale);
  return sale;
}

// Purchases
export async function getPurchases(): Promise<Purchase[]> {
  return getCollectionDocs<Purchase>(getCollectionRef('purchases'));
}

export async function savePurchase(purchase: Purchase): Promise<Purchase> {
  let docId = purchase.id;
  if (!docId) {
    const colRef = getCollectionRef('purchases');
    docId = doc(colRef).id;
    purchase = { ...purchase, id: docId };
  }
  await setDoc(getDocRef('purchases', docId), purchase);
  return purchase;
}

// Expenses
export async function getExpenses(): Promise<Expense[]> {
  return getCollectionDocs<Expense>(getCollectionRef('expenses'));
}

export async function saveExpense(expense: Expense): Promise<Expense> {
  let docId = expense.id;
  if (!docId) {
    const colRef = getCollectionRef('expenses');
    docId = doc(colRef).id;
    expense = { ...expense, id: docId };
  }
  await setDoc(getDocRef('expenses', docId), expense);
  return expense;
}

export async function deleteExpense(id: string): Promise<{ success: boolean }> {
  await deleteDoc(getDocRef('expenses', id));
  return { success: true };
}

// Shifts
export async function getShifts(): Promise<Shift[]> {
  return getCollectionDocs<Shift>(getCollectionRef('shifts'));
}

export async function saveShift(shift: Shift): Promise<Shift> {
  let docId = shift.id;
  if (!docId) {
    const colRef = getCollectionRef('shifts');
    docId = doc(colRef).id;
    shift = { ...shift, id: docId };
  }
  await setDoc(getDocRef('shifts', docId), shift);
  return shift;
}

// AppConfig
export async function getConfig(): Promise<AppConfig> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  const docRef = doc(db, 'users', uid, 'configs', 'storeConfig');
  const docSnap = await getDocumentSnap(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as AppConfig;
  }
  const defaultConfig: AppConfig = {
    storeName: 'Yaa POS',
    currency: 'Q',
    alertDaysBeforeExpiration: 30,
    businessType: 'general'
  };
  await setDoc(docRef, defaultConfig);
  return defaultConfig;
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');
  const docRef = doc(db, 'users', uid, 'configs', 'storeConfig');
  await setDoc(docRef, config);
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
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
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

export function subscribeSales(callback: (sales: Sale[], metadata?: SyncMetadata) => void): () => void {
  try {
    const colRef = getCollectionRef('sales');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Sale);
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.error('Error in subscribeSales:', error);
    });
  } catch (err) {
    console.warn('Could not establish sales subscription:', err);
    return () => {};
  }
}

export function subscribePurchases(callback: (purchases: Purchase[], metadata?: SyncMetadata) => void): () => void {
  try {
    const colRef = getCollectionRef('purchases');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Purchase);
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.error('Error in subscribePurchases:', error);
    });
  } catch (err) {
    console.warn('Could not establish purchases subscription:', err);
    return () => {};
  }
}

export function subscribeExpenses(callback: (expenses: Expense[], metadata?: SyncMetadata) => void): () => void {
  try {
    const colRef = getCollectionRef('expenses');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Expense);
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.error('Error in subscribeExpenses:', error);
    });
  } catch (err) {
    console.warn('Could not establish expenses subscription:', err);
    return () => {};
  }
}

export function subscribeShifts(callback: (shifts: Shift[], metadata?: SyncMetadata) => void): () => void {
  try {
    const colRef = getCollectionRef('shifts');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Shift);
      callback(list, {
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
    }, (error) => {
      console.error('Error in subscribeShifts:', error);
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
        callback(docSnap.data() as AppConfig, {
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

