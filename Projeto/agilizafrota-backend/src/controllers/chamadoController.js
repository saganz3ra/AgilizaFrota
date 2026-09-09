/**
 * Controller de chamados e alertas (RF05/RF06).
 *
 * - Criacao pela central (usuario autenticado) ou por sistema externo
 *   (chave de API). A prioridade e derivada do tipo quando nao informada.
 * - Ao criar, publica um evento SSE "chamado:novo" para as centrais
 *   conectadas (RF06 / RNF05: multiplos assinantes).
 * - Idempotencia (offline/reenvio): "id" pode vir da origem.
 */
const { query, pool } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const eventos = require('../services/chamadosEventos');
const { cancelarAtivaNaTransacao } = require('../services/atribuicoes');

const { COLUNAS_CHAMADO: COLUNAS } = require('../constants/colunasChamado');

/** Prioridade padrao a partir do tipo, se nao informada explicitamente. */
function derivarPrioridade(tipo, prioridade) {
  if (prioridade) return prioridade;
  return tipo === 'emergencia' ? 'alta' : 'media';
}

async function exigirUnidadeAtiva(unidadeId) {
  const { rows } = await query('SELECT id FROM unidades WHERE id = $1 AND ativo = TRUE', [unidadeId]);
  if (rows.length === 0) {
    throw new AppError(404, 'Unidade de destino nao encontrada ou inativa.', 'UNIDADE_INVALIDA');
  }
}

/** Nucleo de criacao compartilhado entre central e sistema externo. */
async function criarNucleo(body, origemTipo, criadoPor, res) {
  const {
    id, tipo, prioridade, natureza, descricao,
    solicitante_nome, solicitante_telefone,
    origem_endereco, origem_lat, origem_lng,
    destino_unidade_id, destino_endereco, aberto_em,
  } = body;

  // Idempotencia: reenvio com o mesmo id retorna o chamado existente.
  if (id) {
    const existe = await query(`SELECT ${COLUNAS} FROM chamados WHERE id = $1`, [id]);
    if (existe.rows.length > 0) {
      return res.status(200).json({ chamado: existe.rows[0], idempotente: true });
    }
  }

  if (destino_unidade_id) {
    await exigirUnidadeAtiva(destino_unidade_id);
  }

  const { rows } = await query(
    `INSERT INTO chamados
       (id, tipo, prioridade, natureza, descricao, status, origem_tipo, criado_por,
        solicitante_nome, solicitante_telefone, origem_endereco, origem_lat, origem_lng,
        destino_unidade_id, destino_endereco, aberto_em)
     VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, 'aberto', $6, $7,
             $8, $9, $10, $11, $12, $13, $14,
             COALESCE($15::timestamptz, CURRENT_TIMESTAMP))
     RETURNING ${COLUNAS}`,
    [
      id || null,
      tipo,
      derivarPrioridade(tipo, prioridade),
      natureza,
      descricao || null,
      origemTipo,
      criadoPor,
      solicitante_nome || null,
      solicitante_telefone || null,
      origem_endereco || null,
      origem_lat ?? null,
      origem_lng ?? null,
      destino_unidade_id || null,
      destino_endereco || null,
      aberto_em || null,
    ],
  );

  const chamado = rows[0];
  // Alerta em tempo real para as centrais conectadas (RF06).
  eventos.publicar('chamado:novo', chamado);
  res.status(201).json({ chamado });
}

// POST /api/chamados - criacao pela central.
const criar = asyncHandler(async (req, res) => {
  await criarNucleo(req.body, 'central', req.usuario.id, res);
});

// POST /api/chamados/externo - criacao por sistema externo (chave de API).
const criarExterno = asyncHandler(async (req, res) => {
  await criarNucleo(req.body, 'sistema_externo', null, res);
});

// GET /api/chamados - lista com filtros.
const listar = asyncHandler(async (req, res) => {
  const filtros = [];
  const params = [];
  for (const [campo, valor] of [
    ['status', req.query.status],
    ['tipo', req.query.tipo],
    ['prioridade', req.query.prioridade],
    ['destino_unidade_id', req.query.destino_unidade_id],
  ]) {
    if (valor !== undefined) {
      params.push(valor);
      filtros.push(`${campo} = $${params.length}`);
    }
  }
  if (req.query.desde) {
    params.push(req.query.desde);
    filtros.push(`aberto_em >= $${params.length}`);
  }
  if (req.query.ate) {
    params.push(req.query.ate);
    filtros.push(`aberto_em <= $${params.length}`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  // Ordena por prioridade (critica primeiro) e recencia.
  const { rows } = await query(
    `SELECT ${COLUNAS} FROM chamados ${where}
      ORDER BY CASE prioridade
                 WHEN 'critica' THEN 0 WHEN 'alta' THEN 1
                 WHEN 'media' THEN 2 ELSE 3 END,
               aberto_em DESC`,
    params,
  );
  res.json({ total: rows.length, chamados: rows });
});

// GET /api/chamados/:id
const obter = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${COLUNAS} FROM chamados WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Chamado nao encontrado.', 'CHAMADO_NAO_ENCONTRADO');
  }
  res.json({ chamado: rows[0] });
});

// PATCH /api/chamados/:id/cancelar
const cancelar = asyncHandler(async (req, res) => {
  const atual = await query('SELECT status FROM chamados WHERE id = $1', [req.params.id]);
  if (atual.rows.length === 0) {
    throw new AppError(404, 'Chamado nao encontrado.', 'CHAMADO_NAO_ENCONTRADO');
  }
  const status = atual.rows[0].status;
  if (status === 'concluido' || status === 'cancelado') {
    throw new AppError(409, `Chamado ja esta ${status}.`, 'STATUS_INVALIDO');
  }
  // Cancelar o chamado tambem libera o veiculo eventualmente acionado (RF07).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const atribuicao = await cancelarAtivaNaTransacao(client, req.params.id, 'Chamado cancelado');
    const { rows } = await client.query(
      `UPDATE chamados SET status = 'cancelado' WHERE id = $1 RETURNING ${COLUNAS}`,
      [req.params.id],
    );
    await client.query('COMMIT');

    eventos.publicar('chamado:atualizado', rows[0]);
    res.json({
      chamado: rows[0],
      atribuicao_cancelada: atribuicao ? atribuicao.id : null,
      mensagem: atribuicao
        ? 'Chamado cancelado; veiculo liberado.'
        : 'Chamado cancelado.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/chamados/stream - alerta em tempo real (SSE) para a central.
function stream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  res.write('event: conectado\ndata: {"ok":true}\n\n');
  eventos.adicionarCliente(res);

  // Heartbeat para manter a conexao viva atraves de proxies.
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

module.exports = { criar, criarExterno, listar, obter, cancelar, stream, derivarPrioridade };
