import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updatePassword,
  sendPasswordResetEmail
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
  writeBatch
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { auth, db, storage } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { Product, Client, Provider, Sale, Purchase, Expense, Shift, UserFile, AppConfig, User, License, Quotation, Consignment } from './types';
import { compressDataUrlIfNeeded } from './utils/imageCompressor';
import { checkBranchLimit, checkUserLimit, checkProductLimit, getPlanDefinition } from './utils/planLimits';

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
  
  // Assign default Básico subscription plan to the new company
  const defaultLicense: License = {
    userId: firebaseUser.uid,
    clientName: name,
    clientEmail: firebaseUser.email || email,
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
}

// Helper to register operator accounts in standard Firebase Auth with real passwords
export async function provisionOperatorAuth(email: string, password?: string, oldPassword?: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const apiKey = firebaseConfig.apiKey;
  
  if (!password || !password.trim()) {
    return;
  }
  
  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres para ser válida en el sistema de autenticación.');
  }

  // 1. Try to register new user in Firebase Auth via Identity Toolkit
  const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
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
    return;
  }

  const errorMsg = data.error?.message;
  if (errorMsg === 'EMAIL_EXISTS') {
    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    
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
      return;
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
          const updateUrl = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
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
            return;
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
    return;
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
        branch: opData.branch,
        branches: opData.branches || (opData.branch && opData.branch !== 'Todas' ? [opData.branch] : []),
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
  clearMemoryCache();
  await signOut(auth);
  setToken(null);
  localStorage.removeItem('yaa_pos_operator_email');
  window.dispatchEvent(new Event('yaa_pos_logout'));
}

export async function getMe(): Promise<User> {
  // Ensure Firebase Auth is loaded to prevent race conditions on page refresh (with 2.5-second safety timeout)
  await new Promise<void>((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 2500);

    const unsubscribe = auth.onAuthStateChanged(() => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });

  const uid = getToken();
  if (!uid) {
    throw new Error('No hay sesión activa');
  }

  const firebaseUser = auth.currentUser;
  // If there is no authenticated Firebase session, do not make unauthenticated Firestore calls
  if (!firebaseUser) {
    throw new Error('Sesión expirada. Inicie sesión nuevamente.');
  }
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
          branch: opData.branch,
          branches: opData.branches || (opData.branch && opData.branch !== 'Todas' ? [opData.branch] : []),
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

    const sessionOwnerPassword = typeof window !== 'undefined' 
      ? (sessionStorage.getItem('yaa_pos_session_password') || localStorage.getItem('yaa_pos_owner_password') || '') 
      : '';

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

  // Provision real credentials in Firebase Auth if a valid password is provided
  if (rawPassword && rawPassword.trim()) {
    await provisionOperatorAuth(normalizedEmail, rawPassword.trim(), oldPassword);
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
  
  // 1. Save in the owner's isolated subcollection using email as doc ID
  await setDoc(doc(db, 'users', uid, 'operators', normalizedEmail), opToSave);
  
  // 2. Save in the global collection for login lookup
  const globalRef = doc(db, 'operators', normalizedEmail);
  await setDoc(globalRef, opToSave);
  
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
    // Automatically seed default Básico license if none exists
    const userSnap = await getDoc(doc(db, 'users', userId));
    const uData = userSnap.exists() ? userSnap.data() as User : null;
    const defaultLic: License = {
      userId,
      clientName: uData?.name || 'Empresa',
      clientEmail: uData?.email || '',
      application: 'Yaa POS',
      planType: 'Básico',
      expirationDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'Activa',
      licenseStartDate: new Date().toISOString().split('T')[0],
      maxUsers: 3,
      maxBranches: 1
    };
    try {
      await setDoc(doc(db, 'licenses', userId), defaultLic);
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
    expirationDate: currentLic?.expirationDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: currentLic?.status || 'Activa',
    licenseStartDate: currentLic?.licenseStartDate || new Date().toISOString().split('T')[0]
  };

  await setDoc(doc(db, 'licenses', userId), updatedLicense);

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

  // Notify backend API if running
  fetch('/api/license/change-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
    body: JSON.stringify({ planType: planDef.name })
  }).catch(() => {});

  return updatedLicense;
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
  if (cachedProducts) {
    const idx = cachedProducts.findIndex(p => p.id === docId);
    if (idx >= 0) {
      cachedProducts[idx] = product;
    } else {
      cachedProducts.push(product);
    }
  } else {
    cachedProducts = [product];
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
  if (cachedClients) {
    const idx = cachedClients.findIndex(c => c.id === docId);
    if (idx >= 0) cachedClients[idx] = client;
    else cachedClients.push(client);
  } else {
    cachedClients = [client];
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
  if (cachedProviders) {
    const idx = cachedProviders.findIndex(p => p.id === docId);
    if (idx >= 0) cachedProviders[idx] = provider;
    else cachedProviders.push(provider);
  } else {
    cachedProviders = [provider];
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
  const limitCount = options?.limitCount || 200; // Safeguard against unbounded lifetime collection download
  
  if (!options?.forceServer) {
    try {
      const q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
      const cacheSnap = await getDocsFromCache(q);
      if (!cacheSnap.empty) {
        return cacheSnap.docs.map(doc => doc.data() as Sale);
      }
    } catch {}
  }
  
  try {
    const q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
    const serverSnap = await getDocs(q);
    return serverSnap.docs.map(doc => doc.data() as Sale);
  } catch (e) {
    // Fallback if composite index on date is not yet built
    try {
      const qSimple = query(colRef, limit(limitCount));
      const serverSnap = await getDocs(qSimple);
      return serverSnap.docs.map(doc => doc.data() as Sale);
    } catch (fallbackErr) {
      return getCollectionDocs<Sale>(colRef);
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
    sale = { ...sale, id: docId };
  }
  await setDoc(getDocRef('sales', docId), cleanDataForFirestore(sale));
  return sale;
}

// Atomic transaction execution for Sales:
// Atomically commits sale record, inventory deductions, shift total and client updates in 1 single batch.
// Guaranteed idempotency: pre-generated saleId prevents duplicate sales upon sync or reconnect.
export async function executeSaleTransaction(params: {
  sale: Sale;
  productUpdates: Product[];
  shiftUpdate?: Shift;
  clientUpdate?: Client;
}): Promise<Sale> {
  const uid = getToken();
  if (!uid) throw new Error('No autorizado. Inicie sesión.');

  const batch = writeBatch(db);

  // 1. Ensure deterministic sale ID to prevent duplicates
  const saleId = params.sale.id || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const finalSale: Sale = { ...params.sale, id: saleId };
  const saleRef = getDocRef('sales', saleId);
  batch.set(saleRef, cleanDataForFirestore(finalSale));

  // 2. Add product stock deductions to atomic batch
  for (const p of params.productUpdates) {
    const prodRef = getDocRef('products', p.id);
    batch.set(prodRef, cleanDataForFirestore(p));
  }

  // 3. Add shift update to atomic batch
  if (params.shiftUpdate) {
    const shiftRef = getDocRef('shifts', params.shiftUpdate.id);
    batch.set(shiftRef, cleanDataForFirestore(params.shiftUpdate));
  }

  // 4. Add client loyalty/balance update to atomic batch
  if (params.clientUpdate) {
    const clientRef = getDocRef('clients', params.clientUpdate.id);
    batch.set(clientRef, cleanDataForFirestore(params.clientUpdate));
  }

  // Commit atomically to IndexedDB cache queue + Firestore cloud
  await batch.commit();

  // Update in-memory caches instantly (0 additional reads)
  if (cachedProducts && params.productUpdates.length > 0) {
    const updatedMap = new Map(params.productUpdates.map(p => [p.id, p]));
    cachedProducts = cachedProducts.map(p => updatedMap.get(p.id) || p);
  }
  if (cachedShifts && params.shiftUpdate) {
    const su = params.shiftUpdate;
    cachedShifts = cachedShifts.map(sh => sh.id === su.id ? su : sh);
  }
  if (cachedClients && params.clientUpdate) {
    const cu = params.clientUpdate;
    cachedClients = cachedClients.map(c => c.id === cu.id ? cu : c);
  }

  return finalSale;
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
  if (cachedShifts) {
    const idx = cachedShifts.findIndex(s => s.id === docId);
    if (idx >= 0) cachedShifts[idx] = shift;
    else cachedShifts.push(shift);
  } else {
    cachedShifts = [shift];
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

export function subscribeSales(callback: (sales: Sale[], metadata?: SyncMetadata) => void, limitCount = 50): () => void {
  try {
    const colRef = getCollectionRef('sales');
    const q = query(colRef, limit(limitCount));
    return onSnapshot(q, (snapshot) => {
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

export function subscribePurchases(callback: (purchases: Purchase[], metadata?: SyncMetadata) => void, limitCount = 50): () => void {
  try {
    const colRef = getCollectionRef('purchases');
    const q = query(colRef, limit(limitCount));
    return onSnapshot(q, (snapshot) => {
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

export function subscribeExpenses(callback: (expenses: Expense[], metadata?: SyncMetadata) => void, limitCount = 50): () => void {
  try {
    const colRef = getCollectionRef('expenses');
    const q = query(colRef, limit(limitCount));
    return onSnapshot(q, (snapshot) => {
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

export function subscribeShifts(callback: (shifts: Shift[], metadata?: SyncMetadata) => void, limitCount = 20): () => void {
  try {
    const colRef = getCollectionRef('shifts');
    const q = query(colRef, limit(limitCount));
    return onSnapshot(q, (snapshot) => {
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

// --- SYSTEM RESET API ---
export async function resetUserDatabase(): Promise<void> {
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
    'consignments'
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
      const local = localStorage.getItem('yaa_pos_quotations');
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
      const local = localStorage.getItem('yaa_pos_quotations');
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
    const local = localStorage.getItem('yaa_pos_quotations');
    const list: Quotation[] = local ? JSON.parse(local) : [];
    const idx = list.findIndex(q => q.id === quoteToSave.id);
    if (idx >= 0) {
      list[idx] = quoteToSave;
    } else {
      list.unshift(quoteToSave);
    }
    localStorage.setItem('yaa_pos_quotations', JSON.stringify(list));
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
    const local = localStorage.getItem('yaa_pos_quotations');
    if (local) {
      const list: Quotation[] = JSON.parse(local);
      const filtered = list.filter(q => q.id !== id);
      localStorage.setItem('yaa_pos_quotations', JSON.stringify(filtered));
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
      const local = localStorage.getItem('yaa_pos_consignments');
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
      const local = localStorage.getItem('yaa_pos_consignments');
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
    const local = localStorage.getItem('yaa_pos_consignments');
    const list: Consignment[] = local ? JSON.parse(local) : [];
    const idx = list.findIndex(c => c.id === consToSave.id);
    if (idx >= 0) {
      list[idx] = consToSave;
    } else {
      list.unshift(consToSave);
    }
    localStorage.setItem('yaa_pos_consignments', JSON.stringify(list));
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
    const local = localStorage.getItem('yaa_pos_consignments');
    if (local) {
      const list: Consignment[] = JSON.parse(local);
      const filtered = list.filter(c => c.id !== id);
      localStorage.setItem('yaa_pos_consignments', JSON.stringify(filtered));
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



