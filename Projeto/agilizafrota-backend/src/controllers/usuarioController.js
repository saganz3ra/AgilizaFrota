/**
 * Controller de gestao de usuarios (RF02) - operacoes administrativas da central.
 *
 * O cadastro cria a conta no Firebase Authentication (Admin SDK) e o registro
 * correspondente no banco. Isso centraliza a atribuicao de papel na central,
 * endurecendo o ponto de seguranca levantado na Sprint 1 (auto-registro).
 */
const { query } = require('../config/db');
const { criarUsuarioFirebase, removerUsuarioFirebase } = require('../config/firebase');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');

const COLUNAS = `id, firebase_uid, nome, email, papel, unidade_id, telefone,
                 ativo, criado_em, atualizado_em`;

async function exigirUnidadeAtiva(unidadeId) {
  const { rows } = await query('SELECT id FROM unidades WHERE id = $1 AND ativo = TRUE', [unidadeId]);
  if (rows.length === 0) {
    throw new AppError(404, 'Unidade nao encontrada ou inativa.', 'UNIDADE_INVALIDA');
  }
}

/**
 * Impede desativar ou rebaixar o ULTIMO operador "central" ativo, o que
 * deixaria o sistema sem ninguem capaz de administrar (lockout), ja que
 * todas as escritas administrativas sao exclusivas da central e o bootstrap
 * so funciona quando nao existe nenhum central.
 */
async function protegerUltimoCentral(id, papelFinal, ativoFinal) {
  const atual = await query('SELECT papel, ativo FROM usuarios WHERE id = $1', [id]);
  if (atual.rows.length === 0) return; // inexistente: 404 sera tratado adiante
  const eraCentralAtivo = atual.rows[0].papel === 'central' && atual.rows[0].ativo === true;
  const continuaCentralAtivo = papelFinal === 'central' && ativoFinal === true;
  if (!eraCentralAtivo || continuaCentralAtivo) return;

  const { rows } = await query(
    "SELECT COUNT(*)::int AS n FROM usuarios WHERE papel = 'central' AND ativo = TRUE AND id <> $1",
    [id],
  );
  if (rows[0].n === 0) {
    throw new AppError(
      409,
      'Nao e possivel desativar ou rebaixar o ultimo operador central ativo.',
      'ULTIMO_CENTRAL',
    );
  }
}

// GET /api/usuarios - filtros: papel, unidade_id, ativo.
const listar = asyncHandler(async (req, res) => {
  const filtros = [];
  const params = [];

  for (const [campo, valor] of [
    ['papel', req.query.papel],
    ['unidade_id', req.query.unidade_id],
  ]) {
    if (valor !== undefined) {
      params.push(valor);
      filtros.push(`${campo} = $${params.length}`);
    }
  }
  if (req.query.ativo !== undefined) {
    params.push(req.query.ativo === 'true');
    filtros.push(`ativo = $${params.length}`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ${COLUNAS} FROM usuarios ${where} ORDER BY nome ASC`,
    params,
  );
  res.json({ total: rows.length, usuarios: rows });
});

// GET /api/usuarios/:id
const obter = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${COLUNAS} FROM usuarios WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Usuario nao encontrado.', 'USUARIO_NAO_ENCONTRADO');
  }
  res.json({ usuario: rows[0] });
});

// POST /api/usuarios - cadastro administrativo (central).
const criar = asyncHandler(async (req, res) => {
  const { nome, email, senha, papel, telefone, unidade_id } = req.body;

  if (papel === 'recepcionista') {
    if (!unidade_id) {
      throw new AppError(400, 'Recepcionista requer unidade_id.', 'UNIDADE_OBRIGATORIA');
    }
    await exigirUnidadeAtiva(unidade_id);
  } else if (unidade_id) {
    await exigirUnidadeAtiva(unidade_id);
  }

  const dup = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (dup.rows.length > 0) {
    throw new AppError(409, 'Ja existe um usuario com este e-mail.', 'EMAIL_DUPLICADO');
  }

  let uid;
  try {
    uid = await criarUsuarioFirebase({ email, senha, nome });
  } catch (err) {
    if (err && err.code === 'auth/email-already-exists') {
      throw new AppError(409, 'E-mail ja cadastrado no provedor de autenticacao.', 'EMAIL_DUPLICADO');
    }
    throw err;
  }

  try {
    const { rows } = await query(
      `INSERT INTO usuarios (firebase_uid, nome, email, papel, unidade_id, telefone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUNAS}`,
      [uid, nome, email, papel, unidade_id || null, telefone || null],
    );
    res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    await removerUsuarioFirebase(uid);
    throw err;
  }
});

// PUT /api/usuarios/:id - atualizacao administrativa (central).
const atualizar = asyncHandler(async (req, res) => {
  const atual = await query('SELECT papel, unidade_id, ativo FROM usuarios WHERE id = $1', [req.params.id]);
  if (atual.rows.length === 0) {
    throw new AppError(404, 'Usuario nao encontrado.', 'USUARIO_NAO_ENCONTRADO');
  }

  const papelFinal = req.body.papel ?? atual.rows[0].papel;
  const unidadeFinal =
    req.body.unidade_id !== undefined ? req.body.unidade_id : atual.rows[0].unidade_id;
  const ativoFinal = req.body.ativo !== undefined ? req.body.ativo : atual.rows[0].ativo;

  if (papelFinal === 'recepcionista' && !unidadeFinal) {
    throw new AppError(400, 'Recepcionista requer unidade_id.', 'UNIDADE_OBRIGATORIA');
  }
  if (unidadeFinal) {
    await exigirUnidadeAtiva(unidadeFinal);
  }
  await protegerUltimoCentral(req.params.id, papelFinal, ativoFinal);

  const permitidos = ['nome', 'telefone', 'unidade_id', 'papel', 'ativo'];
  const campos = [];
  const params = [];
  for (const campo of permitidos) {
    if (req.body[campo] !== undefined) {
      params.push(req.body[campo]);
      campos.push(`${campo} = $${params.length}`);
    }
  }

  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${params.length} RETURNING ${COLUNAS}`,
    params,
  );
  res.json({ usuario: rows[0] });
});

// PATCH /api/usuarios/:id/ativar|desativar - soft-delete.
const definirAtivo = (ativo) =>
  asyncHandler(async (req, res) => {
    if (ativo === false) {
      await protegerUltimoCentral(req.params.id, undefined, false);
    }
    const { rows } = await query(
      `UPDATE usuarios SET ativo = $1 WHERE id = $2 RETURNING ${COLUNAS}`,
      [ativo, req.params.id],
    );
    if (rows.length === 0) {
      throw new AppError(404, 'Usuario nao encontrado.', 'USUARIO_NAO_ENCONTRADO');
    }
    res.json({ usuario: rows[0], mensagem: ativo ? 'Usuario ativado.' : 'Usuario desativado.' });
  });

module.exports = {
  listar,
  obter,
  criar,
  atualizar,
  ativar: definirAtivo(true),
  desativar: definirAtivo(false),
};
