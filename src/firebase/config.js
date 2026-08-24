import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyBJwTlYAMSrnAXFqKy11b9z819SR5uoV6M',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'orcatudo-61cce.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'orcatudo-61cce',
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'orcatudo-61cce.firebasestorage.app',
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '656490245847',
  appId:
    process.env.REACT_APP_FIREBASE_APP_ID || '1:656490245847:web:63f3ec1c20281188648a92',
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-M8GMEFTESP'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === 'Secondary');
  const secondary = existing || initializeApp(firebaseConfig, 'Secondary');
  return getAuth(secondary);
}

export default app;
