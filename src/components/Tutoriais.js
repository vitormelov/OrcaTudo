import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, Row, Col, Badge, ListGroup } from 'react-bootstrap';
import {
  FaBuilding, FaBoxes, FaLayerGroup, FaFileInvoiceDollar,
  FaProjectDiagram, FaCalculator, FaChartBar, FaBalanceScale,
  FaFileExcel, FaFilePdf, FaLightbulb, FaBookOpen
} from 'react-icons/fa';

const SECOES = [
  { id: 'inicio', titulo: 'Primeiros passos', icon: FaLightbulb },
  { id: 'empresa', titulo: 'Empresa', icon: FaBuilding },
  { id: 'insumos', titulo: 'Insumos', icon: FaBoxes },
  { id: 'composicoes', titulo: 'Composições', icon: FaLayerGroup },
  { id: 'orcamentos', titulo: 'Orçamentos', icon: FaFileInvoiceDollar },
  { id: 'eap', titulo: 'EAP (estrutura)', icon: FaProjectDiagram },
  { id: 'quantidade', titulo: 'Quantidade e calculadora', icon: FaCalculator },
  { id: 'bdi', titulo: 'BDI', icon: FaCalculator },
  { id: 'exportar', titulo: 'Exportar Excel e PDF', icon: FaFileExcel },
  { id: 'abc', titulo: 'Curva ABC', icon: FaChartBar },
  { id: 'comparativo', titulo: 'Comparativo', icon: FaBalanceScale }
];

function Passo({ n, children }) {
  return (
    <li className="tutoriais-passo">
      <span className="tutoriais-passo-num">{n}</span>
      <div>{children}</div>
    </li>
  );
}

function Secao({ id, titulo, icon: Icon, children, link }) {
  return (
    <Card className="tutoriais-secao mb-4" id={id}>
      <Card.Body>
        <div className="d-flex align-items-start justify-content-between gap-2 mb-3 flex-wrap">
          <h2 className="h4 mb-0 d-flex align-items-center gap-2">
            <span className="tutoriais-icon"><Icon /></span>
            {titulo}
          </h2>
          {link && (
            <Link to={link.to} className="btn btn-sm btn-outline-primary">
              Abrir {link.label}
            </Link>
          )}
        </div>
        {children}
      </Card.Body>
    </Card>
  );
}

function Tutoriais() {
  const location = useLocation();
  const colIndiceRef = useRef(null);
  const cardIndiceRef = useRef(null);

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  // Faz o card de conteúdo descer junto com a rolagem (acompanha a tela)
  useEffect(() => {
    const col = colIndiceRef.current;
    const card = cardIndiceRef.current;
    if (!col || !card) return undefined;

    const scrollRoot = document.querySelector('.App');

    const update = () => {
      if (window.innerWidth < 992) {
        card.style.transform = '';
        return;
      }
      const padding = 16;
      const colTop = col.getBoundingClientRect().top;
      const offset = Math.max(0, padding - colTop);
      const max = Math.max(0, col.offsetHeight - card.offsetHeight - 8);
      card.style.transform = `translateY(${Math.min(offset, max)}px)`;
    };

    const onScroll = () => update();
    scrollRoot?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    return () => {
      scrollRoot?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      card.style.transform = '';
    };
  }, []);

  return (
    <div className="tutoriais-page pb-5">
      <div className="tutoriais-hero mb-4">
        <div className="d-flex align-items-center gap-2">
          <FaBookOpen className="tutoriais-hero-icon" />
          <h1 className="mb-0">Tutoriais</h1>
        </div>
      </div>

      <Row className="tutoriais-layout">
        <Col lg={3} className="mb-4 tutoriais-col-indice" ref={colIndiceRef}>
          <div className="tutoriais-indice" ref={cardIndiceRef}>
            <div className="small text-uppercase text-muted fw-semibold mb-2 px-1">
              Conteúdo
            </div>
            <ListGroup variant="flush">
              {SECOES.map((s) => (
                <ListGroup.Item
                  key={s.id}
                  action
                  as="a"
                  href={`#${s.id}`}
                  className="tutoriais-indice-item"
                >
                  <s.icon className="me-2 opacity-75" />
                  {s.titulo}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        </Col>

        <Col lg={9}>
          <Secao id="inicio" titulo="Primeiros passos" icon={FaLightbulb}>
            <p>
              O fluxo normal do sistema é:
            </p>
            <ol className="tutoriais-lista-simples">
              <li>Entrar (ou criar conta / trial)</li>
              <li>Escolher ou criar uma <strong>empresa</strong></li>
              <li>Cadastrar <strong>insumos</strong> (materiais, mão de obra…)</li>
              <li>Montar <strong>composições</strong> (ou importar da SEINFRA)</li>
              <li>Criar um <strong>orçamento</strong> e montar a <strong>EAP</strong></li>
              <li>Aplicar <strong>BDI</strong>, exportar e analisar a <strong>Curva ABC</strong></li>
            </ol>
          </Secao>

          <Secao id="empresa" titulo="Empresa" icon={FaBuilding} link={{ to: '/empresas', label: 'Empresas' }}>
            <p>Na primeira vez (e sempre que trocar de empresa), você cai na tela de seleção.</p>
            <h3 className="h6 mt-3">Criar sua empresa</h3>
            <ol className="tutoriais-passos">
              <Passo n={1}>Clique em criar empresa.</Passo>
              <Passo n={2}>Preencha o <strong>nome</strong>, o <strong>e-mail</strong> e o documento (CNPJ ou, se não tiver, CPF).</Passo>
              <Passo n={3}>Salve. Você passa a ser o administrador dessa empresa.</Passo>
            </ol>
            <h3 className="h6 mt-3">Entrar em uma empresa existente</h3>
            <ol className="tutoriais-passos">
              <Passo n={1}>Digite o CNPJ ou CPF <strong>exatamente</strong> como cadastrado.</Passo>
              <Passo n={2}>Peça ao admin da empresa para liberar seu acesso, se ainda não estiver vinculado.</Passo>
            </ol>
            <p className="mb-0 text-muted small">
              No menu da conta → <strong>Trocar empresa</strong> você volta para essa tela.
            </p>
          </Secao>

          <Secao id="insumos" titulo="Insumos" icon={FaBoxes} link={{ to: '/insumos', label: 'Insumos' }}>
            <p>
              Insumo é o “tijolo” do orçamento: cimento, pedreiro, betoneira, serviço etc.
              Cada um tem código, unidade, preço e categoria.
            </p>
            <h3 className="h6 mt-3">Criar um insumo manualmente</h3>
            <ol className="tutoriais-passos">
              <Passo n={1}>Abra <strong>Insumos</strong> no menu.</Passo>
              <Passo n={2}>Clique em <strong>Novo</strong> (ou equivalente).</Passo>
              <Passo n={3}>Preencha código, nome, unidade, categoria e preço unitário.</Passo>
              <Passo n={4}>Salve. Ele fica disponível para as composições da sua empresa.</Passo>
            </ol>
            <h3 className="h6 mt-3">Pegar um insumo da SEINFRA</h3>
            <ol className="tutoriais-passos">
              <Passo n={1}>Na tela de Insumos, abra a aba / catálogo <strong>SEINFRA</strong>.</Passo>
              <Passo n={2}>Busque pelo nome ou código.</Passo>
              <Passo n={3}>Abra o item e confirme a categoria, se pedido.</Passo>
              <Passo n={4}>Adicione à sua empresa. O preço e a unidade vêm do catálogo e você pode ajustar depois.</Passo>
            </ol>
            <p className="mb-0">
              <Badge bg="info" className="me-1">Dica</Badge>
              <span className="text-muted small">
                Ao mudar o preço de um insumo já usado em composições, o sistema pode recalcular os totais das composições afetadas.
              </span>
            </p>
          </Secao>

          <Secao id="composicoes" titulo="Composições" icon={FaLayerGroup} link={{ to: '/composicoes', label: 'Composições' }}>
            <p>
              Composição é um serviço/unidade de medida montado a partir de vários insumos
              (ex.: “m² de alvenaria” = tijolo + argamassa + pedreiro…).
            </p>
            <h3 className="h6 mt-3">Criar uma composição</h3>
            <ol className="tutoriais-passos">
              <Passo n={1}>Abra <strong>Composições</strong>.</Passo>
              <Passo n={2}>Clique em nova composição e preencha código, nome e unidade.</Passo>
              <Passo n={3}>Adicione insumos: escolha o item e informe o <strong>coeficiente</strong> (quantidade por unidade da composição).</Passo>
              <Passo n={4}>Salve. O custo unitário é a soma (coeficiente × preço) de cada insumo.</Passo>
            </ol>
            <h3 className="h6 mt-3">Importar composição da SEINFRA</h3>
            <ol className="tutoriais-passos">
              <Passo n={1}>Na tela de Composições, vá ao catálogo <strong>SEINFRA</strong>.</Passo>
              <Passo n={2}>Busque a composição desejada.</Passo>
              <Passo n={3}>Abra o detalhe, confira os insumos e adicione à sua empresa.</Passo>
              <Passo n={4}>
                Se algum insumo ainda não existir na sua base, o sistema costuma criar/vincular o necessário —
                confira depois em Insumos e Composições.
              </Passo>
            </ol>
          </Secao>

          <Secao id="orcamentos" titulo="Orçamentos" icon={FaFileInvoiceDollar} link={{ to: '/orcamentos', label: 'Orçamentos' }}>
            <p>O orçamento é a “pasta” da obra: dados do cliente, endereço e as revisões da EAP.</p>
            <ol className="tutoriais-passos">
              <Passo n={1}>Em <strong>Orçamentos</strong>, clique em novo.</Passo>
              <Passo n={2}>Preencha nome da obra, cliente, endereço e data.</Passo>
              <Passo n={3}>Salve e abra a <strong>EAP</strong> para montar a estrutura de custos.</Passo>
              <Passo n={4}>
                Use <strong>nova revisão</strong> quando quiser travar uma versão e continuar editando outra
                (útil para histórico e comparativo).
              </Passo>
            </ol>
            <p className="mb-0 text-muted small">
              Você também pode copiar um orçamento inteiro para começar a partir de outro já pronto.
            </p>
          </Secao>

          <Secao id="eap" titulo="EAP (estrutura do orçamento)" icon={FaProjectDiagram}>
            <p>
              A EAP organiza o orçamento em <strong>Pacotes → Grupos → Subgrupos → Composições</strong>.
              É aqui que você monta a planilha de custo da obra.
            </p>
            <ol className="tutoriais-passos">
              <Passo n={1}>Abra o orçamento → <strong>EAP</strong>.</Passo>
              <Passo n={2}>Crie pacotes (ex.: “Fundação”, “Superestrutura”).</Passo>
              <Passo n={3}>Dentro do pacote, crie grupos e, se quiser, subgrupos.</Passo>
              <Passo n={4}>Em cada nível, adicione composições do seu catálogo e informe a quantidade.</Passo>
              <Passo n={5}>Arraste itens para reorganizar (quando estiver em modo edição).</Passo>
              <Passo n={6}>Clique em <strong>Salvar EAP</strong> para gravar. Use <strong>Atualizar valores</strong> se o catálogo mudou de preço.</Passo>
            </ol>
            <p className="mb-0">
              <Badge bg="warning" text="dark" className="me-1">Atenção</Badge>
              <span className="text-muted small">
                Revisão travada fica só leitura. Crie uma nova revisão para editar de novo.
              </span>
            </p>
          </Secao>

          <Secao id="quantidade" titulo="Quantidade e calculadora" icon={FaCalculator}>
            <p>
              Ao lado do campo de quantidade de cada composição há um botão de <strong>calculadora</strong>.
            </p>
            <ol className="tutoriais-passos">
              <Passo n={1}>Clique no ícone da calculadora.</Passo>
              <Passo n={2}>
                Digite uma expressão como em Excel, por exemplo: <code>(12*8)*2/1,5</code>
              </Passo>
              <Passo n={3}>Veja o resultado e clique em <strong>Usar na quantidade</strong>.</Passo>
              <Passo n={4}>
                A fórmula fica salva. Depois você pode abrir de novo o botão (ele fica destacado)
                para lembrar <em>por que</em> a quantidade é aquele número.
              </Passo>
            </ol>
            <p className="mb-0 text-muted small">
              Se você alterar a quantidade na mão, a fórmula é limpa. Não esqueça de salvar a EAP.
            </p>
          </Secao>

          <Secao id="bdi" titulo="BDI (Benefícios e Despesas Indiretas)" icon={FaCalculator}>
            <p>
              O BDI transforma o <strong>custo direto</strong> em <strong>preço de venda</strong>,
              incluindo despesas indiretas, financeiras, lucro e tributos.
            </p>
            <ol className="tutoriais-passos">
              <Passo n={1}>Na EAP, abra a configuração de <strong>BDI</strong>.</Passo>
              <Passo n={2}>
                Ajuste os percentuais: despesas indiretas (G), financeiras (DF), lucro (L) e tributos (T).
              </Passo>
              <Passo n={3}>Veja a memória de cálculo na própria tela e clique em <strong>Aplicar</strong>.</Passo>
              <Passo n={4}>Salve a EAP. O total com BDI passa a aparecer no resumo.</Passo>
            </ol>
            <p className="mb-0 text-muted small">
              A fórmula usada é a simplificada no estilo TCU:
              BDI = [(1+G)×(1+DF)×(1+L)/(1−T)] − 1.
            </p>
          </Secao>

          <Secao id="exportar" titulo="Exportar Excel e PDF" icon={FaFileExcel}>
            <p>Na EAP, o menu <strong>Exportar</strong> gera arquivos para envio ao cliente ou arquivo interno.</p>
            <ul className="tutoriais-lista-simples">
              <li>
                <FaFileExcel className="me-1 text-success" />
                <strong>Excel (custo ou venda)</strong> — abas com planilha, BDI, curvas ABC e composições detalhadas.
              </li>
              <li>
                <FaFilePdf className="me-1 text-danger" />
                <strong>PDF</strong> — antes de gerar, você escolhe com checkboxes o que incluir
                (EAP, ABC, composições…).
              </li>
              <li>
                <strong>Planilha de venda</strong> — valores com BDI embutido (precisa ter BDI aplicado).
              </li>
            </ul>
            <p className="mb-0 text-muted small">
              Ordem típica do PDF: planilha → ABC → composições no final.
            </p>
          </Secao>

          <Secao id="abc" titulo="Curva ABC" icon={FaChartBar}>
            <p>
              A Curva ABC mostra quais itens mais pesam no orçamento (A = maior impacto, C = menor).
            </p>
            <ol className="tutoriais-passos">
              <Passo n={1}>Na EAP, abra <strong>Curva ABC</strong>.</Passo>
              <Passo n={2}>Analise por <strong>composições</strong> ou por <strong>insumos</strong>.</Passo>
              <Passo n={3}>Use o resumo e a tabela para priorizar compras e negociações.</Passo>
            </ol>
          </Secao>

          <Secao id="comparativo" titulo="Comparativo de revisões" icon={FaBalanceScale} link={{ to: '/comparativo', label: 'Comparativo' }}>
            <p>Compara duas revisões do mesmo orçamento e mostra o que mudou.</p>
            <ol className="tutoriais-passos">
              <Passo n={1}>Abra <strong>Comparativo</strong>.</Passo>
              <Passo n={2}>Escolha o orçamento e as duas revisões (A e B).</Passo>
              <Passo n={3}>
                Veja diferenças de quantidade, preço e itens novos/removidos —
                útil para explicar evolução do orçamento ao cliente.
              </Passo>
            </ol>
          </Secao>
        </Col>
      </Row>

      <style>{`
        .tutoriais-hero-icon { color: var(--color-primary); font-size: 1.5rem; }
        .tutoriais-layout {
          align-items: stretch;
        }
        .tutoriais-col-indice {
          position: relative;
        }
        .tutoriais-indice {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 0.5rem 0;
          will-change: transform;
        }
        .tutoriais-indice-item {
          border: none !important;
          font-size: 0.9rem;
          color: var(--color-text);
          padding: 0.55rem 1rem;
        }
        .tutoriais-indice-item:hover {
          background: #eef3f7 !important;
          color: var(--color-primary);
        }
        .tutoriais-secao {
          border: 1px solid var(--color-border);
          border-radius: 10px;
          scroll-margin-top: 1rem;
        }
        .tutoriais-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #e8eef3;
          color: var(--color-primary);
          font-size: 0.95rem;
        }
        .tutoriais-passos {
          list-style: none;
          padding: 0;
          margin: 0 0 0.5rem;
        }
        .tutoriais-passo {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          margin-bottom: 0.65rem;
          color: var(--color-text);
        }
        .tutoriais-passo-num {
          flex: 0 0 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--color-primary);
          color: #fff;
          font-size: 0.8rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .tutoriais-lista-simples {
          padding-left: 1.2rem;
        }
        .tutoriais-lista-simples li { margin-bottom: 0.4rem; }
      `}</style>
    </div>
  );
}

export default Tutoriais;
