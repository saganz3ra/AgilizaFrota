/**
 * Controller de atribuicao de chamados (RF07) e sugestao (RF08).
 *
 * Fluxo da central:
 *   1. GET  /chamados/:id/sugestoes  -> lista veiculos sugeridos com motivos.
 *   2. POST /chamados/:id/atribuir   -> aciona um veiculo (manual ou seguindo
 *      a sugestao). Reatribuir cancela a atribuicao anterior e libera o
 *      veiculo antigo, tudo na mesma transacao.
 *   3. POST /chamados/:id/atribuicao/cancelar -> libera o veiculo e devolve o
 *      chamado para "aberto".
 *
 * Concorrencia (RNF05): as invariantes (1 atribuicao ativa por chamado e por
 * veiculo) sao garantidas por indices unicos parciais no banco; a violacao
 * vira 409 amigavel em vez de 500.
 */
const { query, pool } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const eventos = require('../services/chamadosEventos');
const { sugerirParaChamado } = require('../services/sugestaoVeiculo');
const mapas = require('../services/mapas');
const {
  COLS,
  buscarAtiva,
  cancelarAtivaNaTransacao,
  traduzirConflitoAtribuicao,
} = require('../services/atribuicoes');

const COLS_CHAMADO = `id, tipo, prioridade, natureza, descricao, status, origem_tipo,
                      criado_por, solicitante_nome, solicitante_telefone,
                      origem_endereco, origem_lat, origem_lng,
                      destino_unidade_id, destino_endereco, aberto_em,
                      criado_em, atualizado_em`;

const STATUS_ENCERRADOS = ['concluido', 'cancelado'];

async function exigirChamadoAtivo(chamadoId) {
  const { rows } = await query(`SELECT ${COLS_CHAMADO} FROM chamados WHERE id = $1`, [chamadoId]);
  if (rows.length === 0) {
    throw new AppError(404, 'Chamado nao encontrado.', 'CHAMADO_NAO_ENCONTRADO');
  }
  const chamado = rows[0];
  if (STATUS_ENCERRADOS.includes(chamado.status)) {
    throw new AppError(409, `Chamado ja esta ${chamado.status}.`, 'STATUS_INVALIDO');
  }
  return chamado;
}

// GET /api/chamados/:id/sugestoes - RF08
const sugestoes = asyncHandler(async (req, res) => {
  const chamado = await exigirChamadoAtivo(req.params.id);
  const limite = req.query.limite ? Number(req.query.limite) : 5;
  const lista = await sugerirParaChamado(chamado, limite);
  res.json({
    chamado_id: chamado.id,
    total: lista.length,
    sugestoes: lista,
    observacao:
      lista.length === 0
        ? 'Nenhum veiculo disponivel no momento (todos em uso, em manutencao ou ja acionados).'
        : undefined,
  });
});

// GET /api/chamados/:id/atribuicoes - historico
const historico = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLS} FROM atribuicoes WHERE chamado_id = $1 ORDER BY atribuido_em DESC`,
    [req.params.id],
  );
  res.json({ total: rows.length, atribuicoes: rows });
});

// POST /api/chamados/:id/atribuir - RF07
const atribuir = asyncHandler(async (req, res) => {
  const { veiculo_id, motorista_id, origem } = req.body;
  const chamado = await exigirChamadoAtivo(req.params.id);

  // Veiculo precisa existir e estar apto.
  const veic = await query('SELECT id, status, ativo, placa FROM veiculos WHERE id = $1', [veiculo_id]);
  if (veic.rows.length === 0) {
    throw new AppError(404, 'Veiculo nao encontrado.', 'VEICULO_NAO_ENCONTRADO');
  }
  const veiculo = veic.rows[0];
  if (!veiculo.ativo) {
    throw new AppError(409, 'Veiculo inativo.', 'VEICULO_INATIVO');
  }
  if (veiculo.status === 'manutencao') {
    throw new AppError(409, 'Veiculo em manutencao.', 'VEICULO_INDISPONIVEL');
  }

  // Ja atribuido a outro chamado?
  const ocupado = await query(
    "SELECT chamado_id FROM atribuicoes WHERE veiculo_id = $1 AND status = 'ativa'",
    [veiculo_id],
  );
  if (ocupado.rows.length > 0 && ocupado.rows[0].chamado_id !== chamado.id) {
    throw new AppError(409, 'Veiculo ja acionado para outro chamado.', 'VEICULO_JA_ATRIBUIDO');
  }

  // Turno aberto do veiculo (define o motorista quando nao informado).
  const turno = await query(
    "SELECT id, motorista_id FROM turnos WHERE veiculo_id = $1 AND status = 'aberto'",
    [veiculo_id],
  );
  const turnoAberto = turno.rows[0] || null;

  let motoristaFinal = motorista_id || (turnoAberto ? turnoAberto.motorista_id : null);
  if (motorista_id) {
    const mot = await query(
      "SELECT id FROM usuarios WHERE id = $1 AND papel = 'motorista' AND ativo = TRUE",
      [motorista_id],
    );
    if (mot.rows.length === 0) {
      throw new AppError(404, 'Motorista nao encontrado ou inativo.', 'MOTORISTA_INVALIDO');
    }
  }

  // ETA do acionamento (RF16). Calculado ANTES da transacao para nao segurar
  // a conexao durante uma eventual chamada de rede ao provedor de mapas.
  let eta = null;
  const posVeic = await query(
    `SELECT p.lat, p.lng FROM posicoes p
      WHERE p.veiculo_id = $1 AND p.descartada = FALSE
      ORDER BY p.registrado_em DESC LIMIT 1`,
    [veiculo_id],
  );
  const origemVeiculo = posVeic.rows[0] || null;
  if (origemVeiculo && chamado.origem_lat != null && chamado.origem_lng != null) {
    eta = await mapas.obterRota(
      { lat: origemVeiculo.lat, lng: origemVeiculo.lng },
      { lat: chamado.origem_lat, lng: chamado.origem_lng },
      { prioridade: chamado.prioridade },
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Reatribuicao: cancela a anterior e libera o veiculo antigo.
    await cancelarAtivaNaTransacao(client, chamado.id, 'Reatribuicao');

    const nova = await client.query(
      `INSERT INTO atribuicoes
         (chamado_id, veiculo_id, motorista_id, turno_id, atribuido_por, origem,
          eta_minutos, distancia_estimada_km, eta_fonte)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'manual'), $7, $8, $9)
       RETURNING ${COLS}, eta_minutos, distancia_estimada_km, eta_fonte`,
      [
        chamado.id,
        veiculo_id,
        motoristaFinal,
        turnoAberto ? turnoAberto.id : null,
        req.usuario.id,
        origem || null,
        eta ? eta.duracao_min : null,
        eta ? eta.distancia_km : null,
        eta ? eta.fonte : null,
      ],
    );

    const chamadoAtualizado = await client.query(
      `UPDATE chamados SET status = 'atribuido' WHERE id = $1 RETURNING ${COLS_CHAMADO}`,
      [chamado.id],
    );
    await client.query("UPDATE veiculos SET status = 'em_uso' WHERE id = $1", [veiculo_id]);

    await client.query('COMMIT');

    eventos.publicar('chamado:atualizado', chamadoAtualizado.rows[0]);
    res.status(201).json({
      atribuicao: nova.rows[0],
      chamado: chamadoAtualizado.rows[0],
      eta,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const conflito = traduzirConflitoAtribuicao(err);
    if (conflito) throw conflito;
    throw err;
  } finally {
    client.release();
  }
});

// POST /api/chamados/:id/atribuicao/cancelar
const cancelarAtribuicao = asyncHandler(async (req, res) => {
  const chamado = await exigirChamadoAtivo(req.params.id);
  const ativa = await buscarAtiva(chamado.id);
  if (!ativa) {
    throw new AppError(404, 'Este chamado nao possui atribuicao ativa.', 'SEM_ATRIBUICAO');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cancelada = await cancelarAtivaNaTransacao(
      client,
      chamado.id,
      req.body?.motivo || 'Cancelada pela central',
    );
    const chamadoAtualizado = await client.query(
      `UPDATE chamados SET status = 'aberto' WHERE id = $1 RETURNING ${COLS_CHAMADO}`,
      [chamado.id],
    );
    await client.query('COMMIT');

    eventos.publicar('chamado:atualizado', chamadoAtualizado.rows[0]);
    res.json({
      atribuicao: cancelada,
      chamado: chamadoAtualizado.rows[0],
      mensagem: 'Atribuicao cancelada; veiculo liberado.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { sugestoes, historico, atribuir, cancelarAtribuicao };
