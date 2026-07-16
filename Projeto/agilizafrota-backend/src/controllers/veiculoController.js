/**
 * Controller de veiculos (RF02).
 * Leitura: qualquer autenticado. Escrita: apenas "central" (ver rotas).
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');

const COLUNAS = `id, placa, modelo, marca, ano, quilometragem_atual, status,
                 unidade_id, ultima_revisao, ativo, criado_em, atualizado_em`;

async function validarUnidade(unidadeId) {
  if (!unidadeId) return;
  const { rows } = await query('SELECT id FROM unidades WHERE id = $1 AND ativo = TRUE', [unidadeId]);
  if (rows.length === 0) {
    throw new AppError(404, 'Unidade nao encontrada ou inativa.', 'UNIDADE_INVALIDA');
  }
}

// GET /api/veiculos - filtros: status, unidade_id, ativo.
const listar = asyncHandler(async (req, res) => {
  const filtros = [];
  const params = [];

  for (const [campo, valor] of [
    ['status', req.query.status],
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
    `SELECT ${COLUNAS} FROM veiculos ${where} ORDER BY placa ASC`,
    params,
  );
  res.json({ total: rows.length, veiculos: rows });
});

// GET /api/veiculos/:id
const obter = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${COLUNAS} FROM veiculos WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Veiculo nao encontrado.', 'VEICULO_NAO_ENCONTRADO');
  }
  res.json({ veiculo: rows[0] });
});

// POST /api/veiculos
const criar = asyncHandler(async (req, res) => {
  const { placa, modelo, marca, ano, quilometragem_atual, status, unidade_id, ultima_revisao } = req.body;

  await validarUnidade(unidade_id);

  const existente = await query('SELECT id FROM veiculos WHERE placa = $1', [placa]);
  if (existente.rows.length > 0) {
    throw new AppError(409, 'Ja existe um veiculo com esta placa.', 'PLACA_DUPLICADA');
  }

  const { rows } = await query(
    `INSERT INTO veiculos
       (placa, modelo, marca, ano, quilometragem_atual, status, unidade_id, ultima_revisao)
     VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, 'disponivel'), $7, $8)
     RETURNING ${COLUNAS}`,
    [
      placa,
      modelo,
      marca || null,
      ano ?? null,
      quilometragem_atual ?? null,
      status || null,
      unidade_id || null,
      ultima_revisao || null,
    ],
  );
  res.status(201).json({ veiculo: rows[0] });
});

// PUT /api/veiculos/:id - atualizacao parcial.
const atualizar = asyncHandler(async (req, res) => {
  if (req.body.unidade_id) {
    await validarUnidade(req.body.unidade_id);
  }
  if (req.body.placa) {
    const dup = await query('SELECT id FROM veiculos WHERE placa = $1 AND id <> $2', [
      req.body.placa,
      req.params.id,
    ]);
    if (dup.rows.length > 0) {
      throw new AppError(409, 'Ja existe um veiculo com esta placa.', 'PLACA_DUPLICADA');
    }
  }

  const permitidos = [
    'placa', 'modelo', 'marca', 'ano', 'quilometragem_atual',
    'status', 'unidade_id', 'ultima_revisao', 'ativo',
  ];
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
    `UPDATE veiculos SET ${campos.join(', ')} WHERE id = $${params.length} RETURNING ${COLUNAS}`,
    params,
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Veiculo nao encontrado.', 'VEICULO_NAO_ENCONTRADO');
  }
  res.json({ veiculo: rows[0] });
});

// PATCH /api/veiculos/:id/status - alteracao rapida do status operacional.
const alterarStatus = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE veiculos SET status = $1 WHERE id = $2 RETURNING ${COLUNAS}`,
    [req.body.status, req.params.id],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Veiculo nao encontrado.', 'VEICULO_NAO_ENCONTRADO');
  }
  res.json({ veiculo: rows[0] });
});

// DELETE /api/veiculos/:id - soft-delete (desativa).
const desativar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE veiculos SET ativo = FALSE WHERE id = $1 RETURNING ${COLUNAS}`,
    [req.params.id],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Veiculo nao encontrado.', 'VEICULO_NAO_ENCONTRADO');
  }
  res.json({ veiculo: rows[0], mensagem: 'Veiculo desativado.' });
});

module.exports = { listar, obter, criar, atualizar, alterarStatus, desativar };
