export const MOEDA = 'BRL';

export const MODULOS_COMUNS = [
  'Insumos com base e cadastro próprio',
  'Composições de custos',
  'Orçamentos completos com EAP',
  'Curva ABC e comparativo de orçamentos',
  'Gestão de clientes e empresas'
];

export const BENEFICIOS_COMUNS = [
  'Dados da empresa isolados e seguros',
  'Atualizações incluídas no plano',
  'Suporte por e-mail',
  'Cancele quando quiser'
];

/** Oferta do mês: preço cheio riscado → preço promocional */
export const OFERTA = {
  selo: 'Oferta do mês',
  urgencia: 'Condições válidas para quem fechar agora',
  descontoAnualPct: 17
};

/**
 * Estrutura comercial:
 * Essencial  — 1–2 usuários
 * Empresa    — até 5 (plano principal)
 * Equipe     — até 10
 */
export const PLANOS = [
  {
    id: 'essencial',
    nome: 'Essencial',
    descricao: 'Para orçamentista ou escritório pequeno',
    usuarios: '1–2 usuários',
    precoCheio: 169,
    precoMensal: 129,
    destaque: false,
    recursos: [
      ...MODULOS_COMUNS,
      'Até 2 usuários na mesma empresa',
      ...BENEFICIOS_COMUNS
    ]
  },
  {
    id: 'empresa',
    nome: 'Empresa',
    descricao: 'Ideal para pequenas construtoras',
    usuarios: 'Até 5 usuários',
    precoCheio: 229,
    precoMensal: 179,
    destaque: true,
    seloDestaque: 'Mais popular',
    recursos: [
      ...MODULOS_COMUNS,
      'Multi-usuários (até 5)',
      'Melhor custo-benefício para equipes',
      ...BENEFICIOS_COMUNS
    ]
  },
  {
    id: 'equipe',
    nome: 'Equipe',
    descricao: 'Para times com vários orçamentistas',
    usuarios: 'Até 10 usuários',
    precoCheio: 319,
    precoMensal: 249,
    destaque: false,
    recursos: [
      ...MODULOS_COMUNS,
      'Multi-usuários (até 10)',
      'Prioridade no suporte',
      ...BENEFICIOS_COMUNS
    ]
  }
];

export const PLANO_PADRAO_ID = 'empresa';

export function getPlano(id) {
  return PLANOS.find((p) => p.id === id) || PLANOS.find((p) => p.id === PLANO_PADRAO_ID);
}

export function percentualDesconto(plano) {
  if (!plano?.precoCheio || plano.precoCheio <= plano.precoMensal) return 0;
  return Math.round(((plano.precoCheio - plano.precoMensal) / plano.precoCheio) * 100);
}

/** Equivalente mensal no plano anual (com desconto sobre o preço promocional mensal) */
export function precoMensalAnual(plano) {
  const fator = 1 - OFERTA.descontoAnualPct / 100;
  return Math.round(plano.precoMensal * fator);
}

export function precoAnualTotal(plano) {
  return precoMensalAnual(plano) * 12;
}

export function economiaAnual(plano) {
  return plano.precoMensal * 12 - precoAnualTotal(plano);
}

/** @deprecated use getPlano / PLANOS — mantido para telas que ainda leem PLANO */
export const PLANO = {
  ...getPlano(PLANO_PADRAO_ID),
  moeda: MOEDA,
  ciclo: 'mês',
  modulos: MODULOS_COMUNS,
  beneficios: BENEFICIOS_COMUNS
};

export function formatarPrecoPlano(valor = PLANO.precoMensal) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: MOEDA
  });
}
