import React, { useEffect, useState } from 'react';
import {
  Card, Button, Form, Table, Modal, Alert, Badge
} from 'react-bootstrap';
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { isAdminEmail } from '../constants/admin';
import { formatarCpfCnpj, soDigitos, tipoDocumento, validarCpfCnpj } from '../utils/documentoFiscal';
import {
  FaUserPlus, FaUsers, FaBuilding, FaSave, FaEdit, FaTrash, FaBan, FaUnlock, FaPlus, FaHistory
} from 'react-icons/fa';
import AdminLogs from './AdminLogs';

function normalizarTexto(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatarDataCriacao(valor) {
  if (!valor) return '—';
  let date = null;
  if (typeof valor.toDate === 'function') date = valor.toDate();
  else if (valor.seconds) date = new Date(valor.seconds * 1000);
  else date = new Date(valor);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function AdminUsuarios() {
  const { criarUsuarioAuth, recarregarPerfil, currentUser } = useAuth();
  const { criarEmpresa, empresaId, limparEmpresa } = useEmpresa();
  const [usuarios, setUsuarios] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [vista, setVista] = useState('empresas');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [editandoUser, setEditandoUser] = useState(null);
  const [editandoEmpresa, setEditandoEmpresa] = useState(null);
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState('');
  const [formEmpresa, setFormEmpresa] = useState({
    nome: '',
    endereco: '',
    telefone: '',
    email: '',
    cnpj: ''
  });
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    empresaId: '',
    colaborador: true
  });

  const carregar = async () => {
    const [uSnap, eSnap] = await Promise.all([
      getDocs(collection(db, 'usuarios')),
      getDocs(collection(db, 'empresas'))
    ]);
    const usuariosData = uSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const empresasData = await Promise.all(eSnap.docs.map(async (d) => {
      const mSnap = await getDocs(collection(db, 'empresas', d.id, 'membros'));
      const membros = mSnap.docs.map((m) => ({ id: m.id, ...m.data() }));
      const membrosSemAdmin = membros.filter((m) => {
        const perfil = usuariosData.find((u) => u.id === m.id);
        return !perfil?.isAdmin && !isAdminEmail(m.email) && !isAdminEmail(perfil?.email);
      });
      return {
        id: d.id,
        ...d.data(),
        membros,
        usuariosCount: membrosSemAdmin.length
      };
    }));
    empresasData.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    setUsuarios(usuariosData);
    setEmpresas(empresasData);
    return empresasData;
  };

  useEffect(() => {
    carregar().catch((e) => {
      console.error(e);
      setError('Erro ao carregar usuários e empresas. Publique as regras do Firestore se ainda não o fez.');
    });
  }, []);

  const empresaSelecionada = empresas.find((e) => e.id === empresaSelecionadaId) || null;
  const empresasAtivas = empresas.filter((e) => !e.bloqueada);

  const resetUserForm = () => {
    setForm({
      displayName: '',
      email: '',
      password: '',
      empresaId: empresaSelecionadaId || '',
      colaborador: true
    });
    setEditandoUser(null);
  };

  const sincronizarMembro = async (uid, email, displayName, empresaDestinoId, colaborador) => {
    await setDoc(doc(db, 'empresas', empresaDestinoId, 'membros', uid), {
      uid,
      email,
      displayName: displayName || '',
      colaborador: Boolean(colaborador)
    });
  };

  const resetEmpresaForm = () => {
    setFormEmpresa({
      nome: '',
      endereco: '',
      telefone: '',
      email: '',
      cnpj: ''
    });
    setEditandoEmpresa(null);
  };

  const abrirNovaEmpresa = () => {
    resetEmpresaForm();
    setShowEmpresaModal(true);
  };

  const abrirEditarEmpresa = (empresa, e) => {
    e?.stopPropagation();
    setEditandoEmpresa(empresa);
    setFormEmpresa({
      nome: empresa.nome || '',
      endereco: empresa.endereco || '',
      telefone: empresa.telefone || '',
      email: empresa.email || '',
      cnpj: formatarCpfCnpj(empresa.cnpj || '')
    });
    setShowEmpresaModal(true);
  };

  const handleSalvarEmpresa = async (e) => {
    e.preventDefault();
    const nomeTrim = formEmpresa.nome.trim();
    const cnpjNovo = soDigitos(formEmpresa.cnpj);
    if (cnpjNovo && !validarCpfCnpj(cnpjNovo)) {
      setError('Informe um CPF ou CNPJ válido.');
      return;
    }
    const dadosEmpresa = {
      nome: nomeTrim,
      endereco: formEmpresa.endereco.trim(),
      telefone: formEmpresa.telefone.trim(),
      email: formEmpresa.email.trim().toLowerCase(),
      cnpj: cnpjNovo,
      tipoDocumento: tipoDocumento(cnpjNovo) || ''
    };
    if (!nomeTrim) {
      setError('Informe o nome da empresa.');
      return;
    }
    const nomeDuplicado = empresas.some((e) =>
      e.id !== editandoEmpresa?.id && normalizarTexto(e.nome) === normalizarTexto(nomeTrim)
    );
    if (nomeDuplicado) {
      setError(`Já existe uma empresa com o nome "${nomeTrim}".`);
      return;
    }
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      if (editandoEmpresa) {
        await updateDoc(doc(db, 'empresas', editandoEmpresa.id), {
          ...dadosEmpresa,
          updatedAt: new Date()
        });
        const cnpjAntigo = soDigitos(editandoEmpresa.cnpj);
        if (cnpjAntigo && cnpjAntigo !== cnpjNovo) {
          await deleteDoc(doc(db, 'empresasPorCnpj', cnpjAntigo)).catch(() => {});
        }
        if (validarCpfCnpj(cnpjNovo)) {
          await setDoc(doc(db, 'empresasPorCnpj', cnpjNovo), {
            empresaId: editandoEmpresa.id,
            nome: nomeTrim,
            email: dadosEmpresa.email,
            createdBy: currentUser.uid,
            createdAt: new Date()
          });
        }
        const afetados = usuarios.filter((u) =>
          (u.empresas || []).some((x) => x.id === editandoEmpresa.id)
        );
        await Promise.all(afetados.map((u) =>
          updateDoc(doc(db, 'usuarios', u.id), {
            empresas: (u.empresas || []).map((x) =>
              x.id === editandoEmpresa.id ? { ...x, nome: nomeTrim } : x
            )
          })
        ));
        setSuccess('Empresa atualizada.');
      } else {
        const criada = await criarEmpresa(dadosEmpresa);
        setEmpresaSelecionadaId(criada.id);
        setSuccess('Empresa criada.');
      }
      setShowEmpresaModal(false);
      resetEmpresaForm();
      await carregar();
      await recarregarPerfil();
    } catch (err) {
      setError(err.message || 'Erro ao salvar empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleBloquearEmpresa = async (empresa, e) => {
    e?.stopPropagation();
    const bloquear = !empresa.bloqueada;
    const ok = window.confirm(
      bloquear
        ? `Bloquear "${empresa.nome}"? Os usuários cadastrados não poderão entrar até desbloquear. O administrador continua com acesso.`
        : `Desbloquear "${empresa.nome}"?`
    );
    if (!ok) return;
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      await updateDoc(doc(db, 'empresas', empresa.id), {
        bloqueada: bloquear,
        updatedAt: new Date()
      });
      await carregar();
      setSuccess(bloquear ? 'Empresa bloqueada.' : 'Empresa desbloqueada.');
    } catch (err) {
      setError(err.message || 'Erro ao alterar o bloqueio da empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirEmpresa = async (empresa, e) => {
    e?.stopPropagation();
    const ok = window.confirm(
      `Excluir "${empresa.nome}"?\n\nOs usuários serão desvinculados desta empresa. Esta ação não pode ser desfeita.`
    );
    if (!ok) return;
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const membros = empresa.membros || [];
      const CHUNK = 400;
      for (let i = 0; i < membros.length; i += CHUNK) {
        const batch = writeBatch(db);
        membros.slice(i, i + CHUNK).forEach((m) => {
          batch.delete(doc(db, 'empresas', empresa.id, 'membros', m.id));
        });
        await batch.commit();
      }
      const afetados = usuarios.filter((u) =>
        (u.empresas || []).some((x) => x.id === empresa.id)
      );
      await Promise.all(afetados.map((u) =>
        updateDoc(doc(db, 'usuarios', u.id), {
          empresas: (u.empresas || []).filter((x) => x.id !== empresa.id)
        })
      ));
      const cnpj = soDigitos(empresa.cnpj);
      if (validarCpfCnpj(cnpj)) {
        await deleteDoc(doc(db, 'empresasPorCnpj', cnpj)).catch(() => {});
      }
      await deleteDoc(doc(db, 'empresas', empresa.id));
      if (empresaId === empresa.id) {
        limparEmpresa();
      }
      if (empresaSelecionadaId === empresa.id) {
        setEmpresaSelecionadaId('');
      }
      await carregar();
      await recarregarPerfil();
      setSuccess('Empresa excluída.');
    } catch (err) {
      setError(err.message || 'Erro ao excluir empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirUser = async (user) => {
    if (!user?.id || user.isAdmin || isAdminEmail(user.email)) return;
    const nome = user.displayName || user.email || 'este usuário';
    const ok = window.confirm(
      `Excluir o usuário "${nome}"?\n\nEle será desvinculado das empresas e não aparecerá mais no sistema.`
    );
    if (!ok) return;
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const perfil = usuarios.find((u) => u.id === user.id) || user;
      const empresaIds = new Set([
        ...(perfil.empresas || []).map((e) => e.id),
        ...empresas.map((e) => e.id)
      ]);
      await Promise.all(
        [...empresaIds].map((id) =>
          deleteDoc(doc(db, 'empresas', id, 'membros', user.id)).catch(() => {})
        )
      );
      await deleteDoc(doc(db, 'usuarios', user.id));
      await carregar();
      await recarregarPerfil();
      setSuccess('Usuário excluído.');
    } catch (err) {
      setError(err.message || 'Erro ao excluir usuário.');
    } finally {
      setLoading(false);
    }
  };

  const handleBloquearUser = async (user) => {
    if (!user?.id || user.isAdmin || isAdminEmail(user.email)) return;
    const perfilUser = usuarios.find((u) => u.id === user.id) || user;
    const bloquear = !perfilUser.bloqueado;
    const nome = perfilUser.displayName || perfilUser.email || 'este usuário';
    const ok = window.confirm(
      bloquear
        ? `Bloquear o usuário "${nome}"? Ele não poderá entrar até ser desbloqueado.`
        : `Desbloquear o usuário "${nome}"?`
    );
    if (!ok) return;
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      await updateDoc(doc(db, 'usuarios', perfilUser.id), {
        bloqueado: bloquear,
        updatedAt: new Date()
      });
      await carregar();
      setSuccess(bloquear ? 'Usuário bloqueado.' : 'Usuário desbloqueado.');
    } catch (err) {
      setError(err.message || 'Erro ao alterar o bloqueio do usuário.');
    } finally {
      setLoading(false);
    }
  };

  const abrirNovoUser = () => {
    resetUserForm();
    setForm((prev) => ({
      ...prev,
      empresaId: empresaSelecionadaId || prev.empresaId
    }));
    setShowUserModal(true);
  };

  const abrirEditarUser = (user) => {
    const vinculo = (user.empresas || []).find((x) => x.id === empresaSelecionadaId)
      || (user.empresas || [])[0];
    setEditandoUser(user);
    setForm({
      displayName: user.displayName || '',
      email: user.email || '',
      password: '',
      empresaId: vinculo?.id || empresaSelecionadaId || '',
      colaborador: vinculo ? Boolean(vinculo.colaborador) : true
    });
    setShowUserModal(true);
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const empresa = form.empresaId
      ? empresas.find((x) => x.id === form.empresaId)
      : null;
    if (form.empresaId && !empresa) {
      setError('Empresa inválida.');
      return;
    }
    if (empresa?.bloqueada) {
      setError('Não é possível vincular usuário a uma empresa bloqueada.');
      return;
    }

    const nomeTrim = form.displayName.trim();
    const emailNorm = form.email.trim().toLowerCase();
    const nomeDuplicado = usuarios.some((u) =>
      u.id !== editandoUser?.id && normalizarTexto(u.displayName) === normalizarTexto(nomeTrim)
    );
    if (nomeDuplicado) {
      setError(`Já existe um usuário com o nome "${nomeTrim}".`);
      return;
    }
    const emailDuplicado = usuarios.some((u) =>
      u.id !== editandoUser?.id && String(u.email || '').trim().toLowerCase() === emailNorm
    );
    if (emailDuplicado) {
      setError(`Já existe um usuário com o email "${form.email.trim()}".`);
      return;
    }

    try {
      setLoading(true);
      const empresasUser = empresa
        ? [{
          id: empresa.id,
          nome: empresa.nome,
          colaborador: Boolean(form.colaborador)
        }]
        : [];
      if (editandoUser) {
        await updateDoc(doc(db, 'usuarios', editandoUser.id), {
          displayName: nomeTrim,
          empresas: empresasUser
        });
        if (empresa) {
          await sincronizarMembro(
            editandoUser.id,
            editandoUser.email,
            nomeTrim,
            empresa.id,
            form.colaborador
          );
        }
        const antigas = (editandoUser.empresas || []).filter((x) => x.id !== empresa?.id);
        await Promise.all(antigas.map((antiga) =>
          deleteDoc(doc(db, 'empresas', antiga.id, 'membros', editandoUser.id)).catch(() => {})
        ));
        setSuccess('Usuário atualizado.');
      } else {
        if (!form.password || form.password.length < 6) {
          throw new Error('A senha inicial deve ter pelo menos 6 caracteres.');
        }
        const uid = await criarUsuarioAuth(
          emailNorm,
          form.password,
          nomeTrim
        );
        await setDoc(doc(db, 'usuarios', uid), {
          email: emailNorm,
          displayName: nomeTrim,
          isAdmin: false,
          bloqueado: false,
          criouEmpresa: false,
          empresas: empresasUser,
          createdAt: new Date(),
          createdBy: currentUser.uid
        });
        if (empresa) {
          await sincronizarMembro(
            uid,
            emailNorm,
            nomeTrim,
            empresa.id,
            form.colaborador
          );
        }
        setSuccess('Usuário criado. Ele já pode entrar com o email e a senha definidos.');
      }
      setShowUserModal(false);
      resetUserForm();
      if (empresa) setEmpresaSelecionadaId(empresa.id);
      await carregar();
      await recarregarPerfil();
    } catch (err) {
      console.error(err);
      const msg = err.code === 'auth/email-already-in-use'
        ? 'Já existe uma conta com este email.'
        : (err.message || 'Erro ao salvar usuário.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const usuariosDaEmpresa = (empresaSelecionada?.membros || [])
    .map((membro) => {
      const perfil = usuarios.find((u) => u.id === membro.id);
      return {
        ...membro,
        displayName: membro.displayName || perfil?.displayName || '',
        email: membro.email || perfil?.email || '',
        createdAt: perfil?.createdAt || membro.createdAt,
        bloqueado: Boolean(perfil?.bloqueado),
        isAdmin: Boolean(perfil?.isAdmin || isAdminEmail(membro.email) || isAdminEmail(perfil?.email))
      };
    })
    .filter((u) => !u.isAdmin);

  const todosUsuariosCadastrados = usuarios
    .filter((u) => !u.isAdmin && !isAdminEmail(u.email))
    .map((u) => {
      const vinculo = (u.empresas || [])[0];
      const empresa = empresas.find((e) => e.id === vinculo?.id);
      return {
        ...u,
        colaborador: Boolean(vinculo?.colaborador),
        empresaNome: empresa?.nome || vinculo?.nome || 'Sem empresa'
      };
    })
    .sort((a, b) => String(a.displayName || a.email || '').localeCompare(String(b.displayName || b.email || ''), 'pt-BR'));

  const resolverUsuario = (u) => usuarios.find((x) => x.id === u.id) || u;

  const botoesAcaoUsuario = (u) => (
    !u.isAdmin && (
      <>
        <Button
          size="sm"
          variant="outline-primary"
          className="me-2"
          title="Editar"
          onClick={() => abrirEditarUser(resolverUsuario(u))}
        >
          <FaEdit />
        </Button>
        <Button
          size="sm"
          variant={u.bloqueado ? 'outline-success' : 'outline-warning'}
          className="me-2"
          title={u.bloqueado ? 'Desbloquear' : 'Bloquear'}
          disabled={loading}
          onClick={() => handleBloquearUser(resolverUsuario(u))}
        >
          {u.bloqueado ? <FaUnlock /> : <FaBan />}
        </Button>
        <Button
          size="sm"
          variant="outline-danger"
          title="Excluir"
          disabled={loading}
          onClick={() => handleExcluirUser(resolverUsuario(u))}
        >
          <FaTrash />
        </Button>
      </>
    )
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h1><FaBuilding className="me-2" />Administração</h1>
          <p className="text-muted mb-0">Empresas, usuários, permissões e log de acessos</p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Button variant="outline-primary" onClick={abrirNovaEmpresa}>
            <FaPlus className="me-2" />
            Nova empresa
          </Button>
          <Button variant="outline-primary" onClick={abrirNovoUser}>
            <FaUserPlus className="me-2" />
            Novo usuário
          </Button>
          <span className="admin-toolbar-sep" aria-hidden="true" />
          <Button
            variant={vista === 'empresas' ? 'primary' : 'outline-primary'}
            onClick={() => setVista('empresas')}
          >
            <FaBuilding className="me-2" />
            Empresas
          </Button>
          <Button
            variant={vista === 'usuarios' ? 'primary' : 'outline-primary'}
            onClick={() => setVista('usuarios')}
          >
            <FaUsers className="me-2" />
            Usuários
          </Button>
          <span className="admin-toolbar-sep" aria-hidden="true" />
          <Button
            variant={vista === 'logs' ? 'primary' : 'outline-primary'}
            onClick={() => setVista('logs')}
          >
            <FaHistory className="me-2" />
            Log de acessos
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {vista === 'logs' ? (
        <AdminLogs />
      ) : vista === 'usuarios' ? (
      <Card>
        <Card.Header>
          <FaUsers className="me-2" />
          Todos os usuários cadastrados
        </Card.Header>
        <Card.Body className="p-0">
          {todosUsuariosCadastrados.length === 0 ? (
            <p className="text-muted p-3 mb-0">Nenhum usuário cadastrado.</p>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Empresa</th>
                  <th>Criado em</th>
                  <th>Permissão</th>
                  <th>Status</th>
                  <th style={{ width: 180 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {todosUsuariosCadastrados.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>{u.empresaNome}</td>
                    <td>{formatarDataCriacao(u.createdAt)}</td>
                    <td>
                      {(u.empresas || []).length === 0
                        ? <Badge bg="light" text="dark">Sem vínculo</Badge>
                        : u.colaborador
                          ? <Badge bg="primary">Colaborador</Badge>
                          : <Badge bg="secondary">Somente leitura</Badge>}
                    </td>
                    <td>
                      {u.bloqueado
                        ? <Badge bg="danger">Bloqueado</Badge>
                        : <Badge bg="success">Ativo</Badge>}
                    </td>
                    <td>{botoesAcaoUsuario(u)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      ) : (
      <>
      <Card className="mb-4">
        <Card.Header><FaBuilding className="me-2" />Empresas</Card.Header>
        <Card.Body className="p-0">
          {empresas.length === 0 ? (
            <p className="text-muted p-3 mb-0">Nenhuma empresa ainda. Crie a primeira para começar.</p>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Usuários</th>
                  <th>Criada em</th>
                  <th>Status</th>
                  <th style={{ width: 210 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => (
                  <tr
                    key={empresa.id}
                    onClick={() => setEmpresaSelecionadaId(empresa.id)}
                    style={{ cursor: 'pointer' }}
                    className={empresaSelecionadaId === empresa.id ? 'table-primary' : ''}
                  >
                    <td><strong>{empresa.nome}</strong></td>
                    <td>{empresa.usuariosCount}</td>
                    <td>{formatarDataCriacao(empresa.createdAt)}</td>
                    <td>
                      {empresa.bloqueada
                        ? <Badge bg="danger">Bloqueada</Badge>
                        : <Badge bg="success">Ativa</Badge>}
                    </td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        title="Editar"
                        onClick={(ev) => abrirEditarEmpresa(empresa, ev)}
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        size="sm"
                        variant={empresa.bloqueada ? 'outline-success' : 'outline-warning'}
                        className="me-2"
                        title={empresa.bloqueada ? 'Desbloquear' : 'Bloquear'}
                        disabled={loading}
                        onClick={(ev) => handleBloquearEmpresa(empresa, ev)}
                      >
                        {empresa.bloqueada ? <FaUnlock /> : <FaBan />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        title="Excluir"
                        disabled={loading}
                        onClick={(ev) => handleExcluirEmpresa(empresa, ev)}
                      >
                        <FaTrash />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>
            <FaUsers className="me-2" />
            {empresaSelecionada
              ? `Usuários de ${empresaSelecionada.nome}`
              : 'Usuários da empresa'}
          </span>
          {empresaSelecionada && !empresaSelecionada.bloqueada && (
            <Button size="sm" variant="outline-primary" onClick={abrirNovoUser}>
              <FaUserPlus className="me-1" />
              Vincular usuário
            </Button>
          )}
        </Card.Header>
        <Card.Body className="p-0">
          {!empresaSelecionada ? (
            <p className="text-muted p-3 mb-0">Clique em uma empresa na lista para ver os usuários vinculados.</p>
          ) : usuariosDaEmpresa.length === 0 ? (
            <p className="text-muted p-3 mb-0">Nenhum usuário vinculado a esta empresa.</p>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Criado em</th>
                  <th>Permissão</th>
                  <th>Status</th>
                  <th style={{ width: 180 }}></th>
                </tr>
              </thead>
              <tbody>
                {usuariosDaEmpresa.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>{formatarDataCriacao(u.createdAt)}</td>
                    <td>
                      {u.isAdmin ? (
                        <Badge bg="dark">Admin</Badge>
                      ) : u.colaborador ? (
                        <Badge bg="primary">Colaborador</Badge>
                      ) : (
                        <Badge bg="secondary">Somente leitura</Badge>
                      )}
                    </td>
                    <td>
                      {u.bloqueado
                        ? <Badge bg="danger">Bloqueado</Badge>
                        : <Badge bg="success">Ativo</Badge>}
                    </td>
                    <td>{botoesAcaoUsuario(u)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      </>
      )}

      <Modal show={showEmpresaModal} onHide={() => { setShowEmpresaModal(false); resetEmpresaForm(); }}>
        <Form onSubmit={handleSalvarEmpresa}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoEmpresa ? 'Editar empresa' : 'Nova empresa'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nome *</Form.Label>
              <Form.Control
                value={formEmpresa.nome}
                onChange={(e) => setFormEmpresa({ ...formEmpresa, nome: e.target.value })}
                placeholder="Nome da empresa"
                required
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Endereço</Form.Label>
              <Form.Control
                value={formEmpresa.endereco}
                onChange={(e) => setFormEmpresa({ ...formEmpresa, endereco: e.target.value })}
                placeholder="Rua, número, cidade"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Telefone para contato</Form.Label>
              <Form.Control
                type="tel"
                value={formEmpresa.telefone}
                onChange={(e) => setFormEmpresa({ ...formEmpresa, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email para contato</Form.Label>
              <Form.Control
                type="email"
                value={formEmpresa.email}
                onChange={(e) => setFormEmpresa({ ...formEmpresa, email: e.target.value })}
                placeholder="contato@empresa.com"
              />
            </Form.Group>
            <Form.Group className="mb-0">
              <Form.Label>CPF ou CNPJ</Form.Label>
              <Form.Control
                value={formEmpresa.cnpj}
                onChange={(e) => setFormEmpresa({ ...formEmpresa, cnpj: formatarCpfCnpj(e.target.value) })}
                placeholder="CPF ou CNPJ da empresa"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowEmpresaModal(false); resetEmpresaForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              <FaSave className="me-2" />
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showUserModal} onHide={() => { setShowUserModal(false); resetUserForm(); }}>
        <Form onSubmit={handleSubmitUser}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoUser ? 'Editar usuário' : 'Novo usuário'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nome</Form.Label>
              <Form.Control
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                disabled={Boolean(editandoUser)}
              />
            </Form.Group>
            {!editandoUser && (
              <Form.Group className="mb-3">
                <Form.Label>Senha inicial</Form.Label>
                <Form.Control
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Empresa</Form.Label>
              <Form.Select
                value={form.empresaId}
                onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
              >
                <option value="">Nenhuma (sem vínculo)</option>
                {empresasAtivas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </Form.Select>
            </Form.Group>
            {form.empresaId ? (
              <>
                <Form.Check
                  type="switch"
                  id="colaborador-switch"
                  label="Colaborador (pode criar, editar e excluir)"
                  checked={form.colaborador}
                  onChange={(e) => setForm({ ...form, colaborador: e.target.checked })}
                />
                <p className="text-muted small mt-2 mb-0">
                  Sem a opção colaborador, o usuário só visualiza os dados da empresa.
                </p>
              </>
            ) : (
              <p className="text-muted small mb-0">
                Sem empresa, o usuário entra no sistema e cria ou acessa uma empresa no primeiro login.
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowUserModal(false); resetUserForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              <FaSave className="me-2" />
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

export default AdminUsuarios;
