import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, getSecondaryAuth } from '../firebase/config';
import { isAdminEmail } from '../constants/admin';

export const MENSAGEM_USUARIO_BLOQUEADO =
  'Seu usuário foi bloqueado. Entre em contato com o administrador.';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  async function carregarPerfil(user) {
    if (!user) {
      setPerfil(null);
      return null;
    }

    const ref = doc(db, 'usuarios', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() };
      if (isAdminEmail(user.email) && !data.isAdmin) {
        await setDoc(ref, { ...data, isAdmin: true, email: user.email }, { merge: true });
        data.isAdmin = true;
      }
      if (data.bloqueado && !isAdminEmail(user.email)) {
        setPerfil(null);
        await signOut(auth);
        const err = new Error(MENSAGEM_USUARIO_BLOQUEADO);
        err.code = 'auth/user-blocked';
        throw err;
      }
      setPerfil(data);
      return data;
    }

    const novo = {
      email: user.email,
      displayName: user.displayName || '',
      isAdmin: isAdminEmail(user.email),
      bloqueado: false,
      empresas: [],
      createdAt: new Date()
    };
    await setDoc(ref, novo);
    const criado = { id: user.uid, ...novo };
    setPerfil(criado);
    return criado;
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'usuarios', cred.user.uid));
    if (snap.exists() && snap.data().bloqueado && !isAdminEmail(cred.user.email)) {
      await signOut(auth);
      const err = new Error(MENSAGEM_USUARIO_BLOQUEADO);
      err.code = 'auth/user-blocked';
      throw err;
    }
    return cred;
  }

  async function logout() {
    setPerfil(null);
    return signOut(auth);
  }

  async function criarUsuarioAuth(email, password, displayName) {
    const secondary = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(secondary, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const uid = cred.user.uid;
    await signOut(secondary);
    return uid;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      try {
        await carregarPerfil(user);
      } catch (e) {
        if (e.code === 'auth/user-blocked') {
          setCurrentUser(null);
          setPerfil(null);
        } else {
          console.error('Erro ao carregar perfil', e);
          setPerfil(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const isAdmin = Boolean(perfil?.isAdmin || isAdminEmail(currentUser?.email));

  const value = {
    currentUser,
    perfil,
    setPerfil,
    isAdmin,
    loading,
    login,
    logout,
    recarregarPerfil: () => carregarPerfil(currentUser),
    criarUsuarioAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
