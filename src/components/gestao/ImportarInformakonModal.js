import React, { useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { FaFileImport } from 'react-icons/fa';
import ItemSelect from './ItemSelect';
import { formatCurrency } from '../../utils/formatters';
import { formatDataISO } from '../../utils/gestao';
import {
  CAMPOS_INFORMAKON,
  agruparEmCompras,
  chaveMapaInsumo,
  lerArquivoPlanilha,
  mapearColunas,
  normalizarLinhas,
  sugerirItem
} from '../../utils/informakon';

/**
 * Importa compras de um relatório exportado do Informakon.
 * Etapas: 1) arquivo  2) colunas  3) vínculo de cada linha a um item.
 */
function ImportarInformakonModal({ show, onHide, onImport, itens, mapaVinculos, refsExistentes }) {
  const [etapa, setEtapa] = useState(1);
  const [arquivo, setArquivo] = useState(null);
  const [planilha, setPlanilha] = useState(null);
  const [mapa, setMapa] = useState({});
  const [linhas, setLinhas] = useState([]);
  const [erro, setErro] = useState('');
  const [importando, setImportando] = useState(false);
  const [filtro, setFiltro] = useState('todas');

  const reset = () => {
    setEtapa(1);
    setArquivo(null);
    setPlanilha(null);
    setMapa({});
    setLinhas([]);
    setErro('');
    setFiltro('todas');
  };

  const fechar = () => {
    reset();
    onHide();
  };

  async function lerArquivo() {
    if (!arquivo) return setErro('Selecione o arquivo exportado do Informakon.');
    setErro('');
    try {
      const p = await lerArquivoPlanilha(arquivo);
      if (!p.linhas.length) return setErro('Nenhuma linha encontrada no arquivo.');
      setPlanilha(p);
      setMapa(mapearColunas(p.cabecalho));
      setEtapa(2);
    } catch (err) {
      console.error(err);
      setErro('Não foi possível ler o arquivo: ' + err.message);
    }
  }

  function confirmarColunas() {
    const faltando = CAMPOS_INFORMAKON.filter((c) => c.obrigatorio && (mapa[c.key] === undefined || mapa[c.key] === ''));
    if (faltando.length) return setErro(`Informe a coluna de: ${faltando.map((c) => c.label).join(', ')}.`);
    setErro('');
    const normal = normalizarLinhas(planilha.linhas, mapa).map((l) => {
      const jaImportada = refsExistentes.has(l.informakonRef);
      const sug = jaImportada ? { itemId: '', motivo: '' } : sugerirItem(l, itens, mapaVinculos);
      return { ...l, jaImportada, itemId: sug.itemId, motivo: sug.motivo, incluir: !jaImportada };
    });
    if (!normal.length) return setErro('Nenhuma linha com descrição e valor foi encontrada com esse mapeamento.');
    setLinhas(normal);
    setEtapa(3);
  }

  const setLinha = (idx, patch) => setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  /** Aplica o mesmo item a todas as linhas do mesmo insumo ainda sem vínculo. */
  const vincularSemelhantes = (idx, itemId) => {
    const chave = chaveMapaInsumo(linhas[idx]);
    setLinhas((prev) =>
      prev.map((l, i) => {
        if (i === idx) return { ...l, itemId, motivo: 'manual' };
        if (!l.jaImportada && !l.itemId && chaveMapaInsumo(l) === chave) return { ...l, itemId, motivo: 'mesmo insumo' };
        return l;
      })
    );
  };

  const selecionadas = linhas.filter((l) => l.incluir && !l.jaImportada);
  const semVinculo = selecionadas.filter((l) => !l.itemId);
  const jaImportadas = linhas.filter((l) => l.jaImportada).length;

  const linhasVisiveis = useMemo(
    () =>
      linhas
        .map((l, idx) => ({ l, idx }))
        .filter(({ l }) => {
          if (filtro === 'semVinculo') return !l.jaImportada && l.incluir && !l.itemId;
          if (filtro === 'novas') return !l.jaImportada;
          return true;
        }),
    [linhas, filtro]
  );

  async function importar() {
    if (!selecionadas.length) return setErro('Nenhuma linha selecionada para importar.');
    if (semVinculo.length) {
      return setErro(`${semVinculo.length} linha(s) sem item vinculado. Toda compra precisa estar vinculada a um item — vincule ou desmarque essas linhas.`);
    }
    setImportando(true);
    setErro('');
    try {
      const novoMapa = { ...mapaVinculos };
      selecionadas.forEach((l) => {
        const k = chaveMapaInsumo(l);
        if (k) novoMapa[k] = l.itemId;
      });
      await onImport(agruparEmCompras(selecionadas), novoMapa);
      fechar();
    } catch (err) {
      console.error(err);
      setErro('Erro ao importar: ' + err.message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <Modal show={show} onHide={fechar} size="xl" backdrop="static" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaFileImport className="me-2" />
          Importar compras do Informakon
          <span className="text-muted fs-6 ms-2">etapa {etapa} de 3</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && <Alert variant="danger">{erro}</Alert>}

        {etapa === 1 && (
          <>
            <p>
              No Informakon, exporte para Excel (ou CSV) o relatório de <strong>pedidos de compra</strong>,{' '}
              <strong>notas fiscais de entrada</strong> ou <strong>apropriação de custos</strong> da obra.
              O arquivo deve ter ao menos a descrição e o valor de cada linha; documento, fornecedor, data,
              quantidade e apropriação/etapa ajudam no vínculo automático.
            </p>
            <Form.Control type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
            <Form.Text>Linhas já importadas anteriormente são identificadas e ignoradas automaticamente.</Form.Text>
          </>
        )}

        {etapa === 2 && planilha && (
          <>
            <p className="mb-3">
              Confira a coluna do arquivo correspondente a cada campo ({planilha.linhas.length} linhas encontradas).
            </p>
            <Row className="g-3">
              {CAMPOS_INFORMAKON.map((c) => (
                <Col md={4} key={c.key}>
                  <Form.Label className="small mb-1">
                    {c.label}{c.obrigatorio && ' *'}
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={mapa[c.key] ?? ''}
                    onChange={(e) => setMapa({ ...mapa, [c.key]: e.target.value === '' ? undefined : Number(e.target.value) })}
                  >
                    <option value="">— não usar —</option>
                    {planilha.cabecalho.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </Form.Select>
                </Col>
              ))}
            </Row>
            <h6 className="mt-4">Prévia</h6>
            <Table size="sm" bordered responsive className="small">
              <thead>
                <tr>{planilha.cabecalho.map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {planilha.linhas.slice(0, 5).map((l, i) => (
                  <tr key={i}>
                    {planilha.cabecalho.map((_, j) => (
                      <td key={j}>{l[j] instanceof Date ? l[j].toLocaleDateString('pt-BR') : String(l[j] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}

        {etapa === 3 && (
          <>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
              <Badge bg="primary">{selecionadas.length} a importar</Badge>
              <Badge bg={semVinculo.length ? 'danger' : 'success'}>{semVinculo.length} sem vínculo</Badge>
              {jaImportadas > 0 && <Badge bg="secondary">{jaImportadas} já importadas</Badge>}
              <span className="ms-auto small">Total: <strong>{formatCurrency(selecionadas.reduce((s, l) => s + l.valorTotal, 0))}</strong></span>
              <Form.Select size="sm" style={{ width: 200 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="todas">Todas as linhas</option>
                <option value="novas">Somente novas</option>
                <option value="semVinculo">Somente sem vínculo</option>
              </Form.Select>
            </div>
            <Table size="sm" responsive className="align-middle small">
              <thead>
                <tr>
                  <th />
                  <th>Doc. / Fornecedor</th>
                  <th>Data</th>
                  <th>Descrição (Informakon)</th>
                  <th className="text-end">Valor</th>
                  <th style={{ minWidth: 300 }}>Item do orçamento</th>
                </tr>
              </thead>
              <tbody>
                {linhasVisiveis.map(({ l, idx }) => (
                  <tr key={idx} className={l.jaImportada ? 'text-muted' : ''}>
                    <td>
                      <Form.Check
                        checked={l.incluir && !l.jaImportada}
                        disabled={l.jaImportada}
                        onChange={(e) => setLinha(idx, { incluir: e.target.checked })}
                      />
                    </td>
                    <td>
                      <div>{l.documento || '—'}</div>
                      <div className="text-muted">{l.fornecedor}</div>
                    </td>
                    <td>{formatDataISO(l.data)}</td>
                    <td>
                      <div>{l.codigoInsumo && <span className="text-muted">{l.codigoInsumo} · </span>}{l.descricao}</div>
                      {l.apropriacao && <div className="text-muted">Apropriação: {l.apropriacao}</div>}
                      {l.quantidade > 0 && <div className="text-muted">{l.quantidade} {l.unidade}</div>}
                    </td>
                    <td className="text-end">{formatCurrency(l.valorTotal)}</td>
                    <td>
                      {l.jaImportada ? (
                        <Badge bg="secondary">Já importada</Badge>
                      ) : (
                        <>
                          <ItemSelect
                            size="sm"
                            itens={itens}
                            value={l.itemId}
                            isInvalid={l.incluir && !l.itemId}
                            onChange={(v) => vincularSemelhantes(idx, v)}
                          />
                          {l.motivo && <div className="text-muted mt-1">Sugestão: {l.motivo}</div>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {etapa > 1 && (
          <Button variant="outline-secondary" className="me-auto" onClick={() => { setErro(''); setEtapa(etapa - 1); }}>
            Voltar
          </Button>
        )}
        <Button variant="secondary" onClick={fechar}>Cancelar</Button>
        {etapa === 1 && <Button onClick={lerArquivo}>Ler arquivo</Button>}
        {etapa === 2 && <Button onClick={confirmarColunas}>Continuar</Button>}
        {etapa === 3 && (
          <Button onClick={importar} disabled={importando}>
            {importando ? 'Importando...' : `Importar ${selecionadas.length} linha(s)`}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default ImportarInformakonModal;
