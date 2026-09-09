/**
 * Servico de sugestao de unidade/veiculo (RF08).
 *
 * Regra SIMPLES e EXPLICAVEL (sem aprendizado de maquina), considerando
 * disponibilidade e contexto global - nao apenas proximidade, conforme o
 * requisito. Cada candidato recebe uma pontuacao e a lista de "motivos",
 * para que o operador da central entenda por que aquele veiculo foi sugerido.
 *
 * Criterios e pesos:
 *   +40  veiculo com motorista em turno aberto (pronto para sair agora)
 *   +25  veiculo lotado na unidade de destino do chamado
 *   0-30 proximidade da unidade do veiculo ate a origem do chamado
 *        (30 quando na mesma coordenada; decai ate 0 em 50 km)
 *   +5   chamado critico/alto atendido por veiculo ja tripulado (desempate)
 *
 * Nao entram na lista: veiculos inativos, em manutencao ou que ja possuem
 * atribuicao ativa. Veiculos "em_uso" por turno aberto CONTINUAM elegiveis -
 * o motorista de plantao e justamente o melhor candidato.
 */
const { query } = require('../config/db');
const { calcularDistanciaKm } = require('../utils/geo');

const DISTANCIA_MAX_PONTUAVEL_KM = 50;

const PESOS = {
  motoristaEmTurno: 40,
  unidadeDestino: 25,
  proximidadeMax: 30,
  prioridadeTripulado: 5,
};

/**
 * Pontua um candidato para um chamado. Funcao pura (facilita os testes).
 * @returns {{ pontuacao: number, motivos: string[], distancia_km: number|null }}
 */
function pontuarCandidato(candidato, chamado) {
  let pontuacao = 0;
  const motivos = [];

  const tripulado = Boolean(candidato.turno_id);
  if (tripulado) {
    pontuacao += PESOS.motoristaEmTurno;
    motivos.push(`Motorista em turno aberto (${candidato.motorista_nome || 'sem nome'})`);
  } else {
    motivos.push('Sem motorista em turno - exige acionamento');
  }

  if (
    chamado.destino_unidade_id &&
    candidato.unidade_id &&
    chamado.destino_unidade_id === candidato.unidade_id
  ) {
    pontuacao += PESOS.unidadeDestino;
    motivos.push('Lotado na unidade de destino do chamado');
  }

  const distancia = calcularDistanciaKm(
    candidato.unidade_lat,
    candidato.unidade_lng,
    chamado.origem_lat,
    chamado.origem_lng,
  );
  if (distancia !== null) {
    const fator = Math.max(0, 1 - distancia / DISTANCIA_MAX_PONTUAVEL_KM);
    const pontosProximidade = Math.round(PESOS.proximidadeMax * fator);
    pontuacao += pontosProximidade;
    motivos.push(`A ${distancia.toFixed(1)} km da origem do chamado`);
  } else {
    motivos.push('Sem coordenadas para calcular a distancia');
  }

  if (tripulado && (chamado.prioridade === 'critica' || chamado.prioridade === 'alta')) {
    pontuacao += PESOS.prioridadeTripulado;
    motivos.push('Prioridade elevada: veiculo ja tripulado tem preferencia');
  }

  return { pontuacao, motivos, distancia_km: distancia === null ? null : Number(distancia.toFixed(2)) };
}

/** Busca os veiculos elegiveis (ativos, disponiveis e sem atribuicao ativa). */
async function buscarCandidatos() {
  const { rows } = await query(
    `SELECT v.id            AS veiculo_id,
            v.placa,
            v.modelo,
            v.unidade_id,
            un.nome         AS unidade_nome,
            un.lat          AS unidade_lat,
            un.lng          AS unidade_lng,
            t.id            AS turno_id,
            t.motorista_id,
            us.nome         AS motorista_nome
       FROM veiculos v
       LEFT JOIN unidades un ON un.id = v.unidade_id
       LEFT JOIN turnos   t  ON t.veiculo_id = v.id AND t.status = 'aberto'
       LEFT JOIN usuarios us ON us.id = t.motorista_id
      WHERE v.ativo = TRUE
        -- "em_uso" significa turno aberto (motorista de plantao), o que NAO
        -- impede o acionamento: o que ocupa o veiculo e a atribuicao ativa.
        AND v.status <> 'manutencao'
        AND NOT EXISTS (
              SELECT 1 FROM atribuicoes a
               WHERE a.veiculo_id = v.id AND a.status = 'ativa'
            )`,
  );
  return rows;
}

/**
 * Gera a lista de sugestoes ordenada (melhor primeiro).
 * @param {object} chamado - linha da tabela chamados.
 * @param {number} [limite=5]
 */
async function sugerirParaChamado(chamado, limite = 5) {
  const candidatos = await buscarCandidatos();
  return candidatos
    .map((c) => ({ ...c, ...pontuarCandidato(c, chamado) }))
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .slice(0, limite);
}

module.exports = {
  calcularDistanciaKm,
  pontuarCandidato,
  buscarCandidatos,
  sugerirParaChamado,
  PESOS,
};
