import React, { useState, useEffect } from 'react';
import { Card, Table, Badge, Alert, Spinner, Button, Form } from 'react-bootstrap';
import {
  FaChartBar,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCheckCircle,
  FaArrowLeft,
  FaFilePdf,
  FaBoxes,
  FaLayerGroup
} from 'react-icons/fa';
import { formatCurrency } from '../utils/formatters';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { useParams, useNavigate } from 'react-router-dom';

function classificarABC(itens) {
  const ordenados = (itens || [])
    .filter((item) => (item.valorTotal || 0) > 0)
    .sort((a, b) => b.valorTotal - a.valorTotal);

  const valorTotalGeral = ordenados.reduce((sum, item) => sum + item.valorTotal, 0);
  let valorAcumulado = 0;

  const curva = ordenados.map((item) => {
    valorAcumulado += item.valorTotal;
    const percentualAcumulado = valorTotalGeral > 0 ? (valorAcumulado / valorTotalGeral) * 100 : 0;
    let categoriaABC = 'C';
    if (percentualAcumulado <= 80) categoriaABC = 'A';
    else if (percentualAcumulado <= 95) categoriaABC = 'B';

    return {
      ...item,
      categoriaABC,
      percentualAcumulado: percentualAcumulado.toFixed(2),
      percentualValor: valorTotalGeral > 0
        ? ((item.valorTotal / valorTotalGeral) * 100).toFixed(2)
        : '0.00'
    };
  });

  const resumo = {
    totalItens: curva.length,
    valorTotal: valorTotalGeral,
    categoriaA: { quantidade: 0, valor: 0, percentual: '0.00' },
    categoriaB: { quantidade: 0, valor: 0, percentual: '0.00' },
    categoriaC: { quantidade: 0, valor: 0, percentual: '0.00' }
  };

  curva.forEach((item) => {
    const bucket =
      item.categoriaABC === 'A'
        ? resumo.categoriaA
        : item.categoriaABC === 'B'
          ? resumo.categoriaB
          : resumo.categoriaC;
    bucket.quantidade += 1;
    bucket.valor += item.valorTotal;
  });

  if (valorTotalGeral > 0) {
    resumo.categoriaA.percentual = ((resumo.categoriaA.valor / valorTotalGeral) * 100).toFixed(2);
    resumo.categoriaB.percentual = ((resumo.categoriaB.valor / valorTotalGeral) * 100).toFixed(2);
    resumo.categoriaC.percentual = ((resumo.categoriaC.valor / valorTotalGeral) * 100).toFixed(2);
  }

  return { curva, resumo };
}

const CurvaABC = () => {
  const { currentUser } = useAuth();
  const { id: orcamentoId } = useParams();
  const navigate = useNavigate();
  const [orcamentoNome, setOrcamentoNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modo, setModo] = useState('insumos'); // 'insumos' | 'composicoes'
  const [curvaInsumos, setCurvaInsumos] = useState([]);
  const [curvaComposicoes, setCurvaComposicoes] = useState([]);
  const [resumoInsumos, setResumoInsumos] = useState(null);
  const [resumoComposicoes, setResumoComposicoes] = useState(null);

  useEffect(() => {
    if (orcamentoId && currentUser) {
      calcularCurvasABC();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoId, currentUser]);

  const calcularCurvasABC = async () => {
    try {
      setLoading(true);
      setError(null);

      const orcamentoSnapshot = await getDoc(doc(db, 'orcamentos', orcamentoId));
      if (!orcamentoSnapshot.exists()) {
        throw new Error('Orçamento não encontrado');
      }

      const orcamentoData = orcamentoSnapshot.data();
      setOrcamentoNome(orcamentoData.nome || '');

      if (orcamentoData.userId !== currentUser.uid) {
        throw new Error('Acesso negado a este orçamento');
      }

      if (!orcamentoData.pacotes || orcamentoData.pacotes.length === 0) {
        setError('Este orçamento não possui estrutura EAP configurada. Adicione pacotes e composições na página EAP primeiro.');
        setLoading(false);
        return;
      }

      const [composicoesSnap, insumosSnap] = await Promise.all([
        getDocs(query(collection(db, 'composicoes'), where('userId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'insumos'), where('userId', '==', currentUser.uid)))
      ]);

      const catalogoComposicoes = composicoesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const insumos = insumosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const compsOrcamento = orcamentoData.composicoes || [];

      // ——— Curva ABC de insumos ———
      const consumoInsumos = {};
      compsOrcamento.forEach((compOrcamento) => {
        const qtdComp = parseFloat(compOrcamento.quantidade) || 0;
        const catalogo = catalogoComposicoes.find((c) => c.id === compOrcamento.composicaoId);
        const listaInsumos =
          (compOrcamento.insumos && compOrcamento.insumos.length > 0)
            ? compOrcamento.insumos
            : (catalogo?.insumos || []);

        listaInsumos.forEach((item) => {
          const insumoId = item.insumoId;
          if (!insumoId) return;
          const quantidadeTotal = (parseFloat(item.quantidade) || 0) * qtdComp;
          if (!consumoInsumos[insumoId]) {
            consumoInsumos[insumoId] = {
              id: insumoId,
              quantidade: 0,
              valorTotal: 0
            };
          }
          consumoInsumos[insumoId].quantidade += quantidadeTotal;
        });
      });

      Object.keys(consumoInsumos).forEach((insumoId) => {
        const insumo = insumos.find((i) => i.id === insumoId);
        if (!insumo) return;
        const preco = insumo.precoUnitario || 0;
        consumoInsumos[insumoId].valorTotal = consumoInsumos[insumoId].quantidade * preco;
        consumoInsumos[insumoId].nome = insumo.nome;
        consumoInsumos[insumoId].unidade = insumo.unidade;
        consumoInsumos[insumoId].categoria = insumo.categoria;
        consumoInsumos[insumoId].precoUnitario = preco;
      });

      const abcInsumos = classificarABC(Object.values(consumoInsumos));
      setCurvaInsumos(abcInsumos.curva);
      setResumoInsumos(abcInsumos.resumo);

      // ——— Curva ABC de composições ———
      const consumoComps = {};
      compsOrcamento.forEach((comp) => {
        const key = comp.composicaoId || comp.nome || comp.uid || comp.id;
        if (!key) return;
        const qtd = parseFloat(comp.quantidade) || 0;
        const total = parseFloat(comp.custoTotal) || 0;
        if (!consumoComps[key]) {
          consumoComps[key] = {
            id: key,
            nome: comp.nome || 'Composição',
            unidade: comp.unidade || '',
            categoria: 'Composição',
            quantidade: 0,
            valorTotal: 0,
            precoUnitario: parseFloat(comp.custoUnitario) || 0
          };
        }
        consumoComps[key].quantidade += qtd;
        consumoComps[key].valorTotal += total;
        if (consumoComps[key].quantidade > 0) {
          consumoComps[key].precoUnitario =
            consumoComps[key].valorTotal / consumoComps[key].quantidade;
        }
      });

      const abcComps = classificarABC(Object.values(consumoComps));
      setCurvaComposicoes(abcComps.curva);
      setResumoComposicoes(abcComps.resumo);
    } catch (err) {
      console.error('Erro ao calcular Curva ABC:', err);
      setError('Erro ao calcular a Curva ABC: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isInsumos = modo === 'insumos';
  const curvaABC = isInsumos ? curvaInsumos : curvaComposicoes;
  const resumo = isInsumos ? resumoInsumos : resumoComposicoes;
  const rotuloItem = isInsumos ? 'insumos' : 'composições';
  const rotuloItemSingular = isInsumos ? 'Insumo' : 'Composição';

  const getCategoriaColor = (categoria) => {
    switch (categoria) {
      case 'A': return 'danger';
      case 'B': return 'warning';
      case 'C': return 'success';
      default: return 'secondary';
    }
  };

  const getCategoriaIcon = (categoria) => {
    switch (categoria) {
      case 'A': return <FaExclamationTriangle className="text-danger" />;
      case 'B': return <FaInfoCircle className="text-warning" />;
      case 'C': return <FaCheckCircle className="text-success" />;
      default: return null;
    }
  };

  const exportarPDF = () => {
    if (!resumo) return;
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const docPdf = new jsPDF();
        const tituloModo = isInsumos ? 'Insumos' : 'Composições';

        docPdf.setFontSize(18);
        docPdf.text(`Curva ABC (${tituloModo}) - ${orcamentoNome}`, 14, 22);
        docPdf.setFontSize(11);
        docPdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 32);

        docPdf.setFontSize(13);
        docPdf.text('Resumo por Categoria:', 14, 45);
        docPdf.setFontSize(10);
        docPdf.text(`Categoria A: ${resumo.categoriaA.quantidade} ${rotuloItem} - ${formatCurrency(resumo.categoriaA.valor)} (${resumo.categoriaA.percentual}%)`, 14, 55);
        docPdf.text(`Categoria B: ${resumo.categoriaB.quantidade} ${rotuloItem} - ${formatCurrency(resumo.categoriaB.valor)} (${resumo.categoriaB.percentual}%)`, 14, 62);
        docPdf.text(`Categoria C: ${resumo.categoriaC.quantidade} ${rotuloItem} - ${formatCurrency(resumo.categoriaC.valor)} (${resumo.categoriaC.percentual}%)`, 14, 69);
        docPdf.text(`Total: ${resumo.totalItens} ${rotuloItem} - ${formatCurrency(resumo.valorTotal)}`, 14, 76);

        const tableData = curvaABC.map((item, index) => [
          index + 1,
          item.nome,
          isInsumos ? (item.categoria || '—') : (item.unidade || '—'),
          (item.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 }),
          formatCurrency(item.precoUnitario || 0),
          formatCurrency(item.valorTotal),
          `${item.percentualValor}%`,
          `${item.percentualAcumulado}%`,
          item.categoriaABC
        ]);

        autoTable(docPdf, {
          head: [[
            '#',
            rotuloItemSingular,
            isInsumos ? 'Categoria' : 'Unidade',
            'Quantidade',
            'Preço Unit.',
            'Valor Total',
            '% Total',
            '% Acumulado',
            'ABC'
          ]],
          body: tableData,
          startY: 85,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [23, 50, 77], textColor: 255 }
        });

        docPdf.save(
          `CurvaABC_${tituloModo}_${(orcamentoNome || 'orcamento').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
        );
      });
    });
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
        <p className="mt-2">Calculando Curva ABC...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <FaExclamationTriangle className="me-2" />
        {error}
        <div className="mt-3">
          <Button variant="outline-secondary" onClick={() => navigate(`/orcamentos/${orcamentoId}/eap`)}>
            <FaArrowLeft className="me-2" />
            Voltar para EAP
          </Button>
        </div>
      </Alert>
    );
  }

  if (!resumo) {
    return null;
  }

  return (
    <div>
      <Card className="mb-4">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h4 className="mb-0">
              <FaChartBar className="me-2" />
              Curva ABC — {orcamentoNome}
            </h4>
            <div className="d-flex gap-2 flex-wrap">
              <Button
                variant="outline-danger"
                onClick={exportarPDF}
                disabled={curvaABC.length === 0}
                title="Exportar para PDF"
              >
                <FaFilePdf className="me-2" />
                Exportar PDF
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => navigate(`/orcamentos/${orcamentoId}/eap`)}
              >
                <FaArrowLeft className="me-2" />
                Voltar para EAP
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {/* Toggle Insumos / Composições */}
          <div className="d-flex justify-content-center mb-4">
            <div
              className="abc-toggle d-flex align-items-center gap-3 px-3 py-2 border rounded"
              style={{ background: 'var(--color-surface, #fff)' }}
            >
              <span
                className={`d-flex align-items-center gap-1 ${isInsumos ? 'fw-semibold text-primary' : 'text-muted'}`}
                style={{ fontSize: 14, cursor: 'pointer' }}
                onClick={() => setModo('insumos')}
              >
                <FaBoxes />
                Insumos
              </span>
              <Form.Check
                type="switch"
                id="abc-modo-switch"
                checked={!isInsumos}
                onChange={(e) => setModo(e.target.checked ? 'composicoes' : 'insumos')}
                aria-label="Alternar entre insumos e composições"
                className="mb-0"
              />
              <span
                className={`d-flex align-items-center gap-1 ${!isInsumos ? 'fw-semibold text-primary' : 'text-muted'}`}
                style={{ fontSize: 14, cursor: 'pointer' }}
                onClick={() => setModo('composicoes')}
              >
                <FaLayerGroup />
                Composições
              </span>
            </div>
          </div>

          <p className="text-center text-muted small mb-4">
            Analisando Curva ABC de <strong>{isInsumos ? 'insumos' : 'composições'}</strong> deste orçamento
          </p>

          <div className="row mb-4">
            <div className="col-md-3">
              <div className="text-center p-3 border rounded">
                <h5 className="text-danger">Categoria A</h5>
                <h6>{resumo.categoriaA.quantidade} {rotuloItem}</h6>
                <strong>{formatCurrency(resumo.categoriaA.valor)}</strong>
                <div className="text-muted">{resumo.categoriaA.percentual}% do total</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 border rounded">
                <h5 className="text-warning">Categoria B</h5>
                <h6>{resumo.categoriaB.quantidade} {rotuloItem}</h6>
                <strong>{formatCurrency(resumo.categoriaB.valor)}</strong>
                <div className="text-muted">{resumo.categoriaB.percentual}% do total</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 border rounded">
                <h5 className="text-success">Categoria C</h5>
                <h6>{resumo.categoriaC.quantidade} {rotuloItem}</h6>
                <strong>{formatCurrency(resumo.categoriaC.valor)}</strong>
                <div className="text-muted">{resumo.categoriaC.percentual}% do total</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 border rounded">
                <h5 className="text-primary">Total</h5>
                <h6>{resumo.totalItens} {rotuloItem}</h6>
                <strong>{formatCurrency(resumo.valorTotal)}</strong>
                <div className="text-muted">100%</div>
              </div>
            </div>
          </div>

          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>{rotuloItemSingular}</th>
                <th>{isInsumos ? 'Categoria' : 'Unidade'}</th>
                <th>Quantidade</th>
                <th>Preço Unit.</th>
                <th>Valor Total</th>
                <th>% do Total</th>
                <th>% Acumulado</th>
                <th>ABC</th>
              </tr>
            </thead>
            <tbody>
              {curvaABC.length > 0 ? (
                curvaABC.map((item, index) => (
                  <tr key={item.id || index}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{item.nome}</strong>
                      {isInsumos && item.unidade && (
                        <div className="text-muted small">{item.unidade}</div>
                      )}
                    </td>
                    <td>
                      {isInsumos ? (
                        <Badge bg="secondary">{item.categoria || '—'}</Badge>
                      ) : (
                        <Badge bg="secondary">{item.unidade || '—'}</Badge>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {(item.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                    </td>
                    <td>{formatCurrency(item.precoUnitario || 0)}</td>
                    <td>
                      <strong>{formatCurrency(item.valorTotal)}</strong>
                    </td>
                    <td>{item.percentualValor}%</td>
                    <td>{item.percentualAcumulado}%</td>
                    <td className="text-center">
                      <Badge bg={getCategoriaColor(item.categoriaABC)} className="me-1">
                        {item.categoriaABC}
                      </Badge>
                      {getCategoriaIcon(item.categoriaABC)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center text-muted">
                    Nenhum{isInsumos ? ' insumo' : 'a composição'} encontrado{isInsumos ? '' : 'a'} para exibir
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          <Alert variant="info" className="mt-3">
            <h6>Como interpretar a Curva ABC:</h6>
            <ul className="mb-0">
              <li>
                <strong>Categoria A:</strong> {isInsumos ? 'Insumos' : 'Composições'} críticos que
                concentram ~80% do valor acumulado — controle rigoroso
              </li>
              <li>
                <strong>Categoria B:</strong> itens intermediários (~15% do valor) — controle regular
              </li>
              <li>
                <strong>Categoria C:</strong> itens de menor impacto (~5% do valor) — controle simplificado
              </li>
            </ul>
          </Alert>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CurvaABC;
