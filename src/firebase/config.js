import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBJwTlYAMSrnAXFqKy11b9z819SR5uoV6M",
  authDomain: "orcatudo-61cce.firebaseapp.com",
  projectId: "orcatudo-61cce",
  storageBucket: "orcatudo-61cce.firebasestorage.app",
  messagingSenderId: "656490245847",
  appId: "1:656490245847:web:63f3ec1c20281188648a92",
  measurementId: "G-M8GMEFTESP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
