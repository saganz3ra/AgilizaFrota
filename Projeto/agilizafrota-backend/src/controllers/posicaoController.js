/**
 * Controller de monitoramento por GPS (RF11) com tratamento de perda de
 * sinal e leituras nao confiaveis (RNF10).
 *
 * O app do motorista envia pontos individualmente (tempo real) ou em LOTE
 * (ao recuperar o sinal depois de operar offline). Cada ponto e avaliado:
 * coordenadas invalidas sao rejeitadas e "saltos" impossiveis sao gravados,
 * porem marcados como suspeitos - o dado bruto permanece auditavel.
 *
 * A central acompanha o mapa por "GET /frota" (ultima posicao + status de
 * rastreamento de cada veiculo) e por SSE em "GET /frota/stream".
 */
const { query, pool } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const eventos = require('../services/frotaEventos');
const { avaliarPosicao, statusRastreamento, LIMIARES } = require('../services/rastreamento');
const notificacoes = require('../services/notificacoes');

const COLS = `id, veiculo_id, motorista_id, turno_id, atendimento_id,
              lat, lng, precisao_m, velocidade_kmh, direcao_graus, altitude_m,
              bateria_pct, qualidade, descartada, motivo_descarte, origem,
              registrado_em, recebido_em`;

/** Descobre o veiculo do motorista pelo turno aberto (evita depender do app). */
async function resolverContexto(req, veiculoIdInformado) {
  if (req.usuario.papel === 'motorista') {
    const { rows } = await query(
      "SELECT id, veiculo_id FROM turnos WHERE motorista_id = $1 AND status = 'aberto'",
      [req.usuario.id],
    );
    const turno = rows[0] || null;
    const veiculoId = veiculoIdInformado || (turno ? turno.veiculo_id : null);
    if (!veiculoId) {
      throw new AppError(
        409,
        'Nenhum turno aberto: inicie o turno antes de enviar posicoes.',
        'SEM_TURNO_ABERTO',
      );
    }
    if (turno && veiculoIdInformado && turno.veiculo_id !== veiculoIdInformado) {
      throw new AppError(403, 'O veiculo informado nao e o do seu turno.', 'VEICULO_DIVERGENTE');
    }
    return { veiculoId, turnoId: turno ? turno.id : null, motoristaId: req.usuario.id };
  }
  if (!veiculoIdInformado) {
    throw new AppError(400, 'Informe o veiculo_id.', 'VEICULO_OBRIGATORIO');
  }
  return { veiculoId: veiculoIdInformado, turnoId: null, motoristaId: null };
}

/** Ultima posicao conhecida do veiculo (usada para detectar saltos). */
async function ultimaPosicao(veiculoId) {
  const { rows } = await query(
    `SELECT lat, lng, registrado_em FROM posicoes
      WHERE veiculo_id = $1 AND descartada = FALSE
      ORDER BY registrado_em DESC LIMIT 1`,
    [veiculoId],
  );
  return rows[0] || null;
}

/**
 * Grava um ponto ja avaliado. Recebe um "executor" (o pool ou um client de
 * transacao). Retorna a linha ou null se for duplicata.
 */
async function gravar(executor, ctx, ponto, avaliacao) {
  const { rows } = await executor.query(
    `INSERT INTO posicoes
       (veiculo_id, motorista_id, turno_id, atendimento_id, lat, lng, precisao_m,
        velocidade_kmh, direcao_graus, altitude_m, bateria_pct,
        qualidade, descartada, motivo_descarte, registrado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::timestamptz)
     ON CONFLICT (veiculo_id, registrado_em) DO NOTHING
     RETURNING ${COLS}`,
    [
      ctx.veiculoId,
      ctx.motoristaId,
      ctx.turnoId,
      ponto.atendimento_id || null,
      ponto.lat,
      ponto.lng,
      ponto.precisao_m ?? null,
      ponto.velocidade_kmh ?? null,
      ponto.direcao_graus ?? null,
      ponto.altitude_m ?? null,
      ponto.bateria_pct ?? null,
      avaliacao.qualidade,
      avaliacao.descartada,
      avaliacao.motivo,
      ponto.registrado_em,
    ],
  );
  return rows[0] || null;
}

// POST /api/posicoes - um ponto (tempo real).
const enviar = asyncHandler(async (req, res) => {
  const ctx = await resolverContexto(req, req.body.veiculo_id);
  const anterior = await ultimaPosicao(ctx.veiculoId);
  const avaliacao = avaliarPosicao(req.body, anterior);

  if (!avaliacao.aceita) {
    throw new AppError(422, avaliacao.motivo, 'POSICAO_INVALIDA');
  }

  // Insercao simples: usa o pool direto (nao segura conexao durante as
  // consultas seguintes, o que evitaria reuso e poderia esgotar o pool).
  const linha = await gravar({ query }, ctx, req.body, avaliacao);
  if (!linha) {
    return res.status(200).json({ duplicada: true, mensagem: 'Posicao ja registrada.' });
  }

  let chegada = { notificou: false, distancia_m: null };
  if (!linha.descartada) {
    eventos.publicar('frota:posicao', linha);
    // RF15/RNF11: a chegada e detectada pelo GPS e notifica a recepcionista
    // automaticamente - o motorista nao precisa tocar em nada.
    chegada = await notificacoes.verificarChegadaPorPosicao(ctx.veiculoId, req.body);
  }
  res.status(201).json({ posicao: linha, avaliacao, chegada });
});

// POST /api/posicoes/lote - sincronizacao apos perda de sinal (RNF10).
const enviarLote = asyncHandler(async (req, res) => {
  const ctx = await resolverContexto(req, req.body.veiculo_id);
  // Ordena por horario do evento: a deteccao de salto depende da sequencia.
  const pontos = [...req.body.posicoes].sort(
    (a, b) => new Date(a.registrado_em) - new Date(b.registrado_em),
  );

  const resumo = { recebidas: pontos.length, gravadas: 0, duplicadas: 0, rejeitadas: 0, suspeitas: 0 };
  const detalhes = [];
  let anterior = await ultimaPosicao(ctx.veiculoId);
  let ultimaGravada = null;

  const client = await pool.connect();
  try {
    for (const ponto of pontos) {
      const avaliacao = avaliarPosicao(ponto, anterior);
      if (!avaliacao.aceita) {
        resumo.rejeitadas += 1;
        detalhes.push({ registrado_em: ponto.registrado_em, motivo: avaliacao.motivo });
        continue;
      }
      const linha = await gravar(client, ctx, ponto, avaliacao);
      if (!linha) {
        resumo.duplicadas += 1;
        continue;
      }
      resumo.gravadas += 1;
      if (avaliacao.descartada) {
        resumo.suspeitas += 1;
        detalhes.push({ registrado_em: ponto.registrado_em, motivo: avaliacao.motivo });
      } else {
        anterior = { lat: ponto.lat, lng: ponto.lng, registrado_em: ponto.registrado_em };
        ultimaGravada = linha;
      }
    }
  } finally {
    client.release();
  }

  // Publica apenas o ponto mais recente: o mapa nao precisa do rastro inteiro.
  let chegada = { notificou: false, distancia_m: null };
  if (ultimaGravada) {
    eventos.publicar('frota:posicao', ultimaGravada);
    chegada = await notificacoes.verificarChegadaPorPosicao(ctx.veiculoId, {
      lat: ultimaGravada.lat,
      lng: ultimaGravada.lng,
    });
  }
  res.status(201).json({ resumo, detalhes, chegada });
});

// GET /api/frota - mapa: ultima posicao e status de cada veiculo (RF11).
const frota = asyncHandler(async (req, res) => {
  const params = [];
  let filtroUnidade = '';
  if (req.query.unidade_id) {
    params.push(req.query.unidade_id);
    filtroUnidade = `AND v.unidade_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT v.id AS veiculo_id, v.placa, v.modelo, v.status AS status_veiculo,
            v.unidade_id, un.nome AS unidade_nome,
            p.lat, p.lng, p.velocidade_kmh, p.direcao_graus, p.precisao_m,
            p.qualidade, p.registrado_em, p.recebido_em,
            u.nome AS motorista_nome,
            a.id AS atendimento_id, a.status AS atendimento_status
       FROM veiculos v
       LEFT JOIN unidades un ON un.id = v.unidade_id
       LEFT JOIN LATERAL (
            SELECT lat, lng, velocidade_kmh, direcao_graus, precisao_m, qualidade,
                   registrado_em, recebido_em, motorista_id
              FROM posicoes
             WHERE veiculo_id = v.id AND descartada = FALSE
             ORDER BY registrado_em DESC LIMIT 1
       ) p ON TRUE
       LEFT JOIN usuarios u ON u.id = p.motorista_id
       LEFT JOIN LATERAL (
            SELECT id, status FROM atendimentos
             WHERE veiculo_id = v.id AND status IN ('a_caminho','no_local','em_transporte')
             ORDER BY inicio_em DESC LIMIT 1
       ) a ON TRUE
      WHERE v.ativo = TRUE ${filtroUnidade}
      ORDER BY v.placa`,
    params,
  );

  const agora = new Date();
  let lista = rows.map((r) => {
    const st = statusRastreamento(r.registrado_em, agora);
    return { ...r, rastreamento: st.status, idade_segundos: st.idade_segundos };
  });
  if (req.query.status) {
    lista = lista.filter((r) => r.rastreamento === req.query.status);
  }

  res.json({
    total: lista.length,
    atualizado_em: agora.toISOString(),
    limiares_segundos: {
      online: LIMIARES.onlineSegundos,
      instavel: LIMIARES.instavelSegundos,
    },
    veiculos: lista,
  });
});

// GET /api/frota/veiculos/:id/posicoes - historico (rastro).
const historico = asyncHandler(async (req, res) => {
  const params = [req.params.id];
  const filtros = ['veiculo_id = $1'];
  if (req.query.incluir_descartadas !== 'true') filtros.push('descartada = FALSE');
  if (req.query.desde) {
    params.push(req.query.desde);
    filtros.push(`registrado_em >= $${params.length}`);
  }
  if (req.query.ate) {
    params.push(req.query.ate);
    filtros.push(`registrado_em <= $${params.length}`);
  }
  params.push(req.query.limite || 500);

  const { rows } = await query(
    `SELECT ${COLS} FROM posicoes
      WHERE ${filtros.join(' AND ')}
      ORDER BY registrado_em DESC
      LIMIT $${params.length}`,
    params,
  );
  res.json({ total: rows.length, posicoes: rows });
});

// GET /api/frota/stream - monitoramento em tempo real (SSE).
function stream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  res.write('event: conectado\ndata: {"ok":true}\n\n');
  eventos.adicionarCliente(res);

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

module.exports = { enviar, enviarLote, frota, historico, stream };
