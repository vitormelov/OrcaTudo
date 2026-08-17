import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { TRIAL_DIAS } from '../constants/plano';
import { soDigitos, validarCpf } from './documentoFiscal';
import { calcularTrialExpiraEm } from './trial';
import { registrarLog } from './activityLog';

export async function iniciarTrial({
  nome,
  email,
  senha,
  nomeEmpresa,
  telefone,
  cpf
}) {
  const documento = soDigitos(cpf);
  if (!validarCpf(documento)) {
    const err = new Error('Informe um CPF válido.');
    err.code = 'trial/documento-invalido';
    throw err;
  }

  const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
  if (nome) {
    await updateProfile(cred.user, { displayName: nome.trim() });
  }

  const uid = cred.user.uid;
  const agora = new Date();
  const trialExpiraEm = calcularTrialExpiraEm(agora, TRIAL_DIAS);

  try {
    await setDoc(doc(db, 'documentosFiscais', documento), {
      cpfCnpj: documento,
      uid,
      email: email.trim().toLowerCase(),
      trialUsado: true,
      createdAt: agora
    });
  } catch (e) {
    try {
      await deleteUser(cred.user);
    } catch {
      // se não der para apagar, o login seguinte ainda cai na regra de trial único
    }
    const err = new Error('Não foi possível iniciar o trial com estes dados. Se você já tem conta, faça login.');
    err.code = 'trial/documento-ja-usado';
    throw err;
  }

  await setDoc(doc(db, 'usuarios', uid), {
    email: email.trim().toLowerCase(),
    displayName: nome.trim(),
    telefone: String(telefone || '').trim(),
    cpf: documento,
    cpfCnpj: documento,
    nomeEmpresaSugerida: String(nomeEmpresa || '').trim(),
    isAdmin: false,
    bloqueado: false,
    origem: 'trial',
    trialUsado: true,
    trialExpiraEm,
    assinaturaStatus: 'trial',
    criouEmpresa: false,
    empresas: [],
    createdAt: agora
  }, { merge: true });

  await registrarLog({
    uid,
    email: email.trim().toLowerCase(),
    displayName: nome.trim(),
    acao: 'trial',
    detalhe: `Iniciou trial de ${TRIAL_DIAS} dias`
  });

  return { uid, trialExpiraEm };
}
