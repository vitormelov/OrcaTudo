import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { isTrialExpirado } from '../utils/trial';

function PrivateRoute({
  children,
  adminOnly = false,
  requireEmpresa = true,
  allowTrialExpirado = false
}) {
  const { currentUser, isAdmin, perfil, logout } = useAuth();
  const { empresaId } = useEmpresa();
  const location = useLocation();
  const bloqueado = Boolean(perfil?.bloqueado && !isAdmin);
  const trialExpirado = Boolean(!isAdmin && isTrialExpirado(perfil));

  useEffect(() => {
    if (bloqueado) {
      logout();
    }
  }, [bloqueado, logout]);

  if (!currentUser || bloqueado) {
    return <Navigate to="/login" replace />;
  }

  if (trialExpirado && !allowTrialExpirado) {
    return <Navigate to="/assinatura-necessaria" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/app" replace />;
  }

  if (requireEmpresa && !empresaId && location.pathname !== '/empresas') {
    return <Navigate to="/empresas" replace />;
  }

  return children;
}

export default PrivateRoute;
