import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner, Table } from 'react-bootstrap';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { FaHistory, FaSync } from 'react-icons/fa';
import { db } from '../firebase/config';
import { ACOES_LOG, dataCorteLogs, LOG_RETENCAO_DIAS, purgarLogsAntigos, rotuloRota } from '../utils/activityLog';

function formatarDataHora(valor) {
  if (!valor) return '—';
  let date = null;
  if (typeof valor.toDate === 'function') date = valor.toDate();
  else if (valor.seconds) date = new Date(valor.seconds * 1000);
  else date = new Date(valor);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function corAcao(acao) {
  return ({
    login: 'success',
    logout: 'secondary',
    sessao: 'info',
    pagina: 'primary',
    empresa: 'warning',
    trial: 'dark'
  })[acao] || 'secondary';
}

function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await purgarLogsAntigos();
      const snap = await getDocs(
        query(
          collection(db, 'logsAcesso'),
          where('createdAt', '>=', dataCorteLogs()),
          orderBy('createdAt', 'desc'),
          limit(300)
        )
      );
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      setError('Não foi possível carregar o log. Publique as regras e os índices do Firestore.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = filtroTexto.trim().toLowerCase();
    return logs.filter((log) => {
      if (filtroAcao && log.acao !== filtroAcao) return false;
      if (!termo) return true;
      const blob = [
        log.displayName,
        log.email,
        log.detalhe,
        log.empresaNome,
        log.rota,
        ACOES_LOG[log.acao]
      ].join(' ').toLowerCase();
      return blob.includes(termo);
    });
  }, [logs, filtroTexto, filtroAcao]);

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span>
          <FaHistory className="me-2" />
          Log de acessos
        </span>
        <Button size="sm" variant="outline-secondary" onClick={carregar} disabled={loading}>
          <FaSync className="me-1" />
          Atualizar
        </Button>
      </Card.Header>
      <Card.Body>
        <p className="text-muted small mb-3">
          Acessos e navegação das contas nos últimos {LOG_RETENCAO_DIAS} dias
          (a conta administrativa não entra neste log). Registros mais antigos são apagados.
        </p>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control
            style={{ maxWidth: 320 }}
            placeholder="Buscar por nome, e-mail ou empresa"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
          <Form.Select
            style={{ maxWidth: 220 }}
            value={filtroAcao}
            onChange={(e) => setFiltroAcao(e.target.value)}
          >
            <option value="">Todas as ações</option>
            {Object.entries(ACOES_LOG).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </Form.Select>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Carregando log...
          </div>
        ) : filtrados.length === 0 ? (
          <p className="text-muted mb-0">Nenhum acesso registrado ainda.</p>
        ) : (
          <Table responsive hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Detalhe</th>
                <th>Empresa</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((log) => (
                <tr key={log.id}>
                  <td className="text-nowrap">{formatarDataHora(log.createdAt)}</td>
                  <td>
                    <div>{log.displayName || '—'}</div>
                    <div className="text-muted small">{log.email}</div>
                  </td>
                  <td>
                    <Badge bg={corAcao(log.acao)}>
                      {ACOES_LOG[log.acao] || log.acao}
                    </Badge>
                  </td>
                  <td>{log.detalhe || rotuloRota(log.rota) || '—'}</td>
                  <td>{log.empresaNome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );
}

export default AdminLogs;
