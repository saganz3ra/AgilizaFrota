/**
 * Consulta dos logs de auditoria (RF14). Somente central.
 * O log e append-only: nao ha endpoint de edicao nem de exclusao, de
 * proposito - alterar o rastro derrotaria o objetivo da auditoria.
 */
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');

const COLS = `id, usuario_id, usuario_email, papel, acao, entidade, entidade_id,
              metodo, rota, status_http, sucesso, dados_antes, dados_depois,
              ip, user_agent, duracao_ms, criado_em`;

// GET /api/auditoria
const listar = asyncHandler(async (req, res) => {
  const filtros = [];
  const params = [];
  for (const [campo, valor] of [
    ['usuario_id', req.query.usuario_id],
    ['entidade', req.query.entidade],
    ['entidade_id', req.query.entidade_id],
    ['acao', req.query.acao],
  ]) {
    if (valor !== undefined) {
      params.push(valor);
      filtros.push(`${campo} = $${params.length}`);
    }
  }
  if (req.query.sucesso !== undefined) {
    params.push(req.query.sucesso === 'true');
    filtros.push(`sucesso = $${params.length}`);
  }
  if (req.query.desde) {
    params.push(req.query.desde);
    filtros.push(`criado_em >= $${params.length}`);
  }
  if (req.query.ate) {
    params.push(req.query.ate);
    filtros.push(`criado_em <= $${params.length}`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  params.push(Number(req.query.limite || 100));
  params.push(Number(req.query.offset || 0));

  const { rows } = await query(
    `SELECT ${COLS} FROM auditoria ${where}
      ORDER BY criado_em DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ total: rows.length, registros: rows });
});

// GET /api/auditoria/resumo - visao rapida para a fiscalizacao.
const resumo = asyncHandler(async (req, res) => {
  const params = [];
  const filtros = [];
  if (req.query.desde) {
    params.push(req.query.desde);
    filtros.push(`criado_em >= $${params.length}`);
  }
  if (req.query.ate) {
    params.push(req.query.ate);
    filtros.push(`criado_em <= $${params.length}`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const totais = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE sucesso)::int AS sucesso,
            COUNT(*) FILTER (WHERE NOT sucesso)::int AS negadas,
            COUNT(DISTINCT usuario_id)::int AS usuarios
       FROM auditoria ${where}`,
    params,
  );
  const porAcao = await query(
    `SELECT acao, COUNT(*)::int AS total FROM auditoria ${where}
      GROUP BY acao ORDER BY total DESC LIMIT 15`,
    params,
  );
  const porUsuario = await query(
    `SELECT usuario_email, papel, COUNT(*)::int AS total FROM auditoria ${where}
      GROUP BY usuario_email, papel ORDER BY total DESC LIMIT 15`,
    params,
  );

  res.json({
    periodo: { desde: req.query.desde || null, ate: req.query.ate || null },
    totais: totais.rows[0],
    acoes_mais_frequentes: porAcao.rows,
    usuarios_mais_ativos: porUsuario.rows,
  });
});

// GET /api/auditoria/entidades/:entidade/:id - trilha de um registro.
const porEntidade = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLS} FROM auditoria
      WHERE entidade = $1 AND entidade_id = $2
      ORDER BY criado_em ASC`,
    [req.params.entidade, req.params.id],
  );
  res.json({ entidade: req.params.entidade, entidade_id: req.params.id, total: rows.length, trilha: rows });
});

module.exports = { listar, resumo, porEntidade };
