/**
 * Formata um valor numérico como moeda brasileira (R$ 1.234,56)
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado como "R$ X.XXX,XX"
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }

  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Formata um valor numérico como moeda brasileira sem o prefixo R$ (1.234,56)
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado como "X.XXX,XX"
 */
export const formatCurrencyValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0,00';
  }

  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};
