import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
  signOut
} from 'firebase/auth';

export const ADMIN_EMAIL = 'mateus.desenv@gmail.com';
export const LIGHT_USER_ROLE = 'light';

const firebaseConfig = {
  apiKey: 'AIzaSyA6s7jYzTrLgUv_p0LhYAE_AC_HWkFt27s',
  authDomain: 'codexa-live-projects-73c34.firebaseapp.com',
  projectId: 'codexa-live-projects-73c34',
  storageBucket: 'codexa-live-projects-73c34.firebasestorage.app',
  messagingSenderId: '285248631701',
  appId: '1:285248631701:web:1d2aa69d34e2d1c1347c9c'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const persistenceReady = setPersistence(auth, browserLocalPersistence);

export function isAdminUser(user) {
  return isAdminEmail(user?.email);
}

export function isAdminEmail(email) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export function getUserRole(user) {
  return isAdminUser(user) ? 'admin' : LIGHT_USER_ROLE;
}

export function getUserName(user) {
  return user?.displayName || user?.email || 'Usuário Light';
}

export async function signInWithGoogle() {
  await persistenceReady;
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export function signOutUser() {
  return signOut(auth);
}
