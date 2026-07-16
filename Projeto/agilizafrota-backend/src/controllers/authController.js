/**
 * Controller de autenticacao (RF01).
 *
 * Endpoints:
 *  - POST /api/auth/register  -> provisiona o perfil do usuario autenticado.
 *  - GET  /api/auth/me        -> retorna o perfil do usuario autenticado.
 *  - POST /api/auth/bootstrap -> cria o primeiro operador "central" (setup).
 */
const { query, pool } = require('../config/db');
const { env } = require('../config/env');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Cria o registro do usuario no banco, associando ao firebase_uid do token.
 * O email e o UID vem do token verificado (fonte confiavel), nunca do body.
 *
 * Nota de seguranca: para simplicidade do prototipo academico, o "papel" e
 * informado no registro. Em um ambiente endurecido, a atribuicao de papel
 * deveria ser feita/aprovada por um operador "central". Isso esta previsto
 * para evoluir junto ao cadastro de usuarios na Sprint 2.
 */
const register = asyncHandler(async (req, res) => {
  const { uid, email } = req.firebase;
  const { nome, papel, unidade_id, telefone } = req.body;

  if (!email) {
    throw new AppError(400, 'O token nao contem e-mail associado.', 'EMAIL_AUSENTE');
  }

  // Impede registro duplicado para o mesmo UID.
  const existente = await query('SELECT id FROM usuarios WHERE firebase_uid = $1', [uid]);
  if (existente.rows.length > 0) {
    throw new AppError(409, 'Perfil ja provisionado para este usuario.', 'PERFIL_JA_EXISTE');
  }

  // Recepcionista exige unidade valida e ativa.
  if (papel === 'recepcionista') {
    if (!unidade_id) {
      throw new AppError(400, 'Recepcionista requer unidade_id.', 'UNIDADE_OBRIGATORIA');
    }
    const unidade = await query('SELECT id FROM unidades WHERE id = $1 AND ativo = TRUE', [unidade_id]);
    if (unidade.rows.length === 0) {
      throw new AppError(404, 'Unidade nao encontrada ou inativa.', 'UNIDADE_INVALIDA');
    }
  }

  const { rows } = await query(
    `INSERT INTO usuarios (firebase_uid, nome, email, papel, unidade_id, telefone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, firebase_uid, nome, email, papel, unidade_id, telefone, ativo, criado_em`,
    [uid, nome, email, papel, papel === 'recepcionista' ? unidade_id : null, telefone || null],
  );

  res.status(201).json({ usuario: rows[0] });
});

/** Retorna o perfil ja carregado pelo middleware "autenticar". */
const me = asyncHandler(async (req, res) => {
  res.json({ usuario: req.usuario });
});

/**
 * Bootstrap do primeiro operador "central".
 * Requisitos:
 *  - Token Firebase valido (req.firebase).
 *  - BOOTSTRAP_SECRET configurado e igual ao "segredo" enviado.
 *  - Nenhum usuario "central" existente ainda (operacao unica).
 */
const bootstrap = asyncHandler(async (req, res) => {
  const { uid, email } = req.firebase;
  const { segredo, nome } = req.body;

  if (!env.bootstrapSecret) {
    throw new AppError(403, 'Bootstrap desabilitado (BOOTSTRAP_SECRET nao configurado).', 'BOOTSTRAP_DESABILITADO');
  }
  if (segredo !== env.bootstrapSecret) {
    throw new AppError(403, 'Segredo de bootstrap invalido.', 'BOOTSTRAP_SEGREDO_INVALIDO');
  }
  if (!email) {
    throw new AppError(400, 'O token nao contem e-mail associado.', 'EMAIL_AUSENTE');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jaCentral = await client.query("SELECT id FROM usuarios WHERE papel = 'central' LIMIT 1");
    if (jaCentral.rows.length > 0) {
      throw new AppError(409, 'Ja existe um operador central. Bootstrap indisponivel.', 'BOOTSTRAP_JA_REALIZADO');
    }

    const jaUid = await client.query('SELECT id FROM usuarios WHERE firebase_uid = $1', [uid]);
    if (jaUid.rows.length > 0) {
      throw new AppError(409, 'Perfil ja provisionado para este usuario.', 'PERFIL_JA_EXISTE');
    }

    const { rows } = await client.query(
      `INSERT INTO usuarios (firebase_uid, nome, email, papel)
       VALUES ($1, $2, $3, 'central')
       RETURNING id, firebase_uid, nome, email, papel, ativo, criado_em`,
      [uid, nome, email],
    );

    await client.query('COMMIT');
    res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { register, me, bootstrap };
