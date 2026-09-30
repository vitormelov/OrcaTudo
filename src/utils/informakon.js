/**
 * Conexão com o Informakon (ERP Konstroi).
 *
 * Hoje a integração é feita por arquivo: exporte do Informakon o relatório de
 * pedidos de compra / notas de entrada / apropriação de custos da obra em
 * Excel (.xlsx/.xls) ou CSV e importe no módulo de Gestão. As colunas são
 * reconhecidas automaticamente pelo nome e podem ser ajustadas na tela.
 *
 * Linhas já importadas são ignoradas (chave `informakonRef`), então o mesmo
 * relatório pode ser reimportado sempre que houver novas compras.
 *
 * Integração via API: o Informakon disponibiliza API mediante credenciais
 * fornecidas pela Konstroi. Quando houver acesso, a busca deve rodar em uma
 * função de servidor (ex.: /api/informakon no Vercel) para não expor o token
 * no navegador, e retornar linhas no mesmo formato de `normalizarLinhas`, de
 * modo que todo o fluxo de vínculo/importação abaixo seja reaproveitado.
 */
import { dataParaISO, normalizarTexto, parseNumeroBR, round2, similaridade } from './gestao';

export const CAMPOS_INFORMAKON = [
  { key: 'documento', label: 'Documento / Pedido / NF', obrigatorio: false,
    sinonimos: ['documento', 'n documento', 'num documento', 'pedido', 'n pedido', 'numero pedido', 'nota fiscal', 'nf', 'n nf', 'numero nf', 'nota', 'titulo', 'numero'] },
  { key: 'data', label: 'Data', obrigatorio: false,
    sinonimos: ['data', 'data emissao', 'emissao', 'data entrada', 'data pedido', 'dt emissao', 'dt entrada', 'data compra', 'data lancamento'] },
  { key: 'fornecedor', label: 'Fornecedor', obrigatorio: false,
    sinonimos: ['fornecedor', 'credor', 'razao social', 'favorecido', 'nome fornecedor', 'nome credor'] },
  { key: 'codigoInsumo', label: 'Código do insumo', obrigatorio: false,
    sinonimos: ['codigo insumo', 'cod insumo', 'codigo material', 'cod material', 'codigo produto', 'cod produto', 'codigo', 'cod'] },
  { key: 'descricao', label: 'Descrição', obrigatorio: true,
    sinonimos: ['descricao', 'insumo', 'material', 'produto', 'descricao insumo', 'descricao material', 'descricao produto', 'historico', 'item'] },
  { key: 'apropriacao', label: 'Apropriação / Etapa / Serviço', obrigatorio: false,
    sinonimos: ['apropriacao', 'etapa', 'servico', 'centro de custo', 'centro custo', 'item orcamento', 'item eap', 'eap', 'orcamento', 'subetapa'] },
  { key: 'unidade', label: 'Unidade', obrigatorio: false,
    sinonimos: ['un', 'und', 'unid', 'unidade', 'um'] },
  { key: 'quantidade', label: 'Quantidade', obrigatorio: false,
    sinonimos: ['quantidade', 'qtd', 'qtde', 'quant'] },
  { key: 'valorUnitario', label: 'Valor unitário', obrigatorio: false,
    sinonimos: ['valor unitario', 'vl unitario', 'vlr unitario', 'preco unitario', 'unitario', 'preco', 'vl unit', 'vlr unit'] },
  { key: 'valorTotal', label: 'Valor total', obrigatorio: true,
    sinonimos: ['valor total', 'vl total', 'vlr total', 'total', 'valor', 'valor liquido', 'valor apropriado'] }
];

/** Lê o arquivo e devolve { cabecalho: string[], linhas: any[][] }. */
export async function lerArquivoPlanilha(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: false });

  // Relatórios do ERP costumam ter título/filtros no topo: procura a linha de cabeçalho
  let idxCabecalho = 0;
  let melhor = -1;
  matriz.slice(0, 30).forEach((linha, i) => {
    const pontos = linha.reduce((acc, cel) => {
      const n = normalizarTexto(cel);
      if (!n) return acc;
      return acc + (CAMPOS_INFORMAKON.some((c) => c.sinonimos.includes(n)) ? 1 : 0);
    }, 0);
    if (pontos > melhor) {
      melhor = pontos;
      idxCabecalho = i;
    }
  });

  const cabecalho = (matriz[idxCabecalho] || []).map((c, i) => String(c || '').trim() || `Coluna ${i + 1}`);
  const linhas = matriz
    .slice(idxCabecalho + 1)
    .filter((l) => l.some((c) => String(c ?? '').trim() !== ''));
  return { cabecalho, linhas };
}

/** Sugere o índice de coluna para cada campo com base nos nomes do cabeçalho. */
export function mapearColunas(cabecalho) {
  const norm = cabecalho.map(normalizarTexto);
  const usados = new Set();
  const mapa = {};
  // primeiro correspondências exatas (na ordem dos sinônimos), depois parciais
  CAMPOS_INFORMAKON.forEach((campo) => {
    for (const s of campo.sinonimos) {
      const idx = norm.findIndex((h, i) => !usados.has(i) && h === s);
      if (idx >= 0) {
        mapa[campo.key] = idx;
        usados.add(idx);
        return;
      }
    }
  });
  CAMPOS_INFORMAKON.forEach((campo) => {
    if (mapa[campo.key] !== undefined) return;
    for (const s of campo.sinonimos) {
      if (s.length < 4) continue;
      const idx = norm.findIndex((h, i) => !usados.has(i) && h.includes(s));
      if (idx >= 0) {
        mapa[campo.key] = idx;
        usados.add(idx);
        return;
      }
    }
  });
  return mapa;
}

/** Converte as linhas brutas em linhas de compra normalizadas. */
export function normalizarLinhas(linhas, mapa) {
  const pega = (linha, key) => (mapa[key] === undefined || mapa[key] === '' ? '' : linha[Number(mapa[key])]);
  return linhas
    .map((linha, i) => {
      const quantidade = parseNumeroBR(pega(linha, 'quantidade'));
      const valorUnitario = parseNumeroBR(pega(linha, 'valorUnitario'));
      let valorTotal = parseNumeroBR(pega(linha, 'valorTotal'));
      if (!valorTotal && quantidade && valorUnitario) valorTotal = quantidade * valorUnitario;
      const descricao = String(pega(linha, 'descricao') ?? '').trim();
      const r = {
        linhaArquivo: i + 1,
        documento: String(pega(linha, 'documento') ?? '').trim(),
        data: dataParaISO(pega(linha, 'data')),
        fornecedor: String(pega(linha, 'fornecedor') ?? '').trim(),
        codigoInsumo: String(pega(linha, 'codigoInsumo') ?? '').trim(),
        descricao,
        apropriacao: String(pega(linha, 'apropriacao') ?? '').trim(),
        unidade: String(pega(linha, 'unidade') ?? '').trim(),
        quantidade,
        valorUnitario: valorUnitario || (quantidade ? valorTotal / quantidade : 0),
        valorTotal: round2(valorTotal)
      };
      r.informakonRef = gerarRef(r);
      return r;
    })
    // descarta linhas de total/subtotal do relatório
    .filter((r) => r.descricao && r.valorTotal !== 0 && !/^(sub)?total/i.test(normalizarTexto(r.descricao)));
}

function gerarRef(r) {
  const base = [r.documento, r.data, r.fornecedor, r.codigoInsumo, r.descricao, r.quantidade, r.valorTotal]
    .map((x) => normalizarTexto(x))
    .join('|');
  // hash curto (djb2) — suficiente para identificar a linha
  let h = 5381;
  for (let i = 0; i < base.length; i += 1) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
  return `ifk_${h.toString(36)}_${base.length}`;
}

export function chaveMapaInsumo(linha) {
  return normalizarTexto(linha.codigoInsumo || linha.descricao);
}

/**
 * Sugere o item da gestão para uma linha importada:
 *  1. vínculo aprendido em importações anteriores (mesmo insumo);
 *  2. apropriação do Informakon citando o número/código/descrição do item;
 *  3. semelhança entre a descrição da compra e a do item.
 */
export function sugerirItem(linha, itens, mapaVinculos = {}) {
  const ativos = itens.filter((it) => !it.removido);
  const aprendido = mapaVinculos[chaveMapaInsumo(linha)];
  if (aprendido && ativos.some((it) => it.id === aprendido)) {
    return { itemId: aprendido, motivo: 'vínculo anterior' };
  }

  if (linha.apropriacao) {
    const ap = normalizarTexto(linha.apropriacao);
    const porNumero = ativos.find((it) => {
      const num = it.numero.replace(/\./g, ' ');
      return ap === num || ap.startsWith(`${num} `);
    });
    if (porNumero) return { itemId: porNumero.id, motivo: 'apropriação (nº do item)' };
    const porCodigo = ativos.find((it) => it.codigo && ap.includes(normalizarTexto(it.codigo)));
    if (porCodigo) return { itemId: porCodigo.id, motivo: 'apropriação (código)' };
    // a apropriação pode apontar para um item ou para uma etapa/pacote inteiro:
    // restringe aos itens compatíveis e desempata pela descrição da compra
    const candidatos = ativos.filter(
      (it) => Math.max(similaridade(linha.apropriacao, it.descricao), similaridade(linha.apropriacao, it.caminho)) >= 0.6
    );
    if (candidatos.length === 1) return { itemId: candidatos[0].id, motivo: 'apropriação (descrição)' };
    if (candidatos.length > 1) {
      let melhorAp = null;
      candidatos.forEach((it) => {
        const s = similaridade(linha.descricao, it.descricao);
        if (s >= 0.3 && (!melhorAp || s > melhorAp.s)) melhorAp = { it, s };
      });
      if (melhorAp) return { itemId: melhorAp.it.id, motivo: 'apropriação + descrição' };
    }
  }

  let melhor = null;
  ativos.forEach((it) => {
    const s = similaridade(linha.descricao, it.descricao);
    if (s >= 0.5 && (!melhor || s > melhor.s)) melhor = { it, s };
  });
  if (melhor) return { itemId: melhor.it.id, motivo: `descrição semelhante (${Math.round(melhor.s * 100)}%)` };
  return { itemId: '', motivo: '' };
}

/** Agrupa as linhas em compras (uma por documento + fornecedor + data). */
export function agruparEmCompras(linhas) {
  const grupos = new Map();
  linhas.forEach((l) => {
    const chave = [l.documento || `sem-doc-${l.linhaArquivo}`, l.fornecedor, l.data].join('|');
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        documento: l.documento,
        fornecedor: l.fornecedor,
        data: l.data,
        linhas: []
      });
    }
    grupos.get(chave).linhas.push(l);
  });
  return [...grupos.values()];
}
