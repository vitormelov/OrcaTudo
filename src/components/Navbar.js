import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Button, Dropdown } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { FaCalculator, FaBoxes, FaLayerGroup, FaFileInvoiceDollar, FaUser, FaSignOutAlt } from 'react-icons/fa';

function NavigationBar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function handleLogout() {
    try {
      setError('');
      await logout();
      navigate('/login');
    } catch {
      setError('Falha ao sair da conta');
    }
  }

  if (!currentUser) {
    return null;
  }

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-3">
      <Container>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
          <FaCalculator className="me-2" />
          Orçamento de Obra
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
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
          </Nav>
          
          <Nav>
            <Dropdown>
              <Dropdown.Toggle variant="outline-light" id="dropdown-basic">
                <FaUser className="me-1" />
                {currentUser.displayName || currentUser.email}
              </Dropdown.Toggle>

              <Dropdown.Menu>
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
