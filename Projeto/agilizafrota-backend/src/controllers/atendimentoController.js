/**
 * Controller de atendimentos (RF09), com metricas (RNF09) e validacao
 * manual pela central (RF10).
 *
 * Fluxo do motorista (cada passo registra horario + quilometragem):
 *   iniciar (a_caminho) -> chegada ao local (no_local)
 *   -> inicio do transporte (em_transporte) -> concluir (concluido)
 * O atendimento pode ser concluido direto de qualquer etapa (ex.: paciente
 * atendido no local, sem transporte) ou cancelado.
 *
 * Ao concluir: o chamado e encerrado, a atribuicao vira "concluida", o
 * veiculo volta a ficar disponivel e a quilometragem da frota e atualizada.
 */
const { query, pool } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const eventos = require('../services/chamadosEventos');
const { calcularMetricas, verificarConsistencia } = require('../services/metricasAtendimento');
const { COLUNAS_CHAMADO } = require('../constants/colunasChamado');

const COLS = `id, chamado_id, atribuicao_id, veiculo_id, motorista_id, turno_id, status,
              km_saida, km_local, km_final,
              inicio_em, chegada_local_em, inicio_transporte_em, fim_em,
              distancia_total_km, distancia_ate_local_km, distancia_transporte_km,
              tempo_resposta_min, tempo_no_local_min, tempo_transporte_min, tempo_total_min,
              validado, validado_por, validado_em, observacao_validacao,
              km_total_ajustado, tempo_total_ajustado_min,
              observacoes, motivo_cancelamento, criado_em, atualizado_em`;

const EM_ANDAMENTO = ['a_caminho', 'no_local', 'em_transporte'];

/** Busca o atendimento ou lanca 404. */
async function obterOuFalhar(id) {
  const { rows } = await query(`SELECT ${COLS} FROM atendimentos WHERE id = $1`, [id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Atendimento nao encontrado.', 'ATENDIMENTO_NAO_ENCONTRADO');
  }
  return rows[0];
}

/** Motorista so opera os proprios atendimentos; central opera todos. */
function exigirAcesso(req, atendimento) {
  if (req.usuario.papel === 'motorista' && atendimento.motorista_id !== req.usuario.id) {
    throw new AppError(403, 'Este atendimento pertence a outro motorista.', 'ACESSO_NEGADO');
  }
}

function exigirEmAndamento(atendimento, permitidos) {
  const lista = permitidos || EM_ANDAMENTO;
  if (!lista.includes(atendimento.status)) {
    throw new AppError(
      409,
      `Transicao invalida: o atendimento esta "${atendimento.status}".`,
      'TRANSICAO_INVALIDA',
    );
  }
}

/** Recalcula e persiste as metricas do atendimento (RNF09). */
async function recalcular(client, id) {
  const atual = await client.query(
    `SELECT km_saida, km_local, km_final, inicio_em, chegada_local_em,
            inicio_transporte_em, fim_em
       FROM atendimentos WHERE id = $1`,
    [id],
  );
  const m = calcularMetricas(atual.rows[0]);
  const { rows } = await client.query(
    `UPDATE atendimentos
        SET distancia_total_km = $2, distancia_ate_local_km = $3, distancia_transporte_km = $4,
            tempo_resposta_min = $5, tempo_no_local_min = $6, tempo_transporte_min = $7,
            tempo_total_min = $8
      WHERE id = $1
      RETURNING ${COLS}`,
    [
      id,
      m.distancia_total_km,
      m.distancia_ate_local_km,
      m.distancia_transporte_km,
      m.tempo_resposta_min,
      m.tempo_no_local_min,
      m.tempo_transporte_min,
      m.tempo_total_min,
    ],
  );
  return rows[0];
}

// POST /api/atendimentos - inicia o atendimento (motorista).
const iniciar = asyncHandler(async (req, res) => {
  const { id, chamado_id, km_saida, inicio_em } = req.body;

  // Idempotencia (reenvio apos operar offline).
  if (id) {
    const existe = await query(`SELECT ${COLS} FROM atendimentos WHERE id = $1`, [id]);
    if (existe.rows.length > 0) {
      return res.status(200).json({ atendimento: existe.rows[0], idempotente: true });
    }
  }

  const cham = await query('SELECT id, status FROM chamados WHERE id = $1', [chamado_id]);
  if (cham.rows.length === 0) {
    throw new AppError(404, 'Chamado nao encontrado.', 'CHAMADO_NAO_ENCONTRADO');
  }
  if (['concluido', 'cancelado'].includes(cham.rows[0].status)) {
    throw new AppError(409, `Chamado ja esta ${cham.rows[0].status}.`, 'STATUS_INVALIDO');
  }

  // O atendimento nasce de uma atribuicao ativa (RF07).
  const atr = await query(
    "SELECT id, veiculo_id, motorista_id, turno_id FROM atribuicoes WHERE chamado_id = $1 AND status = 'ativa'",
    [chamado_id],
  );
  if (atr.rows.length === 0) {
    throw new AppError(409, 'O chamado ainda nao tem veiculo acionado.', 'SEM_ATRIBUICAO');
  }
  const atribuicao = atr.rows[0];

  if (
    req.usuario.papel === 'motorista' &&
    atribuicao.motorista_id &&
    atribuicao.motorista_id !== req.usuario.id
  ) {
    throw new AppError(403, 'Este chamado foi acionado para outro motorista.', 'ACESSO_NEGADO');
  }
  const motoristaId = atribuicao.motorista_id || req.usuario.id;

  // Quilometragem nao pode retroceder (RNF09).
  const veic = await query('SELECT quilometragem_atual FROM veiculos WHERE id = $1', [atribuicao.veiculo_id]);
  if (km_saida < veic.rows[0].quilometragem_atual) {
    throw new AppError(
      422,
      `Quilometragem de saida (${km_saida}) menor que a ultima registrada (${veic.rows[0].quilometragem_atual}).`,
      'KM_INVALIDA',
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const novo = await client.query(
      `INSERT INTO atendimentos
         (id, chamado_id, atribuicao_id, veiculo_id, motorista_id, turno_id, km_saida, inicio_em)
       VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7,
               COALESCE($8::timestamptz, CURRENT_TIMESTAMP))
       RETURNING ${COLS}`,
      [
        id || null,
        chamado_id,
        atribuicao.id,
        atribuicao.veiculo_id,
        motoristaId,
        atribuicao.turno_id,
        km_saida,
        inicio_em || null,
      ],
    );
    const chamadoAtualizado = await client.query(
      `UPDATE chamados SET status = 'em_atendimento' WHERE id = $1 RETURNING ${COLUNAS_CHAMADO}`,
      [chamado_id],
    );
    await client.query(
      "UPDATE veiculos SET status = 'em_uso', quilometragem_atual = $1 WHERE id = $2",
      [km_saida, atribuicao.veiculo_id],
    );
    await client.query('COMMIT');

    eventos.publicar('chamado:atualizado', chamadoAtualizado.rows[0]);
    res.status(201).json({ atendimento: novo.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err && err.code === '23505') {
      throw new AppError(409, 'Ja existe um atendimento em andamento para este chamado ou veiculo.', 'ATENDIMENTO_DUPLICADO');
    }
    throw err;
  } finally {
    client.release();
  }
});

/** Fabrica de transicoes simples (chegada ao local / inicio do transporte). */
function transicao({ de, para, campoData, campoKm }) {
  return asyncHandler(async (req, res) => {
    const atendimento = await obterOuFalhar(req.params.id);
    exigirAcesso(req, atendimento);
    exigirEmAndamento(atendimento, de);

    const valorKm = campoKm ? req.body[campoKm] : undefined;
    if (campoKm !== undefined && valorKm !== undefined && valorKm < atendimento.km_saida) {
      throw new AppError(
        422,
        `Quilometragem (${valorKm}) menor que a de saida (${atendimento.km_saida}).`,
        'KM_INVALIDA',
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sets = [`status = '${para}'`, `${campoData} = COALESCE($2::timestamptz, CURRENT_TIMESTAMP)`];
      const params = [req.params.id, req.body.em || null];
      if (campoKm && valorKm !== undefined) {
        params.push(valorKm);
        sets.push(`${campoKm} = $${params.length}`);
      }
      await client.query(`UPDATE atendimentos SET ${sets.join(', ')} WHERE id = $1`, params);

      if (campoKm && valorKm !== undefined) {
        await client.query('UPDATE veiculos SET quilometragem_atual = $1 WHERE id = $2', [
          valorKm,
          atendimento.veiculo_id,
        ]);
      }
      const atualizado = await recalcular(client, req.params.id);
      await client.query('COMMIT');
      res.json({ atendimento: atualizado });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}

const chegadaLocal = transicao({
  de: ['a_caminho'],
  para: 'no_local',
  campoData: 'chegada_local_em',
  campoKm: 'km_local',
});

const iniciarTransporte = transicao({
  de: ['no_local'],
  para: 'em_transporte',
  campoData: 'inicio_transporte_em',
});

// PATCH /api/atendimentos/:id/concluir
const concluir = asyncHandler(async (req, res) => {
  const { km_final, em, observacoes } = req.body;
  const atendimento = await obterOuFalhar(req.params.id);
  exigirAcesso(req, atendimento);
  exigirEmAndamento(atendimento);

  const referencia = atendimento.km_local ?? atendimento.km_saida;
  if (km_final < referencia) {
    throw new AppError(
      422,
      `Quilometragem final (${km_final}) menor que a do marco anterior (${referencia}).`,
      'KM_INVALIDA',
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE atendimentos
          SET status = 'concluido',
              km_final = $2,
              fim_em = COALESCE($3::timestamptz, CURRENT_TIMESTAMP),
              observacoes = COALESCE($4, observacoes)
        WHERE id = $1`,
      [req.params.id, km_final, em || null, observacoes || null],
    );
    const atualizado = await recalcular(client, req.params.id);

    const chamadoAtualizado = await client.query(
      `UPDATE chamados SET status = 'concluido' WHERE id = $1 RETURNING ${COLUNAS_CHAMADO}`,
      [atendimento.chamado_id],
    );
    await client.query(
      `UPDATE atribuicoes SET status = 'concluida', encerrado_em = CURRENT_TIMESTAMP
        WHERE chamado_id = $1 AND status = 'ativa'`,
      [atendimento.chamado_id],
    );
    await client.query(
      "UPDATE veiculos SET status = 'disponivel', quilometragem_atual = $1 WHERE id = $2",
      [km_final, atendimento.veiculo_id],
    );
    await client.query('COMMIT');

    eventos.publicar('chamado:atualizado', chamadoAtualizado.rows[0]);
    res.json({ atendimento: atualizado, conferencia: verificarConsistencia(atualizado) });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /api/atendimentos/:id/cancelar
const cancelar = asyncHandler(async (req, res) => {
  const atendimento = await obterOuFalhar(req.params.id);
  exigirAcesso(req, atendimento);
  exigirEmAndamento(atendimento);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE atendimentos
          SET status = 'cancelado', motivo_cancelamento = $2, fim_em = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING ${COLS}`,
      [req.params.id, req.body?.motivo || 'Cancelado'],
    );
    // O chamado volta para "atribuido": o veiculo segue acionado.
    const chamadoAtualizado = await client.query(
      `UPDATE chamados SET status = 'atribuido' WHERE id = $1 RETURNING ${COLUNAS_CHAMADO}`,
      [atendimento.chamado_id],
    );
    await client.query('COMMIT');

    eventos.publicar('chamado:atualizado', chamadoAtualizado.rows[0]);
    res.json({ atendimento: rows[0], mensagem: 'Atendimento cancelado.' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// POST /api/atendimentos/:id/validar - RF10 (somente central)
const validar = asyncHandler(async (req, res) => {
  const { aprovado, km_total_ajustado, tempo_total_ajustado_min, observacao } = req.body;
  const atendimento = await obterOuFalhar(req.params.id);

  if (atendimento.status !== 'concluido') {
    throw new AppError(
      409,
      'Somente atendimentos concluidos podem ser validados.',
      'TRANSICAO_INVALIDA',
    );
  }

  const { rows } = await query(
    `UPDATE atendimentos
        SET validado = $2,
            validado_por = $3,
            validado_em = CURRENT_TIMESTAMP,
            observacao_validacao = $4,
            km_total_ajustado = $5,
            tempo_total_ajustado_min = $6
      WHERE id = $1
      RETURNING ${COLS}`,
    [
      req.params.id,
      aprovado,
      req.usuario.id,
      observacao || null,
      km_total_ajustado ?? null,
      tempo_total_ajustado_min ?? null,
    ],
  );
  res.json({
    atendimento: rows[0],
    mensagem: aprovado ? 'Atendimento validado.' : 'Atendimento marcado como nao validado.',
  });
});

// GET /api/atendimentos
const listar = asyncHandler(async (req, res) => {
  const filtros = [];
  const params = [];

  const forcarMotorista = req.usuario.papel === 'motorista';
  const motoristaId = forcarMotorista ? req.usuario.id : req.query.motorista_id;
  if (motoristaId) {
    params.push(motoristaId);
    filtros.push(`motorista_id = $${params.length}`);
  }
  for (const [campo, valor] of [
    ['status', req.query.status],
    ['chamado_id', req.query.chamado_id],
    ['veiculo_id', req.query.veiculo_id],
  ]) {
    if (valor !== undefined) {
      params.push(valor);
      filtros.push(`${campo} = $${params.length}`);
    }
  }
  if (req.query.validado !== undefined) {
    params.push(req.query.validado === 'true');
    filtros.push(`validado = $${params.length}`);
  }
  if (req.query.desde) {
    params.push(req.query.desde);
    filtros.push(`inicio_em >= $${params.length}`);
  }
  if (req.query.ate) {
    params.push(req.query.ate);
    filtros.push(`inicio_em <= $${params.length}`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ${COLS} FROM atendimentos ${where} ORDER BY inicio_em DESC`,
    params,
  );
  res.json({ total: rows.length, atendimentos: rows });
});

// GET /api/atendimentos/:id - inclui a conferencia dos calculos (apoio ao RF10)
const obter = asyncHandler(async (req, res) => {
  const atendimento = await obterOuFalhar(req.params.id);
  exigirAcesso(req, atendimento);
  res.json({
    atendimento,
    // Recalculo em tempo real: permite ao operador comparar o valor
    // armazenado com o valor recalculado antes de validar (RF10/RNF09).
    metricas_recalculadas: calcularMetricas(atendimento),
    conferencia: verificarConsistencia(atendimento),
  });
});

module.exports = {
  iniciar,
  chegadaLocal,
  iniciarTransporte,
  concluir,
  cancelar,
  validar,
  listar,
  obter,
};
