export const PLANO = {
  nome: 'Orça Obra Profissional',
  precoMensal: 89.99,
  moeda: 'BRL',
  ciclo: 'mês',
  modulos: [
    'Insumos com base e cadastro próprio',
    'Composições de custos',
    'Orçamentos completos com EAP',
    'Curva ABC e comparativo de orçamentos',
    'Gestão de clientes e empresas',
    'Multi-usuários por empresa'
  ],
  beneficios: [
    'Acesso ilimitado aos módulos do sistema',
    'Dados da sua empresa isolados e seguros',
    'Atualizações incluídas no plano',
    'Suporte por e-mail',
    'Cancele quando quiser'
  ]
};

export function formatarPrecoPlano(valor = PLANO.precoMensal) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: PLANO.moeda
  });
}
