import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Insumos from './components/Insumos';
import Composicoes from './components/Composicoes';
import Orcamentos from './components/Orcamentos';
import OrcamentoEAP from './components/OrcamentoEAP';
import Login from './components/Login';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar />
          <Container className="mt-4">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="/insumos" element={
                <PrivateRoute>
                  <Insumos />
                </PrivateRoute>
              } />
              <Route path="/composicoes" element={
                <PrivateRoute>
                  <Composicoes />
                </PrivateRoute>
              } />
              <Route path="/orcamentos" element={
                <PrivateRoute>
                  <Orcamentos />
                </PrivateRoute>
              } />
              <Route path="/orcamentos/:id/eap" element={
                <PrivateRoute>
                  <OrcamentoEAP />
                </PrivateRoute>
              } />
            </Routes>
          </Container>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
