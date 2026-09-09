/**
 * Relatorios operacionais e de desempenho (RF13).
 *
 * Cada relatorio aceita ?formato=json|csv|html:
 *   json -> consumo pelo painel web
 *   csv  -> planilha (abre no Excel, com BOM e separador ";")
 *   html -> pagina pronta para "Imprimir > Salvar como PDF"
 */
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { responderRelatorio } = require('../services/exportacao');

/** Filtros de periodo reutilizados pelos relatorios. */
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

const fmtData = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '');

// GET /api/relatorios/operacional - atendimentos do periodo, linha a linha.
const operacional = asyncHandler(async (req, res) => {
  const params = [];
  const filtros = periodo(req, params, 'a.inicio_em');
  if (req.query.unidade_id) {
    params.push(req.query.unidade_id);
    filtros.push(`c.destino_unidade_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    filtros.push(`a.status = $${params.length}`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT a.id, a.status, a.inicio_em, a.fim_em,
            a.km_saida, a.km_final, a.distancia_total_km,
            a.tempo_resposta_min, a.tempo_total_min, a.validado,
            v.placa, u.nome AS motorista, c.natureza, c.tipo, c.prioridade,
            un.nome AS unidade
       FROM atendimentos a
       JOIN veiculos v  ON v.id = a.veiculo_id
       JOIN usuarios u  ON u.id = a.motorista_id
       JOIN chamados c  ON c.id = a.chamado_id
       LEFT JOIN unidades un ON un.id = c.destino_unidade_id
       ${where}
      ORDER BY a.inicio_em DESC
      LIMIT 5000`,
    params,
  );

  const resumoQ = await query(
    `SELECT COUNT(*)::int AS atendimentos,
            COUNT(*) FILTER (WHERE a.status = 'concluido')::int AS concluidos,
            COALESCE(SUM(a.distancia_total_km),0)::int AS km_total,
            COALESCE(ROUND(AVG(a.tempo_resposta_min)),0)::int AS resposta_media_min,
            COUNT(*) FILTER (WHERE a.validado)::int AS validados
       FROM atendimentos a
       JOIN chamados c ON c.id = a.chamado_id
       ${where}`,
    params,
  );

  responderRelatorio(req, res, {
    nome: 'relatorio-operacional',
    titulo: 'Relatório Operacional de Atendimentos',
    periodo: { desde: req.query.desde, ate: req.query.ate },
    resumo: resumoQ.rows[0],
    colunas: [
      { campo: 'inicio_fmt', titulo: 'Início' },
      { campo: 'placa', titulo: 'Veículo' },
      { campo: 'motorista', titulo: 'Motorista' },
      { campo: 'natureza', titulo: 'Natureza' },
      { campo: 'tipo', titulo: 'Tipo' },
      { campo: 'prioridade', titulo: 'Prioridade' },
      { campo: 'unidade', titulo: 'Unidade destino' },
      { campo: 'distancia_total_km', titulo: 'Km' },
      { campo: 'tempo_resposta_min', titulo: 'Resposta (min)' },
      { campo: 'tempo_total_min', titulo: 'Total (min)' },
      { campo: 'status', titulo: 'Status' },
      { campo: 'validado_fmt', titulo: 'Validado' },
    ],
    linhas: rows.map((r) => ({
      ...r,
      inicio_fmt: fmtData(r.inicio_em),
      validado_fmt: r.validado ? 'Sim' : 'Não',
    })),
  });
});

// GET /api/relatorios/frota - uso e disponibilidade por veiculo.
const frota = asyncHandler(async (req, res) => {
  const params = [];
  const f = periodo(req, params, 'a.inicio_em');
  const filtroAtend = f.length ? `AND ${f.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT v.placa, v.modelo, v.marca, v.status, v.quilometragem_atual,
            un.nome AS unidade,
            COUNT(a.id)::int AS atendimentos,
            COALESCE(SUM(a.distancia_total_km),0)::int AS km_periodo,
            COALESCE(ROUND(AVG(a.tempo_resposta_min)),0)::int AS resposta_media_min,
            MAX(a.fim_em) AS ultimo_atendimento
       FROM veiculos v
       LEFT JOIN unidades un ON un.id = v.unidade_id
       LEFT JOIN atendimentos a ON a.veiculo_id = v.id ${filtroAtend}
      WHERE v.ativo = TRUE
      GROUP BY v.id, v.placa, v.modelo, v.marca, v.status, v.quilometragem_atual, un.nome
      ORDER BY atendimentos DESC, v.placa`,
    params,
  );

  const resumo = {
    veiculos: rows.length,
    atendimentos: rows.reduce((s, r) => s + r.atendimentos, 0),
    km_periodo: rows.reduce((s, r) => s + r.km_periodo, 0),
    em_manutencao: rows.filter((r) => r.status === 'manutencao').length,
  };

  responderRelatorio(req, res, {
    nome: 'relatorio-frota',
    titulo: 'Relatório de Uso da Frota',
    periodo: { desde: req.query.desde, ate: req.query.ate },
    resumo,
    colunas: [
      { campo: 'placa', titulo: 'Placa' },
      { campo: 'modelo', titulo: 'Modelo' },
      { campo: 'unidade', titulo: 'Unidade' },
      { campo: 'status', titulo: 'Situação' },
      { campo: 'atendimentos', titulo: 'Atendimentos' },
      { campo: 'km_periodo', titulo: 'Km no período' },
      { campo: 'resposta_media_min', titulo: 'Resposta média (min)' },
      { campo: 'quilometragem_atual', titulo: 'Odômetro' },
      { campo: 'ultimo_fmt', titulo: 'Último atendimento' },
    ],
    linhas: rows.map((r) => ({ ...r, ultimo_fmt: fmtData(r.ultimo_atendimento) })),
  });
});

// GET /api/relatorios/desempenho - por motorista, com previsto x realizado.
const desempenho = asyncHandler(async (req, res) => {
  const params = [];
  const f = periodo(req, params, 'a.inicio_em');
  const filtro = f.length ? `AND ${f.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT u.nome AS motorista, u.email,
            COUNT(a.id)::int AS atendimentos,
            COALESCE(SUM(a.distancia_total_km),0)::int AS km_total,
            COALESCE(ROUND(AVG(a.tempo_resposta_min)),0)::int AS resposta_media_min,
            COALESCE(ROUND(AVG(a.tempo_total_min)),0)::int AS total_medio_min,
            COALESCE(ROUND(AVG(atr.eta_minutos)),0)::int AS eta_previsto_medio_min,
            COUNT(*) FILTER (WHERE a.validado)::int AS validados
       FROM usuarios u
       LEFT JOIN atendimentos a ON a.motorista_id = u.id AND a.status = 'concluido' ${filtro}
       LEFT JOIN atribuicoes atr ON atr.chamado_id = a.chamado_id
      WHERE u.papel = 'motorista' AND u.ativo = TRUE
      GROUP BY u.id, u.nome, u.email
      ORDER BY atendimentos DESC, u.nome`,
    params,
  );

  const linhas = rows.map((r) => {
    const desvio =
      r.eta_previsto_medio_min > 0 && r.resposta_media_min > 0
        ? r.resposta_media_min - r.eta_previsto_medio_min
        : null;
    return {
      ...r,
      desvio_min: desvio === null ? '' : (desvio > 0 ? `+${desvio}` : String(desvio)),
    };
  });

  responderRelatorio(req, res, {
    nome: 'relatorio-desempenho',
    titulo: 'Relatório de Desempenho por Motorista',
    subtitulo: 'Comparação entre o tempo previsto no acionamento e o realizado',
    periodo: { desde: req.query.desde, ate: req.query.ate },
    resumo: {
      motoristas: linhas.length,
      atendimentos: linhas.reduce((s, r) => s + r.atendimentos, 0),
      km_total: linhas.reduce((s, r) => s + r.km_total, 0),
    },
    colunas: [
      { campo: 'motorista', titulo: 'Motorista' },
      { campo: 'atendimentos', titulo: 'Atendimentos' },
      { campo: 'km_total', titulo: 'Km' },
      { campo: 'eta_previsto_medio_min', titulo: 'Previsto (min)' },
      { campo: 'resposta_media_min', titulo: 'Realizado (min)' },
      { campo: 'desvio_min', titulo: 'Desvio (min)' },
      { campo: 'total_medio_min', titulo: 'Duração média (min)' },
      { campo: 'validados', titulo: 'Validados' },
    ],
    linhas,
  });
});

module.exports = { operacional, frota, desempenho };
