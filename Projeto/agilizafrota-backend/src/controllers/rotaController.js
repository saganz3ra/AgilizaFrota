/**
 * Tempo estimado de chegada (RF16) e sugestao de rota (RF17).
 *
 * Todos os endpoints respondem com a "fonte" do calculo (`google` ou
 * `estimativa`) para que a central saiba o grau de confianca do numero.
 * Quando o provedor externo nao esta configurado ou falha, a resposta cai
 * automaticamente na estimativa local - o sistema nunca fica sem resposta.
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const mapas = require('../services/mapas');

/** Ultima posicao confiavel do veiculo. */
async function posicaoVeiculo(veiculoId) {
  const { rows } = await query(
    `SELECT lat, lng, registrado_em FROM posicoes
      WHERE veiculo_id = $1 AND descartada = FALSE
      ORDER BY registrado_em DESC LIMIT 1`,
    [veiculoId],
  );
  return rows[0] || null;
}

// GET /api/rotas/eta - ETA entre dois pontos quaisquer.
const eta = asyncHandler(async (req, res) => {
  const rota = await mapas.obterRota(
    { lat: Number(req.query.origem_lat), lng: Number(req.query.origem_lng) },
    { lat: Number(req.query.destino_lat), lng: Number(req.query.destino_lng) },
    { prioridade: req.query.prioridade },
  );
  if (!rota) {
    throw new AppError(422, 'Coordenadas invalidas para calcular a rota.', 'COORDENADAS_INVALIDAS');
  }
  res.json({ rota, provedor_configurado: mapas.provedorConfigurado() });
});

// GET /api/rotas/sugerir - rota sugerida (com passos, quando disponivel) - RF17.
const sugerir = asyncHandler(async (req, res) => {
  const rota = await mapas.obterRota(
    { lat: Number(req.query.origem_lat), lng: Number(req.query.origem_lng) },
    { lat: Number(req.query.destino_lat), lng: Number(req.query.destino_lng) },
    { prioridade: req.query.prioridade, incluirPassos: true },
  );
  if (!rota) {
    throw new AppError(422, 'Coordenadas invalidas para calcular a rota.', 'COORDENADAS_INVALIDAS');
  }
  res.json({
    rota,
    provedor_configurado: mapas.provedorConfigurado(),
    observacao_tcc:
      'Rota basica, sem otimizacao de multiplas paradas - conforme o escopo definido (RF17).',
  });
});

// GET /api/chamados/:id/eta - previsao do veiculo acionado ate a ocorrencia
// e da ocorrencia ate a unidade de destino (RF16).
const etaDoChamado = asyncHandler(async (req, res) => {
  const cham = await query(
    `SELECT c.id, c.prioridade, c.origem_lat, c.origem_lng, c.destino_unidade_id,
            un.nome AS destino_nome, un.lat AS destino_lat, un.lng AS destino_lng
       FROM chamados c
       LEFT JOIN unidades un ON un.id = c.destino_unidade_id
      WHERE c.id = $1`,
    [req.params.id],
  );
  if (cham.rows.length === 0) {
    throw new AppError(404, 'Chamado nao encontrado.', 'CHAMADO_NAO_ENCONTRADO');
  }
  const chamado = cham.rows[0];

  const atr = await query(
    `SELECT a.veiculo_id, v.placa
       FROM atribuicoes a JOIN veiculos v ON v.id = a.veiculo_id
      WHERE a.chamado_id = $1 AND a.status = 'ativa'`,
    [req.params.id],
  );
  const atribuicao = atr.rows[0] || null;

  let ateOcorrencia = null;
  let posicao = null;
  if (atribuicao) {
    posicao = await posicaoVeiculo(atribuicao.veiculo_id);
    if (posicao && chamado.origem_lat != null) {
      ateOcorrencia = await mapas.obterRota(
        { lat: posicao.lat, lng: posicao.lng },
        { lat: chamado.origem_lat, lng: chamado.origem_lng },
        { prioridade: chamado.prioridade },
      );
    }
  }

  let ateDestino = null;
  if (chamado.origem_lat != null && chamado.destino_lat != null) {
    ateDestino = await mapas.obterRota(
      { lat: chamado.origem_lat, lng: chamado.origem_lng },
      { lat: chamado.destino_lat, lng: chamado.destino_lng },
      { prioridade: chamado.prioridade },
    );
  }

  const totalMin =
    (ateOcorrencia ? ateOcorrencia.duracao_min : 0) + (ateDestino ? ateDestino.duracao_min : 0);

  res.json({
    chamado_id: chamado.id,
    veiculo: atribuicao ? { id: atribuicao.veiculo_id, placa: atribuicao.placa } : null,
    posicao_atual: posicao || null,
    ate_ocorrencia: ateOcorrencia,
    ate_destino: ateDestino,
    destino: chamado.destino_nome || null,
    total_estimado_min: totalMin || null,
    aviso: !atribuicao
      ? 'Chamado ainda sem veiculo acionado.'
      : !posicao
        ? 'Veiculo sem posicao de GPS registrada.'
        : undefined,
  });
});

// GET /api/atendimentos/:id/rota - rota do ponto atual ate o proximo destino.
const rotaDoAtendimento = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.status, a.veiculo_id, a.motorista_id,
            c.prioridade, c.origem_lat, c.origem_lng, c.natureza,
            un.nome AS destino_nome, un.lat AS destino_lat, un.lng AS destino_lng
       FROM atendimentos a
       JOIN chamados c ON c.id = a.chamado_id
       LEFT JOIN unidades un ON un.id = c.destino_unidade_id
      WHERE a.id = $1`,
    [req.params.id],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Atendimento nao encontrado.', 'ATENDIMENTO_NAO_ENCONTRADO');
  }
  const at = rows[0];
  if (req.usuario.papel === 'motorista' && at.motorista_id !== req.usuario.id) {
    throw new AppError(403, 'Este atendimento pertence a outro motorista.', 'ACESSO_NEGADO');
  }

  const posicao = await posicaoVeiculo(at.veiculo_id);
  if (!posicao) {
    throw new AppError(
      409,
      'Sem posicao de GPS do veiculo para calcular a rota.',
      'SEM_POSICAO',
    );
  }

  // Antes de embarcar o paciente o destino e a ocorrencia; depois, a unidade.
  const indoParaOcorrencia = at.status === 'a_caminho';
  const destino = indoParaOcorrencia
    ? { lat: at.origem_lat, lng: at.origem_lng, nome: at.natureza }
    : { lat: at.destino_lat, lng: at.destino_lng, nome: at.destino_nome };

  if (destino.lat == null || destino.lng == null) {
    throw new AppError(422, 'Destino sem coordenadas cadastradas.', 'DESTINO_SEM_COORDENADAS');
  }

  const rota = await mapas.obterRota(
    { lat: posicao.lat, lng: posicao.lng },
    { lat: destino.lat, lng: destino.lng },
    { prioridade: at.prioridade, incluirPassos: true },
  );

  res.json({
    atendimento_id: at.id,
    etapa: indoParaOcorrencia ? 'ate_ocorrencia' : 'ate_destino',
    destino: { nome: destino.nome, lat: destino.lat, lng: destino.lng },
    origem: posicao,
    rota,
  });
});

module.exports = { eta, sugerir, etaDoChamado, rotaDoAtendimento };
