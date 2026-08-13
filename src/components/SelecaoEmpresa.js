import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Button, Alert, Row, Col, Badge } from 'react-bootstrap';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { FaBuilding, FaArrowRight } from 'react-icons/fa';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';

function SelecaoEmpresa() {
  const { isAdmin } = useAuth();
  const { memberships, selecionarEmpresa } = useEmpresa();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listaEmpresas, setListaEmpresas] = useState([]);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      if (isAdmin) {
        const snap = await getDocs(collection(db, 'empresas'));
        const lista = snap.docs
          .map((d) => ({
            id: d.id,
            nome: d.data().nome,
            bloqueada: Boolean(d.data().bloqueada),
            colaborador: memberships.find((m) => m.id === d.id)?.colaborador ?? true
          }));
        if (!cancelado) setListaEmpresas(lista);
        return;
      }

      const lista = [];
      for (const m of memberships) {
        const snap = await getDoc(doc(db, 'empresas', m.id));
        if (snap.exists() && !snap.data().bloqueada) {
          lista.push({
            ...m,
            nome: snap.data().nome || m.nome
          });
        }
      }
      if (!cancelado) setListaEmpresas(lista);
    };

    carregar().catch((e) => {
      console.error(e);
      if (!cancelado) setError('Não foi possível carregar as empresas.');
    });

    return () => { cancelado = true; };
  }, [isAdmin, memberships]);

  const entrar = async (empresaId, nome) => {
    setLoading(true);
    setError('');
    try {
      await selecionarEmpresa(empresaId, nome);
      navigate('/');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Não foi possível entrar na empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1><FaBuilding className="me-2" />Selecionar empresa</h1>
        <p className="text-muted mb-0">
          Escolha a empresa para ver insumos, composições, orçamentos e relatórios compartilhados.
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {listaEmpresas.length === 0 ? (
        <Alert variant="info">
          Nenhuma empresa disponível.
          {isAdmin
            ? <> Crie uma empresa em <Alert.Link as={Link} to="/admin">Administração</Alert.Link>.</>
            : ' Peça ao administrador para vincular você a uma empresa.'}
        </Alert>
      ) : (
        <Row className="g-3 mb-4">
          {listaEmpresas.map((emp) => (
            <Col md={6} lg={4} key={emp.id}>
              <Card className="h-100">
                <Card.Body className="d-flex flex-column">
                  <h5 className="mb-1">
                    {emp.nome}
                    {emp.bloqueada && (
                      <Badge bg="danger" className="ms-2">Bloqueada</Badge>
                    )}
                  </h5>
                  <p className="text-muted small mb-3">
                    {emp.bloqueada
                      ? 'Bloqueada para usuários cadastrados. Você pode entrar como administrador.'
                      : (isAdmin || emp.colaborador ? 'Colaborador — pode editar' : 'Somente visualização')}
                  </p>
                  <Button
                    variant="primary"
                    className="mt-auto"
                    disabled={loading}
                    onClick={() => entrar(emp.id, emp.nome)}
                  >
                    Entrar <FaArrowRight className="ms-2" />
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}

export default SelecaoEmpresa;
