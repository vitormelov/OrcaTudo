import { TRIAL_DIAS } from '../constants/plano';

export function dataDe(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();
  if (typeof valor.seconds === 'number') return new Date(valor.seconds * 1000);
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isContaTrial(perfil) {
  if (!perfil) return false;
  if (perfil.assinaturaStatus === 'ativa') return false;
  return perfil.assinaturaStatus === 'trial' || perfil.origem === 'trial';
}

export function isTrialExpirado(perfil) {
  if (!perfil || perfil.assinaturaStatus === 'ativa') return false;
  if (perfil.origem !== 'trial' && !perfil.trialExpiraEm) return false;
  const expira = dataDe(perfil.trialExpiraEm);
  if (!expira) return false;
  return Date.now() > expira.getTime();
}

export function diasTrialRestantes(perfil) {
  const expira = dataDe(perfil?.trialExpiraEm);
  if (!expira) return null;
  const ms = expira.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function calcularTrialExpiraEm(inicio = new Date(), dias = TRIAL_DIAS) {
  const expira = new Date(inicio);
  expira.setDate(expira.getDate() + dias);
  return expira;
}
