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
import { registrarLog } from '../utils/activityLog';

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
      createdAt: new Date()
    };
    await setDoc(ref, novo, { merge: true });
    const atual = await getDoc(ref);
    const criado = { id: user.uid, empresas: [], ...atual.data() };
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
    try {
      sessionStorage.setItem('orcatudo.justLoggedIn', '1');
    } catch { /* ignore */ }
    const dados = snap.exists() ? snap.data() : {};
    await registrarLog({
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName || dados.displayName,
      acao: 'login',
      detalhe: 'Entrou no sistema'
    });
    return cred;
  }

  async function logout() {
    const user = auth.currentUser;
    if (user && !isAdminEmail(user.email)) {
      await registrarLog({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || perfil?.displayName,
        acao: 'logout',
        detalhe: 'Saiu do sistema'
      });
    }
    setPerfil(null);
    try {
      sessionStorage.removeItem('orcatudo.justLoggedIn');
      if (user?.uid) sessionStorage.removeItem(`orcatudo.sessaoLog.${user.uid}`);
    } catch { /* ignore */ }
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
        const perfilCarregado = await carregarPerfil(user);
        if (user && !isAdminEmail(user.email)) {
          const sessaoKey = `orcatudo.sessaoLog.${user.uid}`;
          let recemLogin = false;
          try {
            recemLogin = sessionStorage.getItem('orcatudo.justLoggedIn') === '1';
            if (recemLogin) sessionStorage.removeItem('orcatudo.justLoggedIn');
          } catch { /* ignore */ }
          try {
            if (!recemLogin && !sessionStorage.getItem(sessaoKey)) {
              sessionStorage.setItem(sessaoKey, '1');
              await registrarLog({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || perfilCarregado?.displayName,
                acao: 'sessao',
                detalhe: 'Reabriu o sistema com sessão ativa'
              });
            } else if (recemLogin) {
              sessionStorage.setItem(sessaoKey, '1');
            }
          } catch { /* ignore */ }
        }
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
    recarregarPerfil: () => carregarPerfil(auth.currentUser || currentUser),
    criarUsuarioAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
