import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/design-tokens.css';
import './App.css';

import Navbar from './components/Navbar';
import Home from './components/Home';
import Assinar from './components/Assinar';
import AssinarSucesso from './components/AssinarSucesso';
import Dashboard from './components/Dashboard';
import Insumos from './components/Insumos';
import Composicoes from './components/Composicoes';
import Orcamentos from './components/Orcamentos';
import OrcamentoEAP from './components/OrcamentoEAP';
import CurvaABC from './components/CurvaABC';
import Comparativo from './components/Comparativo';
import Login from './components/Login';
import SelecaoEmpresa from './components/SelecaoEmpresa';
import AdminUsuarios from './components/AdminUsuarios';
import { AuthProvider } from './contexts/AuthContext';
import { EmpresaProvider } from './contexts/EmpresaContext';
import PrivateRoute from './components/PrivateRoute';

function AppShell({ children }) {
  return <Container className="mt-4">{children}</Container>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <EmpresaProvider>
          <div className="App">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/assinar" element={<Assinar />} />
              <Route path="/assinar/sucesso" element={<AssinarSucesso />} />
              <Route path="/login" element={<Login />} />
              <Route path="/empresas" element={
                <PrivateRoute requireEmpresa={false}>
                  <AppShell>
                    <SelecaoEmpresa />
                  </AppShell>
                </PrivateRoute>
              } />
              <Route path="/admin" element={
                <PrivateRoute adminOnly requireEmpresa={false}>
                  <AppShell>
                    <AdminUsuarios />
                  </AppShell>
                </PrivateRoute>
              } />
              <Route path="/app" element={
                <PrivateRoute>
                  <AppShell>
                    <Dashboard />
                  </AppShell>
                </PrivateRoute>
              } />
              <Route path="/insumos" element={
                <PrivateRoute>
                  <AppShell>
                    <Insumos />
                  </AppShell>
                </PrivateRoute>
              } />
              <Route path="/composicoes" element={
                <PrivateRoute>
                  <AppShell>
                    <Composicoes />
                  </AppShell>
                </PrivateRoute>
              } />
              <Route path="/orcamentos" element={
                <PrivateRoute>
                  <AppShell>
                    <Orcamentos />
                  </AppShell>
                </PrivateRoute>
              } />
              <Route path="/orcamentos/:id/eap" element={
                <PrivateRoute>
                  <AppShell>
                    <OrcamentoEAP />
                  </AppShell>
                </PrivateRoute>
              } />
              <Route path="/orcamentos/:id/curva-abc" element={
                <PrivateRoute>
                  <AppShell>
                    <CurvaABC />
                  </AppShell>
                </PrivateRoute>
              } />
              <Route path="/comparativo" element={
                <PrivateRoute>
                  <AppShell>
                    <Comparativo />
                  </AppShell>
                </PrivateRoute>
              } />
            </Routes>
          </div>
        </EmpresaProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
