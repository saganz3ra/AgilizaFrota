/**
 * Middleware de autenticacao (RF01).
 *
 * Fluxo:
 *  1. Le o token do cabecalho Authorization: Bearer <ID_TOKEN>.
 *  2. Pede ao Firebase Admin para verificar o token (autenticidade/validade).
 *  3. Cruza o firebase_uid com a tabela "usuarios" e anexa o perfil em
 *     req.usuario (id, nome, email, papel, unidade_id, ...).
 *
 * Variantes exportadas:
 *  - autenticar: exige token valido E perfil provisionado no banco.
 *  - autenticarSemPerfil: exige apenas token valido do Firebase (registro/bootstrap).
 *  - autenticarEventStream: como "autenticar", mas aceita o token tambem via
 *    query string (?token=...), pois o EventSource (SSE) do navegador nao
 *    permite definir cabecalhos.
 */
const { getFirebaseAdmin } = require('../config/firebase');
const { query } = require('../config/db');
const { AppError } = require('../utils/AppError');

function extrairToken(req, { permitirQuery = false } = {}) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    if (token) return token;
  }
  if (permitirQuery && req.query && req.query.token) {
    return String(req.query.token);
  }
  throw new AppError(401, 'Token nao fornecido ou formato invalido.', 'TOKEN_AUSENTE');
}

async function verificarTokenFirebase(token) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new AppError(
      503,
      'Servico de autenticacao indisponivel (chave do Firebase ausente).',
      'FIREBASE_INDISPONIVEL',
    );
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (_err) {
    throw new AppError(403, 'Token invalido ou expirado.', 'TOKEN_INVALIDO');
  }
}

async function carregarPerfil(uid) {
  const { rows } = await query(
    `SELECT id, firebase_uid, nome, email, papel, unidade_id, telefone, ativo
       FROM usuarios
      WHERE firebase_uid = $1`,
    [uid],
  );
  if (rows.length === 0) {
    throw new AppError(
      404,
      'Usuario autenticado, mas sem perfil no sistema. Conclua o registro.',
      'PERFIL_NAO_PROVISIONADO',
    );
  }
  const usuario = rows[0];
  if (!usuario.ativo) {
    throw new AppError(403, 'Usuario inativo.', 'USUARIO_INATIVO');
  }
  return usuario;
}

/** Exige token valido do Firebase (nao exige perfil no banco). */
async function autenticarSemPerfil(req, _res, next) {
  try {
    const token = extrairToken(req);
    req.firebase = await verificarTokenFirebase(token);
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige token valido E perfil ativo provisionado no banco. */
async function autenticar(req, _res, next) {
  try {
    const token = extrairToken(req);
    req.firebase = await verificarTokenFirebase(token);
    req.usuario = await carregarPerfil(req.firebase.uid);
    next();
  } catch (err) {
    next(err);
  }
}

/** Como "autenticar", mas aceita o token via query string (para SSE). */
async function autenticarEventStream(req, _res, next) {
  try {
    const token = extrairToken(req, { permitirQuery: true });
    req.firebase = await verificarTokenFirebase(token);
    req.usuario = await carregarPerfil(req.firebase.uid);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { autenticar, autenticarSemPerfil, autenticarEventStream };
