/**
 * Controller de turnos e checklist (RF03/RF04).
 *
 * Fluxo do motorista:
 *   1. Executa o checklist e inicia o turno (foto + km) num unico passo atomico.
 *      Se um item CRITICO estiver nao-conforme, o turno NAO abre e o veiculo
 *      vai para "manutencao".
 *   2. Ao final, encerra o turno (foto + km final); o veiculo volta a
 *      "disponivel" e a quilometragem e atualizada.
 *
 * Offline/idempotencia (RNF03): "id" pode ser gerado no cliente; reenvios
 * do mesmo turno retornam o registro existente em vez de duplicar. Os
 * horarios de evento (inicio_em/fim_em/realizado_em) vem do cliente.
 */
const { query, pool } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { ITENS_CHECKLIST, avaliarChecklist } = require('../constants/checklistItens');

const COLS_TURNO = `id, motorista_id, veiculo_id, status, km_inicial, km_final,
                    foto_inicio_url, foto_fim_url, inicio_em, fim_em,
                    criado_em, atualizado_em`;

/**
 * Traduz uma violacao de indice unico (Postgres 23505) ao iniciar turno em
 * um erro 409 amigavel. Cobre a corrida (RNF05) em que dois "iniciar"
 * simultaneos passam pela pre-checagem e o indice unico parcial barra o
 * segundo. Retorna null se o erro nao for um conflito de unicidade.
 */
function traduzirConflitoTurno(err) {
  if (!err || err.code !== '23505') return null;
  const alvo = `${err.constraint || ''} ${err.detail || ''} ${err.message || ''}`;
  if (/motorista/i.test(alvo)) {
    return new AppError(409, 'Voce ja possui um turno aberto.', 'MOTORISTA_TURNO_ABERTO');
  }
  if (/veiculo/i.test(alvo)) {
    return new AppError(409, 'Veiculo indisponivel (ja em turno).', 'VEICULO_INDISPONIVEL');
  }
  return new AppError(409, 'Conflito de concorrencia ao iniciar turno.', 'CONFLITO');
}

// GET /api/turnos/checklist/itens - catalogo de itens (para o app renderizar).
const itensChecklist = asyncHandler(async (_req, res) => {
  res.json({ itens: ITENS_CHECKLIST });
});

// POST /api/turnos/iniciar - executa checklist e abre o turno (motorista).
const iniciar = asyncHandler(async (req, res) => {
  const motoristaId = req.usuario.id;
  const { id, veiculo_id, km_inicial, foto_inicio_url, inicio_em, checklist } = req.body;

  // Idempotencia: se o turno (id do cliente) ja existe, retorna-o.
  if (id) {
    const existe = await query(`SELECT ${COLS_TURNO} FROM turnos WHERE id = $1`, [id]);
    if (existe.rows.length > 0) {
      return res.status(200).json({ turno: existe.rows[0], idempotente: true });
    }
  }

  // Motorista nao pode ter dois turnos abertos.
  const abertoMot = await query(
    "SELECT id FROM turnos WHERE motorista_id = $1 AND status = 'aberto'",
    [motoristaId],
  );
  if (abertoMot.rows.length > 0) {
    throw new AppError(409, 'Voce ja possui um turno aberto.', 'MOTORISTA_TURNO_ABERTO');
  }

  // Veiculo precisa existir, estar ativo e disponivel.
  const veic = await query(
    'SELECT id, status, ativo, quilometragem_atual FROM veiculos WHERE id = $1',
    [veiculo_id],
  );
  if (veic.rows.length === 0) {
    throw new AppError(404, 'Veiculo nao encontrado.', 'VEICULO_NAO_ENCONTRADO');
  }
  const veiculo = veic.rows[0];
  if (!veiculo.ativo) {
    throw new AppError(409, 'Veiculo inativo.', 'VEICULO_INATIVO');
  }
  if (veiculo.status !== 'disponivel') {
    throw new AppError(409, 'Veiculo indisponivel (em uso ou manutencao).', 'VEICULO_INDISPONIVEL');
  }
  if (km_inicial < veiculo.quilometragem_atual) {
    throw new AppError(
      422,
      `Quilometragem inicial (${km_inicial}) menor que a ultima registrada (${veiculo.quilometragem_atual}).`,
      'KM_INICIAL_INVALIDA',
    );
  }

  // Avalia o checklist.
  const { aprovado, faltantes, reprovadosCriticos } = avaliarChecklist(checklist.respostas);
  if (faltantes.length > 0) {
    const err = new AppError(422, 'Checklist incompleto: responda todos os itens.', 'CHECKLIST_INCOMPLETO');
    err.detalhes = { faltantes };
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const chk = await client.query(
      `INSERT INTO checklists (id, motorista_id, veiculo_id, respostas, aprovado, realizado_em)
       VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4::jsonb, $5,
               COALESCE($6::timestamptz, CURRENT_TIMESTAMP))
       RETURNING id, aprovado, respostas, realizado_em`,
      [
        checklist.id || null,
        motoristaId,
        veiculo_id,
        JSON.stringify(checklist.respostas),
        aprovado,
        checklist.realizado_em || null,
      ],
    );

    // Reprovado por item critico: nao abre turno; veiculo vai para manutencao.
    if (!aprovado) {
      await client.query("UPDATE veiculos SET status = 'manutencao' WHERE id = $1", [veiculo_id]);
      await client.query('COMMIT');
      return res.status(422).json({
        aprovado: false,
        codigo: 'CHECKLIST_REPROVADO',
        mensagem: 'Checklist reprovado em item(ns) critico(s). Turno nao iniciado; veiculo enviado para manutencao.',
        itens_reprovados: reprovadosCriticos,
        checklist: chk.rows[0],
      });
    }

    const turno = await client.query(
      `INSERT INTO turnos (id, motorista_id, veiculo_id, km_inicial, foto_inicio_url, inicio_em)
       VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5,
               COALESCE($6::timestamptz, CURRENT_TIMESTAMP))
       RETURNING ${COLS_TURNO}`,
      [id || null, motoristaId, veiculo_id, km_inicial, foto_inicio_url, inicio_em || null],
    );

    await client.query('UPDATE checklists SET turno_id = $1 WHERE id = $2', [
      turno.rows[0].id,
      chk.rows[0].id,
    ]);
    await client.query(
      "UPDATE veiculos SET status = 'em_uso', quilometragem_atual = $1 WHERE id = $2",
      [km_inicial, veiculo_id],
    );

    await client.query('COMMIT');
    res.status(201).json({ turno: turno.rows[0], checklist_id: chk.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    const conflito = traduzirConflitoTurno(err);
    if (conflito) throw conflito;
    throw err;
  } finally {
    client.release();
  }
});

// POST /api/turnos/:id/encerrar - encerra o turno (motorista dono ou central).
const encerrar = asyncHandler(async (req, res) => {
  const { km_final, foto_fim_url, fim_em } = req.body;
  const turnoId = req.params.id;

  const t = await query(`SELECT ${COLS_TURNO} FROM turnos WHERE id = $1`, [turnoId]);
  if (t.rows.length === 0) {
    throw new AppError(404, 'Turno nao encontrado.', 'TURNO_NAO_ENCONTRADO');
  }
  const turno = t.rows[0];

  if (req.usuario.papel === 'motorista' && turno.motorista_id !== req.usuario.id) {
    throw new AppError(403, 'Voce so pode encerrar os seus proprios turnos.', 'ACESSO_NEGADO');
  }

  // Idempotencia: turno ja encerrado retorna o estado atual.
  if (turno.status === 'encerrado') {
    return res.status(200).json({ turno, idempotente: true });
  }

  if (km_final < turno.km_inicial) {
    throw new AppError(
      422,
      `Quilometragem final (${km_final}) menor que a inicial (${turno.km_inicial}).`,
      'KM_FINAL_INVALIDA',
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE turnos
          SET status = 'encerrado', km_final = $1, foto_fim_url = $2,
              fim_em = COALESCE($3::timestamptz, CURRENT_TIMESTAMP)
        WHERE id = $4
        RETURNING ${COLS_TURNO}`,
      [km_final, foto_fim_url, fim_em || null, turnoId],
    );
    await client.query(
      "UPDATE veiculos SET status = 'disponivel', quilometragem_atual = $1 WHERE id = $2",
      [km_final, turno.veiculo_id],
    );
    await client.query('COMMIT');
    res.json({ turno: upd.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/turnos - lista. Motorista ve os seus; central ve todos.
const listar = asyncHandler(async (req, res) => {
  const filtros = [];
  const params = [];

  const forcarMotorista = req.usuario.papel === 'motorista';
  const motoristaId = forcarMotorista ? req.usuario.id : req.query.motorista_id;
  if (motoristaId) {
    params.push(motoristaId);
    filtros.push(`motorista_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    filtros.push(`status = $${params.length}`);
  }
  if (req.query.veiculo_id) {
    params.push(req.query.veiculo_id);
    filtros.push(`veiculo_id = $${params.length}`);
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
    `SELECT ${COLS_TURNO} FROM turnos ${where} ORDER BY inicio_em DESC`,
    params,
  );
  res.json({ total: rows.length, turnos: rows });
});

// GET /api/turnos/:id
const obter = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${COLS_TURNO} FROM turnos WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Turno nao encontrado.', 'TURNO_NAO_ENCONTRADO');
  }
  const turno = rows[0];
  if (req.usuario.papel === 'motorista' && turno.motorista_id !== req.usuario.id) {
    throw new AppError(403, 'Acesso negado.', 'ACESSO_NEGADO');
  }

  const chk = await query(
    'SELECT id, respostas, aprovado, realizado_em FROM checklists WHERE turno_id = $1',
    [req.params.id],
  );
  res.json({ turno, checklist: chk.rows[0] || null });
});

module.exports = { itensChecklist, iniciar, encerrar, listar, obter, traduzirConflitoTurno };
