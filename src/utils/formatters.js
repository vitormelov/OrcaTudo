/**
 * Formata um valor numérico como moeda brasileira com 2 casas decimais
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado como "R$ X,XX"
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }
  
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
};

/**
 * Formata um valor numérico como moeda brasileira com 2 casas decimais (sem o R$)
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado como "X,XX"
 */
export const formatCurrencyValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0,00';
  }
  
  return Number(value).toFixed(2).replace('.', ',');
};
