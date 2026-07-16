/**
 * Controller de unidades hospitalares (RF02).
 * Todas as escritas sao restritas ao papel "central" (ver rotas).
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');

const COLUNAS = 'id, nome, endereco, cidade, lat, lng, ativo, criado_em, atualizado_em';

// GET /api/unidades - lista com filtros opcionais (ativo, cidade).
const listar = asyncHandler(async (req, res) => {
  const filtros = [];
  const params = [];

  if (req.query.ativo !== undefined) {
    params.push(req.query.ativo === 'true');
    filtros.push(`ativo = $${params.length}`);
  }
  if (req.query.cidade) {
    params.push(`%${req.query.cidade}%`);
    filtros.push(`cidade ILIKE $${params.length}`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ${COLUNAS} FROM unidades ${where} ORDER BY nome ASC`,
    params,
  );
  res.json({ total: rows.length, unidades: rows });
});

// GET /api/unidades/:id
const obter = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${COLUNAS} FROM unidades WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Unidade nao encontrada.', 'UNIDADE_NAO_ENCONTRADA');
  }
  res.json({ unidade: rows[0] });
});

// POST /api/unidades
const criar = asyncHandler(async (req, res) => {
  const { nome, endereco, cidade, lat, lng } = req.body;
  const insert = await query(
    `INSERT INTO unidades (nome, endereco, cidade, lat, lng)
     VALUES ($1, $2, COALESCE($3, 'Guarapuava'), $4, $5)
     RETURNING ${COLUNAS}`,
    [nome, endereco, cidade || null, lat ?? null, lng ?? null],
  );
  res.status(201).json({ unidade: insert.rows[0] });
});

// PUT /api/unidades/:id - atualizacao parcial dos campos enviados.
const atualizar = asyncHandler(async (req, res) => {
  const campos = [];
  const params = [];
  const permitidos = ['nome', 'endereco', 'cidade', 'lat', 'lng', 'ativo'];

  for (const campo of permitidos) {
    if (req.body[campo] !== undefined) {
      params.push(req.body[campo]);
      campos.push(`${campo} = $${params.length}`);
    }
  }

  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE unidades SET ${campos.join(', ')} WHERE id = $${params.length} RETURNING ${COLUNAS}`,
    params,
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Unidade nao encontrada.', 'UNIDADE_NAO_ENCONTRADA');
  }
  res.json({ unidade: rows[0] });
});

// DELETE /api/unidades/:id - soft-delete (desativa).
const desativar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE unidades SET ativo = FALSE WHERE id = $1 RETURNING ${COLUNAS}`,
    [req.params.id],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Unidade nao encontrada.', 'UNIDADE_NAO_ENCONTRADA');
  }
  res.json({ unidade: rows[0], mensagem: 'Unidade desativada.' });
});

module.exports = { listar, obter, criar, atualizar, desativar };
