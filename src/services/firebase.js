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
  apiKey: 'AIzaSyCL6u37p6Tp6NVQeEMWLeIfNxtrATDjniA',
  authDomain: 'codexa-live-projects.firebaseapp.com',
  projectId: 'codexa-live-projects',
  storageBucket: 'codexa-live-projects.firebasestorage.app',
  messagingSenderId: '1024392825177',
  appId: '1:1024392825177:web:3d5dcf2326eed33d9f6448'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const persistenceReady = setPersistence(auth, browserLocalPersistence);

export function isAdminUser(user) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL;
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
