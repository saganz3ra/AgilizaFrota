/**
 * Regras de notificacao (RF15) - com destaque para a chegada do veiculo,
 * disparada AUTOMATICAMENTE pelo GPS (RNF11: zero interacao do motorista).
 */
const { query } = require('../config/db');
const { calcularDistanciaKm } = require('../utils/geo');
const eventos = require('./notificacoesEventos');

const COLS = `id, destinatario_id, unidade_id, tipo, titulo, mensagem, dados,
              chamado_id, atendimento_id, veiculo_id, lida, lida_em, criado_em`;

// Raio (em metros) para considerar que o veiculo "chegou" a unidade.
const RAIO_CHEGADA_M = Number(process.env.NOTIFICACAO_RAIO_CHEGADA_M || 300);

/**
 * Verifica se o veiculo esta dentro do raio de chegada da unidade de destino
 * do atendimento em andamento. Funcao pura (facil de testar).
 * @returns {{chegou:boolean, distancia_m:number|null}}
 */
function avaliarChegada(posicao, unidade, raioM) {
  const raio = raioM || RAIO_CHEGADA_M;
  if (!unidade || unidade.lat === null || unidade.lat === undefined) {
    return { chegou: false, distancia_m: null };
  }
  const km = calcularDistanciaKm(posicao.lat, posicao.lng, unidade.lat, unidade.lng);
  if (km === null) return { chegou: false, distancia_m: null };
  const metros = Math.round(km * 1000);
  return { chegou: metros <= raio, distancia_m: metros };
}

/** Contexto do atendimento em andamento do veiculo (para o geofence). */
async function contextoChegada(veiculoId) {
  const { rows } = await query(
    `SELECT a.id AS atendimento_id, a.chamado_id, a.motorista_id,
            c.natureza, c.prioridade, c.destino_unidade_id,
            un.nome AS unidade_nome, un.lat AS unidade_lat, un.lng AS unidade_lng,
            v.placa, u.nome AS motorista_nome
       FROM atendimentos a
       JOIN chamados c   ON c.id = a.chamado_id
       JOIN veiculos v   ON v.id = a.veiculo_id
       LEFT JOIN unidades un ON un.id = c.destino_unidade_id
       LEFT JOIN usuarios u  ON u.id = a.motorista_id
      WHERE a.veiculo_id = $1
        AND a.status IN ('a_caminho', 'no_local', 'em_transporte')
      ORDER BY a.inicio_em DESC
      LIMIT 1`,
    [veiculoId],
  );
  return rows[0] || null;
}

/** Ja existe notificacao desse tipo para o atendimento? (evita repetir) */
async function jaNotificado(atendimentoId, tipo) {
  const { rows } = await query(
    'SELECT 1 FROM notificacoes WHERE atendimento_id = $1 AND tipo = $2 LIMIT 1',
    [atendimentoId, tipo],
  );
  return rows.length > 0;
}

/**
 * Cria a notificacao de chegada para as recepcionistas da unidade de destino.
 * Idempotente: se ja houver notificacao para o atendimento, nao faz nada.
 * @returns {Promise<object[]>} notificacoes criadas
 */
async function notificarChegada(ctx, distanciaM) {
  if (await jaNotificado(ctx.atendimento_id, 'chegada_veiculo')) return [];

  const recep = await query(
    "SELECT id FROM usuarios WHERE papel = 'recepcionista' AND ativo = TRUE AND unidade_id = $1",
    [ctx.destino_unidade_id],
  );
  const destinatarios = recep.rows.map((r) => r.id);

  const titulo = `Ambulancia chegando: ${ctx.placa}`;
  const mensagem =
    `O veiculo ${ctx.placa} esta chegando em ${ctx.unidade_nome || 'sua unidade'}` +
    (ctx.natureza ? ` para atendimento de ${ctx.natureza}.` : '.');
  const dados = {
    placa: ctx.placa,
    motorista: ctx.motorista_nome,
    natureza: ctx.natureza,
    prioridade: ctx.prioridade,
    distancia_m: distanciaM,
    unidade: ctx.unidade_nome,
  };

  const criadas = [];
  // Sem recepcionista cadastrado: registra a notificacao "da unidade".
  const alvos = destinatarios.length > 0 ? destinatarios : [null];
  for (const destinatarioId of alvos) {
    const { rows } = await query(
      `INSERT INTO notificacoes
         (destinatario_id, unidade_id, tipo, titulo, mensagem, dados,
          chamado_id, atendimento_id, veiculo_id)
       VALUES ($1, $2, 'chegada_veiculo', $3, $4, $5::jsonb, $6, $7,
               (SELECT veiculo_id FROM atendimentos WHERE id = $7))
       RETURNING ${COLS}`,
      [
        destinatarioId,
        ctx.destino_unidade_id,
        titulo,
        mensagem,
        JSON.stringify(dados),
        ctx.chamado_id,
        ctx.atendimento_id,
      ],
    );
    if (rows[0]) criadas.push(rows[0]);
  }

  if (criadas.length > 0) {
    eventos.publicar('notificacao:nova', criadas[0], destinatarios);
  }
  return criadas;
}

/**
 * Ponto de entrada usado pelo GPS: avalia a posicao e notifica se chegou.
 * @returns {Promise<{notificou:boolean, distancia_m:number|null}>}
 */
async function verificarChegadaPorPosicao(veiculoId, posicao) {
  const ctx = await contextoChegada(veiculoId);
  if (!ctx || !ctx.destino_unidade_id) return { notificou: false, distancia_m: null };

  const { chegou, distancia_m } = avaliarChegada(posicao, {
    lat: ctx.unidade_lat,
    lng: ctx.unidade_lng,
  });
  if (!chegou) return { notificou: false, distancia_m };

  const criadas = await notificarChegada(ctx, distancia_m);
  return { notificou: criadas.length > 0, distancia_m };
}

module.exports = {
  COLS,
  RAIO_CHEGADA_M,
  avaliarChegada,
  contextoChegada,
  jaNotificado,
  notificarChegada,
  verificarChegadaPorPosicao,
};
