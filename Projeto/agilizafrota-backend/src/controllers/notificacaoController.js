/**
 * Controller de notificacoes (RF15).
 * A recepcionista ve as notificacoes dela e as da sua unidade (quando a
 * unidade nao tem destinatario individual); a central ve todas.
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const eventos = require('../services/notificacoesEventos');
const { COLS } = require('../services/notificacoes');

/** Filtro de visibilidade conforme o papel. */
function escopo(req, params) {
  if (req.usuario.papel === 'central') return { clausula: '', params };
  params.push(req.usuario.id);
  const pUsuario = `$${params.length}`;
  if (req.usuario.unidade_id) {
    params.push(req.usuario.unidade_id);
    return {
      clausula: `(destinatario_id = ${pUsuario} OR (destinatario_id IS NULL AND unidade_id = $${params.length}))`,
      params,
    };
  }
  return { clausula: `destinatario_id = ${pUsuario}`, params };
}

// GET /api/notificacoes
const listar = asyncHandler(async (req, res) => {
  const filtros = [];
  let params = [];
  const esc = escopo(req, params);
  params = esc.params;
  if (esc.clausula) filtros.push(esc.clausula);

  if (req.query.lida !== undefined) {
    params.push(req.query.lida === 'true');
    filtros.push(`lida = $${params.length}`);
  }
  if (req.query.tipo) {
    params.push(req.query.tipo);
    filtros.push(`tipo = $${params.length}`);
  }
  params.push(req.query.limite || 100);

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ${COLS} FROM notificacoes ${where}
      ORDER BY criado_em DESC LIMIT $${params.length}`,
    params,
  );
  const naoLidas = rows.filter((n) => !n.lida).length;
  res.json({ total: rows.length, nao_lidas: naoLidas, notificacoes: rows });
});

// PATCH /api/notificacoes/:id/lida
const marcarLida = asyncHandler(async (req, res) => {
  const atual = await query('SELECT destinatario_id, unidade_id FROM notificacoes WHERE id = $1', [
    req.params.id,
  ]);
  if (atual.rows.length === 0) {
    throw new AppError(404, 'Notificacao nao encontrada.', 'NOTIFICACAO_NAO_ENCONTRADA');
  }
  const n = atual.rows[0];
  const minha =
    req.usuario.papel === 'central' ||
    n.destinatario_id === req.usuario.id ||
    (n.destinatario_id === null && n.unidade_id && n.unidade_id === req.usuario.unidade_id);
  if (!minha) {
    throw new AppError(403, 'Esta notificacao nao e sua.', 'ACESSO_NEGADO');
  }

  const { rows } = await query(
    `UPDATE notificacoes SET lida = TRUE, lida_em = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING ${COLS}`,
    [req.params.id],
  );
  res.json({ notificacao: rows[0] });
});

// PATCH /api/notificacoes/lidas - marca todas as visiveis como lidas
const marcarTodasLidas = asyncHandler(async (req, res) => {
  let params = [];
  const esc = escopo(req, params);
  params = esc.params;
  const where = esc.clausula ? `AND ${esc.clausula}` : '';
  const { rowCount } = await query(
    `UPDATE notificacoes SET lida = TRUE, lida_em = CURRENT_TIMESTAMP
      WHERE lida = FALSE ${where}`,
    params,
  );
  res.json({ atualizadas: rowCount, mensagem: 'Notificacoes marcadas como lidas.' });
});

// GET /api/notificacoes/stream - tempo real (SSE)
function stream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  res.write('event: conectado\ndata: {"ok":true}\n\n');
  eventos.adicionarCliente(res, req.usuario.id);

  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch (_err) {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventos.removerCliente(res);
  });
}

module.exports = { listar, marcarLida, marcarTodasLidas, stream };
