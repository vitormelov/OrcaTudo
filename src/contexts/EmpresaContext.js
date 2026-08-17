import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { EMPRESA_STORAGE_KEY, EMPRESA_NOME_STORAGE_KEY } from '../constants/admin';
import { registrarLog } from '../utils/activityLog';
import { soDigitos, validarCpf, validarCpfCnpj, tipoDocumento } from '../utils/documentoFiscal';

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
  const { currentUser, perfil, isAdmin, recarregarPerfil, setPerfil } = useAuth();
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
      await registrarLog({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || perfil?.displayName,
        acao: 'empresa',
        detalhe: `Acessou a empresa ${nomeFinal}`,
        empresaId: id,
        empresaNome: nomeFinal
      });
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
    const documento = soDigitos(extras.cnpj || '');
    if (documento && !validarCpfCnpj(documento)) {
      throw new Error('Informe um CNPJ ou CPF válido.');
    }
    if (documento) {
      const idx = await getDoc(doc(db, 'empresasPorCnpj', documento));
      if (idx.exists()) {
        throw new Error(`Já existe uma empresa cadastrada com este ${tipoDocumento(documento) || 'documento'}.`);
      }
    }
    const ref = await addDoc(collection(db, 'empresas'), {
      nome: nomeTrim,
      endereco: String(extras.endereco || '').trim(),
      telefone: String(extras.telefone || '').trim(),
      email: String(extras.email || '').trim().toLowerCase(),
      cnpj: documento,
      tipoDocumento: tipoDocumento(documento) || '',
      bloqueada: false,
      createdAt: new Date(),
      createdBy: currentUser.uid
    });
    if (documento) {
      try {
        await setDoc(doc(db, 'empresasPorCnpj', documento), {
          empresaId: ref.id,
          nome: nomeTrim,
          email: String(extras.email || '').trim().toLowerCase(),
          createdBy: currentUser.uid,
          createdAt: new Date()
        });
      } catch (e) {
        await deleteDoc(doc(db, 'empresas', ref.id)).catch(() => {});
        if (e?.code === 'permission-denied') {
          throw new Error('Sem permissão para gravar o CPF/CNPJ. Publique as regras do Firestore e tente de novo.');
        }
        throw e;
      }
    }
    return { id: ref.id, nome: nomeTrim };
  };

  const criarMinhaEmpresa = async (dados) => {
    if (!currentUser?.uid) throw new Error('Faça login para criar uma empresa.');
    if (perfil?.criouEmpresa) {
      throw new Error('Você já criou uma empresa. Para outras, entre pelo CPF ou CNPJ.');
    }
    const nomeTrim = String(dados?.nome || '').trim();
    const emailTrim = String(dados?.email || '').trim().toLowerCase();
    const documento = soDigitos(dados?.cnpj);
    if (!nomeTrim) throw new Error('Informe o nome da empresa.');
    if (!emailTrim) throw new Error('Informe o e-mail da empresa.');
    if (!validarCpfCnpj(documento)) {
      throw new Error('Informe um CNPJ válido ou o seu CPF.');
    }
    if (validarCpf(documento)) {
      const cpfUsuario = soDigitos(perfil?.cpf || perfil?.cpfCnpj);
      if (cpfUsuario && documento !== cpfUsuario) {
        throw new Error('Para cadastrar sem CNPJ, use o seu próprio CPF.');
      }
    }

    const idx = await getDoc(doc(db, 'empresasPorCnpj', documento));
    if (idx.exists()) {
      throw new Error(`Já existe uma empresa cadastrada com este ${tipoDocumento(documento)}. Use “Acessar empresa”.`);
    }

    const agora = new Date();
    const endereco = String(dados?.endereco || '').trim();
    const telefone = String(dados?.telefone || '').trim();
    const ref = await addDoc(collection(db, 'empresas'), {
      nome: nomeTrim,
      endereco,
      telefone,
      email: emailTrim,
      cnpj: documento,
      tipoDocumento: tipoDocumento(documento),
      bloqueada: false,
      origem: 'usuario',
      createdAt: agora,
      createdBy: currentUser.uid
    });

    try {
      await setDoc(doc(db, 'empresasPorCnpj', documento), {
        empresaId: ref.id,
        nome: nomeTrim,
        email: emailTrim,
        createdBy: currentUser.uid,
        createdAt: agora
      });
    } catch (e) {
      await deleteDoc(doc(db, 'empresas', ref.id)).catch(() => {});
      throw new Error(`Já existe uma empresa cadastrada com este ${tipoDocumento(documento)}. Use “Acessar empresa”.`);
    }

    await setDoc(doc(db, 'empresas', ref.id, 'membros', currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName || perfil?.displayName || '',
      colaborador: true,
      createdAt: agora
    });

    const empresasUser = [
      ...(perfil?.empresas || []).filter((x) => x.id !== ref.id),
      { id: ref.id, nome: nomeTrim, colaborador: true }
    ];
    await updateDoc(doc(db, 'usuarios', currentUser.uid), {
      criouEmpresa: true,
      empresaCriadaId: ref.id,
      empresas: empresasUser
    });
    if (typeof recarregarPerfil === 'function') {
      await recarregarPerfil();
    } else if (setPerfil) {
      setPerfil((prev) => ({
        ...(prev || {}),
        criouEmpresa: true,
        empresaCriadaId: ref.id,
        empresas: empresasUser
      }));
    }
    return { id: ref.id, nome: nomeTrim };
  };

  const buscarEmpresaPorCnpj = async (cnpjRaw) => {
    const documento = soDigitos(cnpjRaw);
    if (!validarCpfCnpj(documento)) throw new Error('Informe um CPF ou CNPJ válido.');
    const snap = await getDoc(doc(db, 'empresasPorCnpj', documento));
    if (!snap.exists()) {
      throw new Error('Nenhuma empresa encontrada com este CPF ou CNPJ.');
    }
    return { cnpj: documento, ...snap.data() };
  };

  const entrarPorCnpj = async (cnpjRaw) => {
    if (!currentUser?.uid) throw new Error('Faça login para acessar uma empresa.');
    const encontrada = await buscarEmpresaPorCnpj(cnpjRaw);
    const empresaId = encontrada.empresaId;
    const nome = encontrada.nome || 'Empresa';
    if ((perfil?.empresas || []).some((e) => e.id === empresaId)) {
      return { id: empresaId, nome, jaEraMembro: true };
    }

    const agora = new Date();
    await setDoc(doc(db, 'empresas', empresaId, 'membros', currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName || perfil?.displayName || '',
      colaborador: true,
      createdAt: agora
    });

    const empresasUser = [
      ...(perfil?.empresas || []),
      { id: empresaId, nome, colaborador: true }
    ];
    await updateDoc(doc(db, 'usuarios', currentUser.uid), {
      empresas: empresasUser
    });
    if (typeof recarregarPerfil === 'function') {
      await recarregarPerfil();
    } else if (setPerfil) {
      setPerfil((prev) => ({ ...(prev || {}), empresas: empresasUser }));
    }
    return { id: empresaId, nome, jaEraMembro: false };
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
    criarEmpresa,
    criarMinhaEmpresa,
    buscarEmpresaPorCnpj,
    entrarPorCnpj
  };

  return (
    <EmpresaContext.Provider value={value}>
      {children}
    </EmpresaContext.Provider>
  );
}
