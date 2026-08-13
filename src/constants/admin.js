export const ADMIN_EMAIL = 'vitormelov@gmail.com';

export const EMPRESA_STORAGE_KEY = 'orcatudo.empresaId';
export const EMPRESA_NOME_STORAGE_KEY = 'orcatudo.empresaNome';

export function isAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL;
}
