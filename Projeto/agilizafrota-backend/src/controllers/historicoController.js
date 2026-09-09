/**
 * Historico completo da frota e dos atendimentos (RF12).
 *
 * Consolida, em uma unica linha do tempo, os eventos que hoje vivem em
 * tabelas separadas (turnos, chamados, atribuicoes, atendimentos), com
 * filtros por motorista, veiculo, unidade e periodo. Tambem entrega
 * recortes por veiculo/motorista e um resumo com indicadores - base para
 * os relatorios da Sprint 10 (RF13).
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');

/** Monta os filtros comuns de periodo. */
function periodo(req, params, campo) {
  const filtros = [];
  if (req.query.desde) {
    params.push(req.query.desde);
    filtros.push(`${campo} >= $${params.length}`);
  }
  if (req.query.ate) {
    params.push(req.query.ate);
    filtros.push(`${campo} <= $${params.length}`);
  }
  return filtros;
}

// GET /api/historico - linha do tempo consolidada.
const linhaDoTempo = asyncHandler(async (req, res) => {
  const params = [];
  const cond = { turnos: [], atendimentos: [], chamados: [] };

  if (req.query.motorista_id) {
    params.push(req.query.motorista_id);
    cond.turnos.push(`t.motorista_id = $${params.length}`);
    cond.atendimentos.push(`a.motorista_id = $${params.length}`);
  }
  if (req.query.veiculo_id) {
    params.push(req.query.veiculo_id);
    cond.turnos.push(`t.veiculo_id = $${params.length}`);
    cond.atendimentos.push(`a.veiculo_id = $${params.length}`);
  }
  if (req.query.unidade_id) {
    params.push(req.query.unidade_id);
    cond.chamados.push(`c.destino_unidade_id = $${params.length}`);
  }

  const pTurno = periodo(req, params, 't.inicio_em');
  const pAtend = periodo(req, params, 'a.inicio_em');
  const pCham = periodo(req, params, 'c.aberto_em');

  const w = (base, extra) => {
    const todos = [...base, ...extra];
    return todos.length ? `WHERE ${todos.join(' AND ')}` : '';
  };

  // Cada bloco vira um "evento" com formato comum.
  const sql = `
    SELECT * FROM (
      SELECT 'turno' AS tipo, t.id, t.inicio_em AS ocorrido_em, t.status,
             v.placa, u.nome AS pessoa, NULL::text AS descricao,
             t.km_inicial AS valor_a, t.km_final AS valor_b
        FROM turnos t
        JOIN veiculos v ON v.id = t.veiculo_id
        JOIN usuarios u ON u.id = t.motorista_id
        ${w(cond.turnos, pTurno)}
      UNION ALL
      SELECT 'atendimento', a.id, a.inicio_em, a.status,
             v.placa, u.nome, c.natureza,
             a.distancia_total_km, a.tempo_total_min
        FROM atendimentos a
        JOIN veiculos v ON v.id = a.veiculo_id
        JOIN usuarios u ON u.id = a.motorista_id
        JOIN chamados c ON c.id = a.chamado_id
        ${w(cond.atendimentos, pAtend)}
      UNION ALL
      SELECT 'chamado', c.id, c.aberto_em, c.status,
             NULL, NULL, c.natureza, NULL, NULL
        FROM chamados c
        ${w(cond.chamados, pCham)}
    ) eventos
    ORDER BY ocorrido_em DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  params.push(Number(req.query.limite || 100));
  params.push(Number(req.query.offset || 0));

  const { rows } = await query(sql, params);
  res.json({ total: rows.length, eventos: rows });
});

// GET /api/historico/veiculos/:id
const porVeiculo = asyncHandler(async (req, res) => {
  const veic = await query('SELECT id, placa, modelo, quilometragem_atual FROM veiculos WHERE id = $1', [
    req.params.id,
  ]);
  if (veic.rows.length === 0) {
    throw new AppError(404, 'Veiculo nao encontrado.', 'VEICULO_NAO_ENCONTRADO');
  }

  const params = [req.params.id];
  const fTurno = periodo(req, params, 'inicio_em');
  const turnos = await query(
    `SELECT id, motorista_id, status, km_inicial, km_final, inicio_em, fim_em
       FROM turnos WHERE veiculo_id = $1 ${fTurno.length ? 'AND ' + fTurno.join(' AND ') : ''}
      ORDER BY inicio_em DESC LIMIT 200`,
    params,
  );

  const params2 = [req.params.id];
  const fAtend = periodo(req, params2, 'inicio_em');
  const atendimentos = await query(
    `SELECT id, chamado_id, motorista_id, status, km_saida, km_final,
            distancia_total_km, tempo_total_min, validado, inicio_em, fim_em
       FROM atendimentos WHERE veiculo_id = $1 ${fAtend.length ? 'AND ' + fAtend.join(' AND ') : ''}
      ORDER BY inicio_em DESC LIMIT 200`,
    params2,
  );

  const params3 = [req.params.id];
  const fRes = periodo(req, params3, 'inicio_em');
  const resumo = await query(
    `SELECT COUNT(*)::int AS atendimentos,
            COALESCE(SUM(distancia_total_km), 0)::int AS km_percorridos,
            COALESCE(ROUND(AVG(tempo_resposta_min)), 0)::int AS tempo_resposta_medio_min,
            COUNT(*) FILTER (WHERE validado)::int AS validados
       FROM atendimentos
      WHERE veiculo_id = $1 AND status = 'concluido'
        ${fRes.length ? 'AND ' + fRes.join(' AND ') : ''}`,
    params3,
  );

  res.json({
    veiculo: veic.rows[0],
    resumo: resumo.rows[0],
    turnos: turnos.rows,
    atendimentos: atendimentos.rows,
  });
});

// GET /api/historico/motoristas/:id
const porMotorista = asyncHandler(async (req, res) => {
  const mot = await query("SELECT id, nome, email FROM usuarios WHERE id = $1 AND papel = 'motorista'", [
    req.params.id,
  ]);
  if (mot.rows.length === 0) {
    throw new AppError(404, 'Motorista nao encontrado.', 'MOTORISTA_NAO_ENCONTRADO');
  }

  const params = [req.params.id];
  const f = periodo(req, params, 'inicio_em');
  const cond = f.length ? 'AND ' + f.join(' AND ') : '';

  const turnos = await query(
    `SELECT id, veiculo_id, status, km_inicial, km_final, inicio_em, fim_em
       FROM turnos WHERE motorista_id = $1 ${cond} ORDER BY inicio_em DESC LIMIT 200`,
    params,
  );
  const params2 = [req.params.id];
  const f2 = periodo(req, params2, 'inicio_em');
  const atendimentos = await query(
    `SELECT id, chamado_id, veiculo_id, status, distancia_total_km, tempo_total_min,
            validado, inicio_em, fim_em
       FROM atendimentos WHERE motorista_id = $1 ${f2.length ? 'AND ' + f2.join(' AND ') : ''}
      ORDER BY inicio_em DESC LIMIT 200`,
    params2,
  );
  const params3 = [req.params.id];
  const f3 = periodo(req, params3, 'inicio_em');
  const resumo = await query(
    `SELECT COUNT(*)::int AS atendimentos,
            COALESCE(SUM(distancia_total_km), 0)::int AS km_percorridos,
            COALESCE(ROUND(AVG(tempo_resposta_min)), 0)::int AS tempo_resposta_medio_min
       FROM atendimentos
      WHERE motorista_id = $1 AND status = 'concluido'
        ${f3.length ? 'AND ' + f3.join(' AND ') : ''}`,
    params3,
  );

  res.json({
    motorista: mot.rows[0],
    resumo: resumo.rows[0],
    turnos: turnos.rows,
    atendimentos: atendimentos.rows,
  });
});

// GET /api/historico/resumo - indicadores agregados do periodo.
const resumo = asyncHandler(async (req, res) => {
  const params = [];
  const fAtend = periodo(req, params, 'inicio_em');
  const condAtend = fAtend.length ? `WHERE ${fAtend.join(' AND ')}` : '';

  const atendimentos = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'concluido')::int AS concluidos,
            COUNT(*) FILTER (WHERE status = 'cancelado')::int AS cancelados,
            COALESCE(SUM(distancia_total_km), 0)::int AS km_percorridos,
            COALESCE(ROUND(AVG(tempo_resposta_min)), 0)::int AS tempo_resposta_medio_min,
            COALESCE(ROUND(AVG(tempo_total_min)), 0)::int AS tempo_total_medio_min,
            COUNT(*) FILTER (WHERE validado)::int AS validados
       FROM atendimentos ${condAtend}`,
    params,
  );

  const params2 = [];
  const fCham = periodo(req, params2, 'aberto_em');
  const chamados = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE tipo = 'emergencia')::int AS emergencias,
            COUNT(*) FILTER (WHERE tipo = 'urgencia')::int AS urgencias,
            COUNT(*) FILTER (WHERE status = 'concluido')::int AS concluidos
       FROM chamados ${fCham.length ? `WHERE ${fCham.join(' AND ')}` : ''}`,
    params2,
  );

  const frota = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'disponivel')::int AS disponiveis,
            COUNT(*) FILTER (WHERE status = 'em_uso')::int AS em_uso,
            COUNT(*) FILTER (WHERE status = 'manutencao')::int AS manutencao
       FROM veiculos WHERE ativo = TRUE`,
  );

  res.json({
    periodo: { desde: req.query.desde || null, ate: req.query.ate || null },
    atendimentos: atendimentos.rows[0],
    chamados: chamados.rows[0],
    frota: frota.rows[0],
  });
});

module.exports = { linhaDoTempo, porVeiculo, porMotorista, resumo };
