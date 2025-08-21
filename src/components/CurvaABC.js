import React, { useState, useEffect } from 'react';
import { Card, Table, Badge, Alert, Spinner, Button } from 'react-bootstrap';
import { FaChartBar, FaExclamationTriangle, FaInfoCircle, FaCheckCircle, FaArrowLeft, FaFilePdf } from 'react-icons/fa';
import { formatCurrency } from '../utils/formatters';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { useParams, useNavigate } from 'react-router-dom';

const CurvaABC = () => {
  const { currentUser } = useAuth();
  const { id: orcamentoId } = useParams();
  const navigate = useNavigate();
  const [orcamentoNome, setOrcamentoNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [curvaABC, setCurvaABC] = useState([]);
  const [resumo, setResumo] = useState({
    totalInsumos: 0,
    valorTotal: 0,
    categoriaA: { quantidade: 0, valor: 0, percentual: 0 },
    categoriaB: { quantidade: 0, valor: 0, percentual: 0 },
    categoriaC: { quantidade: 0, valor: 0, percentual: 0 }
  });

  useEffect(() => {
    if (orcamentoId && currentUser) {
      calcularCurvaABC();
    }
  }, [orcamentoId, currentUser]);



  const calcularCurvaABC = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Buscar o orçamento
      const orcamentoRef = doc(db, 'orcamentos', orcamentoId);
      const orcamentoSnapshot = await getDoc(orcamentoRef);
      
      if (!orcamentoSnapshot.exists()) {
        throw new Error('Orçamento não encontrado');
      }

      const orcamentoData = orcamentoSnapshot.data();
      setOrcamentoNome(orcamentoData.nome);
      
      // Verificar se o usuário é o dono do orçamento
      if (orcamentoData.userId !== currentUser.uid) {
        throw new Error('Acesso negado a este orçamento');
      }

      // Verificar se o orçamento tem estrutura EAP
      if (!orcamentoData.pacotes || orcamentoData.pacotes.length === 0) {
        setError('Este orçamento não possui estrutura EAP configurada. Adicione pacotes e composições na página EAP primeiro.');
        setLoading(false);
        return;
      }



      // 2. Buscar todas as composições
      const composicoesRef = collection(db, 'composicoes');
      const composicoesQuery = query(composicoesRef, where('userId', '==', currentUser.uid));
      const composicoesSnapshot = await getDocs(composicoesQuery);
      const composicoes = composicoesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 3. Buscar todos os insumos
      const insumosRef = collection(db, 'insumos');
      const insumosQuery = query(insumosRef, where('userId', '==', currentUser.uid));
      const insumosSnapshot = await getDocs(insumosQuery);
      const insumos = insumosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));



      // 4. Calcular consumo de insumos no orçamento
      const consumoInsumos = {};
      

      
      // Verificar se há dados para processar
      if (!orcamentoData.pacotes || orcamentoData.pacotes.length === 0) {
        console.log('❌ Nenhum pacote encontrado no orçamento');
        setError('Este orçamento não possui estrutura EAP configurada.');
        setLoading(false);
        return;
      }
      
      // Verificar se há composições para processar
      let totalComposicoesNoOrcamento = 0;
      orcamentoData.pacotes.forEach(pacote => {
        if (pacote.subgrupos) {
          pacote.subgrupos.forEach(subgrupo => {
            if (subgrupo.composicoes) {
              totalComposicoesNoOrcamento += subgrupo.composicoes.length;
            }
          });
        }
      });
      
      console.log(`Total de composições no orçamento: ${totalComposicoesNoOrcamento}`);
      
      // Não vamos parar aqui, vamos continuar para ver os logs detalhados
      
      // Percorrer todas as composições do orçamento
      let totalComposicoesProcessadas = 0;
      let totalInsumosProcessados = 0;
      
      if (orcamentoData.composicoes && Array.isArray(orcamentoData.composicoes)) {
        orcamentoData.composicoes.forEach((compOrcamento, cIdx) => {
          totalComposicoesProcessadas++;
          
          // Usar os insumos diretamente da composição no orçamento
          if (compOrcamento.insumos && Array.isArray(compOrcamento.insumos)) {
            compOrcamento.insumos.forEach((item, iIdx) => {
              totalInsumosProcessados++;
              
              const insumoId = item.insumoId;
              const quantidadeTotal = parseFloat(item.quantidade) * parseFloat(compOrcamento.quantidade);
              
              // Inicializar ou acumular o insumo
              if (!consumoInsumos[insumoId]) {
                consumoInsumos[insumoId] = {
                  insumoId,
                  quantidade: 0,
                  valorTotal: 0
                };
              }
              
              consumoInsumos[insumoId].quantidade += quantidadeTotal;
            });
          }
        });
      }
      
      console.log('\n=== RESUMO DO PROCESSAMENTO ===');
      console.log(`Total de composições processadas: ${totalComposicoesProcessadas}`);
      console.log(`Total de insumos processados: ${totalInsumosProcessados}`);
      console.log(`Insumos únicos encontrados: ${Object.keys(consumoInsumos).length}`);
      console.log('Consumo de insumos calculado:', consumoInsumos);

      // Verificar se há dados para processar
      if (Object.keys(consumoInsumos).length === 0) {
        console.log('❌ Nenhum insumo encontrado para processar');
        console.log('Vamos continuar para ver o que está acontecendo...');
        // Não vamos parar aqui, vamos continuar para ver os logs
      }

      // 5. Calcular valor total de cada insumo
      Object.keys(consumoInsumos).forEach(insumoId => {
        const insumo = insumos.find(i => i.id === insumoId);
        if (insumo) {
          consumoInsumos[insumoId].valorTotal = consumoInsumos[insumoId].quantidade * insumo.precoUnitario;
          consumoInsumos[insumoId].nome = insumo.nome;
          consumoInsumos[insumoId].unidade = insumo.unidade;
          consumoInsumos[insumoId].categoria = insumo.categoria;
          consumoInsumos[insumoId].precoUnitario = insumo.precoUnitario;
        }
      });

      // 6. Ordenar por valor total (decrescente)
      const insumosOrdenados = Object.values(consumoInsumos)
        .filter(item => item.valorTotal > 0)
        .sort((a, b) => b.valorTotal - a.valorTotal);

      // 7. Calcular percentual acumulado e classificar ABC
      const valorTotalGeral = insumosOrdenados.reduce((sum, item) => sum + item.valorTotal, 0);
      let valorAcumulado = 0;

      const curvaABCCompleta = insumosOrdenados.map(item => {
        valorAcumulado += item.valorTotal;
        const percentualAcumulado = (valorAcumulado / valorTotalGeral) * 100;
        
        let categoriaABC = 'C';
        if (percentualAcumulado <= 80) {
          categoriaABC = 'A';
        } else if (percentualAcumulado <= 95) {
          categoriaABC = 'B';
        }

        return {
          ...item,
          categoriaABC,
          percentualAcumulado: percentualAcumulado.toFixed(2),
          percentualValor: ((item.valorTotal / valorTotalGeral) * 100).toFixed(2)
        };
      });

      // 8. Calcular resumo por categoria
      const resumoCalculado = {
        totalInsumos: curvaABCCompleta.length,
        valorTotal: valorTotalGeral,
        categoriaA: { quantidade: 0, valor: 0, percentual: 0 },
        categoriaB: { quantidade: 0, valor: 0, percentual: 0 },
        categoriaC: { quantidade: 0, valor: 0, percentual: 0 }
      };

      curvaABCCompleta.forEach(item => {
        if (item.categoriaABC === 'A') {
          resumoCalculado.categoriaA.quantidade++;
          resumoCalculado.categoriaA.valor += item.valorTotal;
        } else if (item.categoriaABC === 'B') {
          resumoCalculado.categoriaB.quantidade++;
          resumoCalculado.categoriaB.valor += item.valorTotal;
        } else {
          resumoCalculado.categoriaC.quantidade++;
          resumoCalculado.categoriaC.valor += item.valorTotal;
        }
      });

      // Calcular percentuais
      resumoCalculado.categoriaA.percentual = ((resumoCalculado.categoriaA.valor / valorTotalGeral) * 100).toFixed(2);
      resumoCalculado.categoriaB.percentual = ((resumoCalculado.categoriaB.valor / valorTotalGeral) * 100).toFixed(2);
      resumoCalculado.categoriaC.percentual = ((resumoCalculado.categoriaC.valor / valorTotalGeral) * 100).toFixed(2);

      setCurvaABC(curvaABCCompleta);
      setResumo(resumoCalculado);
      


    } catch (error) {
      console.error('Erro ao calcular Curva ABC:', error);
      setError('Erro ao calcular a Curva ABC: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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
    // Importação dinâmica para evitar problemas de SSR
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(20);
        doc.text(`Curva ABC - ${orcamentoNome}`, 14, 22);
        
        // Data de geração
        doc.setFontSize(12);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 32);
        
        // Resumo
        doc.setFontSize(14);
        doc.text('Resumo por Categoria:', 14, 45);
        
        doc.setFontSize(10);
        doc.text(`Categoria A: ${resumo.categoriaA.quantidade} insumos - ${formatCurrency(resumo.categoriaA.valor)} (${resumo.categoriaA.percentual}%)`, 14, 55);
        doc.text(`Categoria B: ${resumo.categoriaB.quantidade} insumos - ${formatCurrency(resumo.categoriaB.valor)} (${resumo.categoriaB.percentual}%)`, 14, 62);
        doc.text(`Categoria C: ${resumo.categoriaC.quantidade} insumos - ${formatCurrency(resumo.categoriaC.valor)} (${resumo.categoriaC.percentual}%)`, 14, 69);
        doc.text(`Total: ${resumo.totalInsumos} insumos - ${formatCurrency(resumo.valorTotal)}`, 14, 76);
        
        // Tabela de insumos
        const tableData = curvaABC.map((item, index) => [
          index + 1,
          item.nome,
          item.categoria,
          item.quantidade.toFixed(2),
          formatCurrency(item.precoUnitario),
          formatCurrency(item.valorTotal),
          `${item.percentualValor}%`,
          `${item.percentualAcumulado}%`,
          item.categoriaABC
        ]);
        
        autoTable(doc, {
          head: [['#', 'Insumo', 'Categoria', 'Quantidade', 'Preço Unit.', 'Valor Total', '% Total', '% Acumulado', 'ABC']],
          body: tableData,
          startY: 85,
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255
          }
        });
        
        // Salvar PDF
        doc.save(`CurvaABC_${orcamentoNome}_${new Date().toISOString().split('T')[0]}.pdf`);
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
      </Alert>
    );
  }

  return (
    <div>
      <Card className="mb-4">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">
              <FaChartBar className="me-2" />
              Curva ABC - {orcamentoNome}
            </h4>
            <div className="d-flex gap-2">
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
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="text-center p-3 border rounded">
                <h5 className="text-danger">Categoria A</h5>
                <h6>{resumo.categoriaA.quantidade} insumos</h6>
                <strong>{formatCurrency(resumo.categoriaA.valor)}</strong>
                <div className="text-muted">{resumo.categoriaA.percentual}% do total</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 border rounded">
                <h5 className="text-warning">Categoria B</h5>
                <h6>{resumo.categoriaB.quantidade} insumos</h6>
                <strong>{formatCurrency(resumo.categoriaB.valor)}</strong>
                <div className="text-muted">{resumo.categoriaB.percentual}% do total</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 border rounded">
                <h5 className="text-success">Categoria C</h5>
                <h6>{resumo.categoriaC.quantidade} insumos</h6>
                <strong>{formatCurrency(resumo.categoriaC.valor)}</strong>
                <div className="text-muted">{resumo.categoriaC.percentual}% do total</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 border rounded">
                <h5 className="text-primary">Total</h5>
                <h6>{resumo.totalInsumos} insumos</h6>
                <strong>{formatCurrency(resumo.valorTotal)}</strong>
                <div className="text-muted">100%</div>
              </div>
            </div>
          </div>



          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>Insumo</th>
                <th>Categoria</th>
                <th>Quantidade</th>
                <th>Preço Unit.</th>
                <th>Valor Total</th>
                <th>% do Total</th>
                <th>% Acumulado</th>
                <th>ABC</th>
              </tr>
            </thead>
            <tbody>
              {curvaABC && curvaABC.length > 0 ? (
                curvaABC.map((item, index) => (
                  <tr key={item.insumoId}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{item.nome}</strong>
                      <div className="text-muted small">{item.categoria}</div>
                    </td>
                    <td>
                      <Badge bg="secondary">{item.unidade}</Badge>
                    </td>
                    <td>{item.quantidade.toFixed(2)}</td>
                    <td>{formatCurrency(item.precoUnitario)}</td>
                    <td>
                      <strong>{formatCurrency(item.valorTotal)}</strong>
                    </td>
                    <td>{item.percentualValor}%</td>
                    <td>{item.percentualAcumulado}%</td>
                    <td className="text-center">
                      <Badge bg={getCategoriaColor(item.categoriaABC)}>
                        {item.categoriaABC}
                      </Badge>
                      {getCategoriaIcon(item.categoriaABC)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center text-muted">
                    Nenhum insumo encontrado para exibir
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          <Alert variant="info" className="mt-3">
            <h6>Como interpretar a Curva ABC:</h6>
            <ul className="mb-0">
              <li><strong>Categoria A (Vermelho):</strong> Insumos críticos que representam 80% do valor total - controle rigoroso necessário</li>
              <li><strong>Categoria B (Amarelo):</strong> Insumos importantes que representam 15% do valor total - controle regular</li>
              <li><strong>Categoria C (Verde):</strong> Insumos de baixo valor que representam 5% do valor total - controle simplificado</li>
            </ul>
          </Alert>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CurvaABC;
