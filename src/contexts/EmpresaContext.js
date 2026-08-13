import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { EMPRESA_STORAGE_KEY, EMPRESA_NOME_STORAGE_KEY } from '../constants/admin';

const EmpresaContext = createContext();

export function useEmpresa() {
  return useContext(EmpresaContext);
}

async function migrarColecaoParaEmpresa(nomeColecao, userId, empresaId) {
  const snap = await getDocs(
    query(collection(db, nomeColecao), where('userId', '==', userId))
  );
  const pendentes = snap.docs.filter((d) => !d.data().empresaId);
  const CHUNK = 400;
  for (let i = 0; i < pendentes.length; i += CHUNK) {
    const batch = writeBatch(db);
    pendentes.slice(i, i + CHUNK).forEach((d) => {
      batch.update(d.ref, { empresaId });
    });
    await batch.commit();
  }
  return pendentes.length;
}

export function EmpresaProvider({ children }) {
  const { currentUser, perfil, isAdmin } = useAuth();
  const [empresaId, setEmpresaId] = useState(() => {
    try {
      return sessionStorage.getItem(EMPRESA_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [empresaNomeSalvo, setEmpresaNomeSalvo] = useState(() => {
    try {
      return sessionStorage.getItem(EMPRESA_NOME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const memberships = useMemo(() => perfil?.empresas || [], [perfil]);

  const membershipAtual = useMemo(
    () => memberships.find((e) => e.id === empresaId) || null,
    [memberships, empresaId]
  );

  useEffect(() => {
    if (!currentUser) {
      setEmpresaId('');
      setEmpresaNomeSalvo('');
      try {
        sessionStorage.removeItem(EMPRESA_STORAGE_KEY);
        sessionStorage.removeItem(EMPRESA_NOME_STORAGE_KEY);
      } catch { /* ignore */ }
      return;
    }
    if (empresaId && memberships.length > 0 && !memberships.some((e) => e.id === empresaId) && !isAdmin) {
      setEmpresaId('');
      setEmpresaNomeSalvo('');
      try {
        sessionStorage.removeItem(EMPRESA_STORAGE_KEY);
        sessionStorage.removeItem(EMPRESA_NOME_STORAGE_KEY);
      } catch { /* ignore */ }
    }
  }, [currentUser, empresaId, memberships, isAdmin]);

  useEffect(() => {
    if (!empresaId || isAdmin) return undefined;
    let cancelado = false;
    getDoc(doc(db, 'empresas', empresaId)).then((snap) => {
      if (cancelado) return;
      if (!snap.exists() || snap.data().bloqueada) {
        setEmpresaId('');
        setEmpresaNomeSalvo('');
        try {
          sessionStorage.removeItem(EMPRESA_STORAGE_KEY);
          sessionStorage.removeItem(EMPRESA_NOME_STORAGE_KEY);
        } catch { /* ignore */ }
      }
    }).catch(() => {});
    return () => { cancelado = true; };
  }, [empresaId, isAdmin]);

  const selecionarEmpresa = async (id, nome) => {
    const snap = await getDoc(doc(db, 'empresas', id));
    if (!snap.exists()) {
      throw new Error('Empresa não encontrada.');
    }
    if (snap.data().bloqueada && !isAdmin) {
      throw new Error('Esta empresa está bloqueada.');
    }
    const nomeFinal = nome || snap.data().nome || '';
    setEmpresaId(id);
    if (nomeFinal) {
      setEmpresaNomeSalvo(nomeFinal);
      try { sessionStorage.setItem(EMPRESA_NOME_STORAGE_KEY, nomeFinal); } catch { /* ignore */ }
    }
    try { sessionStorage.setItem(EMPRESA_STORAGE_KEY, id); } catch { /* ignore */ }
    if (currentUser?.uid && id) {
      try {
        await Promise.all([
          migrarColecaoParaEmpresa('insumos', currentUser.uid, id),
          migrarColecaoParaEmpresa('composicoes', currentUser.uid, id),
          migrarColecaoParaEmpresa('orcamentos', currentUser.uid, id)
        ]);
      } catch (e) {
        console.warn('Falha ao migrar dados existentes para a empresa', e);
      }
    }
  };

  const limparEmpresa = () => {
    setEmpresaId('');
    setEmpresaNomeSalvo('');
    try {
      sessionStorage.removeItem(EMPRESA_STORAGE_KEY);
      sessionStorage.removeItem(EMPRESA_NOME_STORAGE_KEY);
    } catch { /* ignore */ }
  };

  const criarEmpresa = async (dados) => {
    const nomeTrim = String(dados?.nome || dados || '').trim();
    if (!nomeTrim) throw new Error('Informe o nome da empresa.');
    const nomeNorm = nomeTrim.replace(/\s+/g, ' ').toLowerCase();
    const existentes = await getDocs(collection(db, 'empresas'));
    const duplicada = existentes.docs.some((d) =>
      String(d.data().nome || '').trim().replace(/\s+/g, ' ').toLowerCase() === nomeNorm
    );
    if (duplicada) {
      throw new Error(`Já existe uma empresa com o nome "${nomeTrim}".`);
    }
    const extras = typeof dados === 'object' && dados ? dados : {};
    const ref = await addDoc(collection(db, 'empresas'), {
      nome: nomeTrim,
      endereco: String(extras.endereco || '').trim(),
      telefone: String(extras.telefone || '').trim(),
      email: String(extras.email || '').trim(),
      cnpj: String(extras.cnpj || '').trim(),
      bloqueada: false,
      createdAt: new Date(),
      createdBy: currentUser.uid
    });
    return { id: ref.id, nome: nomeTrim };
  };

  const colaborador = Boolean(isAdmin || membershipAtual?.colaborador);
  const podeEditar = colaborador;
  const empresaNome = membershipAtual?.nome || empresaNomeSalvo || '';

  const value = {
    empresaId,
    empresaNome,
    memberships,
    membershipAtual,
    colaborador,
    podeEditar,
    selecionarEmpresa,
    limparEmpresa,
    criarEmpresa
  };

  return (
    <EmpresaContext.Provider value={value}>
      {children}
    </EmpresaContext.Provider>
  );
}
