import React, { useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { FaPlus, FaTrash } from 'react-icons/fa';
import ItemSelect from './ItemSelect';
import { formatCurrency } from '../../utils/formatters';
import { parseNumeroBR, round2 } from '../../utils/gestao';

const linhaVazia = (itemId = '') => ({
  itemId,
  descricao: '',
  unidade: '',
  quantidade: '',
  valorUnitario: '',
  valorTotal: ''
});

const hoje = () => new Date().toISOString().slice(0, 10);

function CompraModal({ show, onHide, onSave, itens, compra, itemInicialId }) {
  const [form, setForm] = useState({ documento: '', fornecedor: '', data: hoje(), observacao: '' });
  const [linhas, setLinhas] = useState([linhaVazia()]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!show) return;
    setErro('');
    if (compra) {
      setForm({
        documento: compra.documento || '',
        fornecedor: compra.fornecedor || '',
        data: compra.data || hoje(),
        observacao: compra.observacao || ''
      });
      setLinhas(
        (compra.linhas || []).map((l) => ({
          ...l,
          quantidade: l.quantidade ? String(l.quantidade).replace('.', ',') : '',
          valorUnitario: l.valorUnitario ? String(round2(l.valorUnitario)).replace('.', ',') : '',
          valorTotal: String(round2(l.valorTotal)).replace('.', ',')
        }))
      );
    } else {
      setForm({ documento: '', fornecedor: '', data: hoje(), observacao: '' });
      setLinhas([linhaVazia(itemInicialId || '')]);
    }
  }, [show, compra, itemInicialId]);

  const setLinha = (idx, patch) => {
    setLinhas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const nova = { ...l, ...patch };
        // recalcula o total quando qtd ou unitário mudam
        if ('quantidade' in patch || 'valorUnitario' in patch) {
          const q = parseNumeroBR(nova.quantidade);
          const u = parseNumeroBR(nova.valorUnitario);
          if (q && u) nova.valorTotal = String(round2(q * u)).replace('.', ',');
        }
        if (!nova.descricao && patch.itemId) {
          const it = itens.find((x) => x.id === patch.itemId);
          if (it) nova.unidade = nova.unidade || it.unidade;
        }
        return nova;
      })
    );
  };

  const total = linhas.reduce((s, l) => s + parseNumeroBR(l.valorTotal), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    const validas = linhas.filter((l) => l.itemId || parseNumeroBR(l.valorTotal));
    if (!validas.length) {
      setErro('Informe ao menos uma linha de compra.');
      return;
    }
    if (validas.some((l) => !l.itemId)) {
      setErro('Toda linha de compra precisa estar vinculada a um item do orçamento.');
      return;
    }
    if (validas.some((l) => !parseNumeroBR(l.valorTotal))) {
      setErro('Informe o valor de todas as linhas.');
      return;
    }
    setSalvando(true);
    try {
      await onSave({
        ...(compra || {}),
        ...form,
        linhas: validas.map((l) => ({
          ...l,
          descricao: l.descricao || itens.find((it) => it.id === l.itemId)?.descricao || '',
          quantidade: parseNumeroBR(l.quantidade),
          valorUnitario: parseNumeroBR(l.valorUnitario),
          valorTotal: parseNumeroBR(l.valorTotal)
        }))
      });
      onHide();
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="xl" backdrop="static">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{compra ? 'Editar compra' : 'Nova compra'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <Alert variant="danger">{erro}</Alert>}
          {compra?.origem === 'informakon' && (
            <Alert variant="info" className="py-2 small">Compra importada do Informakon.</Alert>
          )}
          <Row className="g-3 mb-3">
            <Col md={3}>
              <Form.Label>Documento (NF / pedido)</Form.Label>
              <Form.Control value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </Col>
            <Col md={5}>
              <Form.Label>Fornecedor</Form.Label>
              <Form.Control value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Label>Data</Form.Label>
              <Form.Control type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </Col>
          </Row>

          <Table size="sm" responsive className="align-middle">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Item do orçamento *</th>
                <th style={{ minWidth: 180 }}>Descrição da compra</th>
                <th style={{ width: 70 }}>Un.</th>
                <th style={{ width: 100 }}>Qtd.</th>
                <th style={{ width: 120 }}>Vl. unit.</th>
                <th style={{ width: 130 }}>Vl. total *</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, idx) => (
                <tr key={idx}>
                  <td>
                    <ItemSelect size="sm" itens={itens} value={l.itemId} onChange={(v) => setLinha(idx, { itemId: v })} />
                  </td>
                  <td>
                    <Form.Control size="sm" value={l.descricao} onChange={(e) => setLinha(idx, { descricao: e.target.value })} />
                  </td>
                  <td>
                    <Form.Control size="sm" value={l.unidade} onChange={(e) => setLinha(idx, { unidade: e.target.value })} />
                  </td>
                  <td>
                    <Form.Control size="sm" inputMode="decimal" value={l.quantidade} onChange={(e) => setLinha(idx, { quantidade: e.target.value })} />
                  </td>
                  <td>
                    <Form.Control size="sm" inputMode="decimal" value={l.valorUnitario} onChange={(e) => setLinha(idx, { valorUnitario: e.target.value })} />
                  </td>
                  <td>
                    <Form.Control size="sm" inputMode="decimal" value={l.valorTotal} onChange={(e) => setLinha(idx, { valorTotal: e.target.value })} />
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      disabled={linhas.length === 1}
                      onClick={() => setLinhas((prev) => prev.filter((_, i) => i !== idx))}
                      title="Remover linha"
                    >
                      <FaTrash />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>
                  <Button size="sm" variant="outline-primary" onClick={() => setLinhas((prev) => [...prev, linhaVazia()])}>
                    <FaPlus className="me-1" />
                    Adicionar linha
                  </Button>
                </td>
                <td className="fw-semibold">{formatCurrency(total)}</td>
                <td />
              </tr>
            </tfoot>
          </Table>

          <Form.Group>
            <Form.Label>Observação</Form.Label>
            <Form.Control as="textarea" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancelar</Button>
          <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar compra'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default CompraModal;
