import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';

function PrivateRoute({ children, adminOnly = false, requireEmpresa = true }) {
  const { currentUser, isAdmin, perfil, logout } = useAuth();
  const { empresaId } = useEmpresa();
  const location = useLocation();
  const bloqueado = Boolean(perfil?.bloqueado && !isAdmin);

  useEffect(() => {
    if (bloqueado) {
      logout();
    }
  }, [bloqueado, logout]);

  if (!currentUser || bloqueado) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireEmpresa && !empresaId && location.pathname !== '/empresas') {
    return <Navigate to="/empresas" replace />;
  }

  return children;
}

export default PrivateRoute;
