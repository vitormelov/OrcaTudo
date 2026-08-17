import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdminEmail } from '../constants/admin';

export const LOG_RETENCAO_DIAS = 60;

export const ACOES_LOG = {
  login: 'Login',
  logout: 'Logout',
  sessao: 'Sessão restaurada',
  pagina: 'Acesso à página',
  empresa: 'Entrou na empresa',
  trial: 'Iniciou trial'
};

const ROTAS_PUBLICAS = new Set(['/', '/login', '/assinar', '/assinar/sucesso']);

export function rotuloRota(pathname) {
  if (!pathname) return '—';
  if (pathname === '/app') return 'Dashboard';
  if (pathname === '/insumos') return 'Insumos';
  if (pathname === '/composicoes') return 'Composições';
  if (pathname === '/orcamentos') return 'Orçamentos';
  if (pathname === '/comparativo') return 'Comparativo';
  if (pathname === '/empresas') return 'Seleção de empresa';
  if (pathname.startsWith('/orcamentos/') && pathname.endsWith('/eap')) return 'EAP do orçamento';
  if (pathname.startsWith('/orcamentos/') && pathname.endsWith('/curva-abc')) return 'Curva ABC';
  if (pathname === '/assinatura-necessaria') return 'Trial expirado';
  return pathname;
}

export function deveIgnorarRota(pathname) {
  return !pathname || ROTAS_PUBLICAS.has(pathname) || pathname.startsWith('/admin');
}

export function dataCorteLogs(dias = LOG_RETENCAO_DIAS) {
  const corte = new Date();
  corte.setDate(corte.getDate() - dias);
  return corte;
}

function dataExpiracaoLog(dias = LOG_RETENCAO_DIAS) {
  const expira = new Date();
  expira.setDate(expira.getDate() + dias);
  return expira;
}

export async function purgarLogsAntigos() {
  const corte = dataCorteLogs();
  let removidos = 0;
  for (let i = 0; i < 10; i += 1) {
    const snap = await getDocs(
      query(
        collection(db, 'logsAcesso'),
        where('createdAt', '<', corte),
        limit(400)
      )
    );
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    removidos += snap.size;
    if (snap.size < 400) break;
  }
  return removidos;
}

export async function registrarLog({
  uid,
  email,
  displayName,
  acao,
  detalhe = '',
  rota = '',
  empresaId = '',
  empresaNome = ''
}) {
  if (!uid || isAdminEmail(email)) return;
  try {
    await addDoc(collection(db, 'logsAcesso'), {
      uid,
      email: String(email || '').toLowerCase(),
      displayName: displayName || '',
      acao,
      detalhe: detalhe || '',
      rota: rota || '',
      empresaId: empresaId || '',
      empresaNome: empresaNome || '',
      createdAt: serverTimestamp(),
      expiraEm: dataExpiracaoLog()
    });
  } catch (e) {
    console.warn('Falha ao registrar log de acesso', e);
  }
}
