import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container, Dropdown } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import {
  FaCalculator, FaBoxes, FaLayerGroup, FaFileInvoiceDollar,
  FaBalanceScale, FaUser, FaSignOutAlt, FaBuilding, FaUsersCog
} from 'react-icons/fa';

function NavigationBar() {
  const { currentUser, logout, isAdmin } = useAuth();
  const { empresaNome, limparEmpresa } = useEmpresa();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  async function handleLogout() {
    try {
      setError('');
      limparEmpresa();
      await logout();
      navigate('/login');
    } catch {
      setError('Falha ao sair da conta');
    }
  }

  if (!currentUser || location.pathname === '/login') {
    return null;
  }

  const naSelecao = location.pathname === '/empresas';

  return (
    <Navbar expand="lg" className="mb-3 app-navbar" variant="dark">
      <Container>
        <Navbar.Brand as={Link} to={naSelecao ? '/empresas' : '/'} className="d-flex align-items-center">
          <FaCalculator className="me-2" />
          Orçamento de Obra
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          {!naSelecao && (
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/" className="d-flex align-items-center">
                <FaCalculator className="me-1" />
                Dashboard
              </Nav.Link>
              <Nav.Link as={Link} to="/insumos" className="d-flex align-items-center">
                <FaBoxes className="me-1" />
                Insumos
              </Nav.Link>
              <Nav.Link as={Link} to="/composicoes" className="d-flex align-items-center">
                <FaLayerGroup className="me-1" />
                Composições
              </Nav.Link>
              <Nav.Link as={Link} to="/orcamentos" className="d-flex align-items-center">
                <FaFileInvoiceDollar className="me-1" />
                Orçamentos
              </Nav.Link>
              <Nav.Link as={Link} to="/comparativo" className="d-flex align-items-center">
                <FaBalanceScale className="me-1" />
                Comparativo
              </Nav.Link>
            </Nav>
          )}
          {naSelecao && <Nav className="me-auto" />}

          <Nav>
            {empresaNome && !naSelecao && (
              <Navbar.Text className="text-white me-3 d-none d-md-inline">
                <FaBuilding className="me-1" />
                {empresaNome}
              </Navbar.Text>
            )}
            <Dropdown>
              <Dropdown.Toggle variant="outline-light" id="dropdown-basic">
                <FaUser className="me-1" />
                {currentUser.displayName || currentUser.email}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => { limparEmpresa(); navigate('/empresas'); }}>
                  <FaBuilding className="me-2" />
                  Trocar empresa
                </Dropdown.Item>
                {isAdmin && (
                  <Dropdown.Item as={Link} to="/admin">
                    <FaUsersCog className="me-2" />
                    Administração
                  </Dropdown.Item>
                )}
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <FaSignOutAlt className="me-2" />
                  Sair
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>

      {error && (
        <div className="alert alert-danger m-2" role="alert">
          {error}
        </div>
      )}
    </Navbar>
  );
}

export default NavigationBar;
