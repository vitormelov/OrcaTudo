export function soDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function formatarCpf(valor) {
  const d = soDigitos(valor).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatarCnpj(valor) {
  const d = soDigitos(valor).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatarCpfCnpj(valor) {
  const d = soDigitos(valor);
  if (d.length <= 11) return formatarCpf(valor);
  return formatarCnpj(valor);
}

function todosIguais(digitos) {
  return /^(\d)\1+$/.test(digitos);
}

export function validarCpf(cpfRaw) {
  const cpf = soDigitos(cpfRaw);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i += 1) soma += Number(cpf[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(cpf[i]) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

export function validarCnpj(cnpjRaw) {
  const cnpj = soDigitos(cnpjRaw);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calc = (pesos) => {
    const soma = pesos.reduce((acc, p, i) => acc + Number(cnpj[i]) * p, 0);
    const rest = soma % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(pesos1) === Number(cnpj[12]) && calc(pesos2) === Number(cnpj[13]);
}

export function validarCpfCnpj(valor) {
  const d = soDigitos(valor);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}

export function tipoDocumento(valor) {
  const d = soDigitos(valor);
  if (d.length === 11) return 'CPF';
  if (d.length === 14) return 'CNPJ';
  return '';
}
