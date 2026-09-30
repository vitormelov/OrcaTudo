import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import ItemSelect from './ItemSelect';
import { formatCurrency } from '../../utils/formatters';
import { parseNumeroBR } from '../../utils/gestao';

/**
 * Ajuste de verba:
 *  - remanejamento: transfere verba de um item (ex.: com economia) para outro;
 *  - aditivo: acrescenta (valor positivo) ou suprime (negativo) verba de um item.
 */
function AjusteModal({ show, onHide, onSave, itens, itemInicialId }) {
  const [tipo, setTipo] = useState('remanejamento');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!show) return;
    setTipo('remanejamento');
    setOrigem('');
    setDestino(itemInicialId || '');
    setValor('');
    setMotivo('');
    setErro('');
  }, [show, itemInicialId]);

  const itemOrigem = itens.find((it) => it.id === origem);

  async function handleSubmit(e) {
    e.preventDefault();
    const v = parseNumeroBR(valor);
    if (!destino) return setErro('Selecione o item que recebe o ajuste.');
    if (!v) return setErro('Informe o valor.');
    if (tipo === 'remanejamento') {
      if (!origem) return setErro('Selecione o item de origem da verba.');
      if (v < 0) return setErro('No remanejamento o valor deve ser positivo.');
    }
    if (!motivo.trim()) return setErro('Informe o motivo do ajuste.');
    setSalvando(true);
    try {
      await onSave({ tipo, itemOrigemId: origem, itemDestinoId: destino, valor: v, motivo: motivo.trim() });
      onHide();
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Ajuste de verba</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <Alert variant="danger">{erro}</Alert>}
          <Form.Group className="mb-3">
            <Form.Check
              inline
              type="radio"
              id="aj-rem"
              label="Remanejamento entre itens"
              checked={tipo === 'remanejamento'}
              onChange={() => setTipo('remanejamento')}
            />
            <Form.Check
              inline
              type="radio"
              id="aj-adi"
              label="Aditivo / supressão"
              checked={tipo === 'aditivo'}
              onChange={() => setTipo('aditivo')}
            />
          </Form.Group>

          {tipo === 'remanejamento' && (
            <Form.Group className="mb-3">
              <Form.Label>Retirar verba de</Form.Label>
              <ItemSelect itens={itens} value={origem} onChange={setOrigem} excluirId={destino} />
              {itemOrigem && (
                <Form.Text>Saldo disponível no item: {formatCurrency(itemOrigem.saldo)}</Form.Text>
              )}
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>{tipo === 'remanejamento' ? 'Transferir para' : 'Item'}</Form.Label>
            <ItemSelect itens={itens} value={destino} onChange={setDestino} excluirId={tipo === 'remanejamento' ? origem : undefined} />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Valor (R$)</Form.Label>
            <Form.Control inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            {tipo === 'aditivo' && <Form.Text>Use valor negativo para supressão de verba.</Form.Text>}
          </Form.Group>

          <Form.Group>
            <Form.Label>Motivo</Form.Label>
            <Form.Control as="textarea" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancelar</Button>
          <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar ajuste'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default AjusteModal;
