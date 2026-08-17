import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { deveIgnorarRota, registrarLog, rotuloRota, purgarLogsAntigos } from '../utils/activityLog';

const PURGE_KEY = 'orcatudo.logsPurged';

function ActivityLogger() {
  const { currentUser, isAdmin, perfil } = useAuth();
  const { empresaId, empresaNome } = useEmpresa();
  const location = useLocation();
  const ultimaRota = useRef('');
  const purgeFeito = useRef(false);

  useEffect(() => {
    if (!currentUser || !isAdmin || purgeFeito.current) return;
    purgeFeito.current = true;
    try {
      if (sessionStorage.getItem(PURGE_KEY) === '1') return;
      sessionStorage.setItem(PURGE_KEY, '1');
    } catch { /* ignore */ }
    purgarLogsAntigos().catch((e) => {
      console.warn('Falha ao limpar logs antigos', e);
    });
  }, [currentUser, isAdmin]);

  useEffect(() => {
    if (!currentUser || isAdmin) return;
    const rota = location.pathname;
    if (deveIgnorarRota(rota) || ultimaRota.current === rota) return;
    ultimaRota.current = rota;
    registrarLog({
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName || perfil?.displayName,
      acao: 'pagina',
      detalhe: rotuloRota(rota),
      rota,
      empresaId,
      empresaNome
    });
  }, [location.pathname, currentUser, isAdmin, perfil, empresaId, empresaNome]);

  return null;
}

export default ActivityLogger;
