/**
 * Servico de rotas e tempo estimado de chegada (RF16/RF17).
 *
 * Estrategia em dois niveis, para o sistema nunca "parar" por causa de uma
 * API externa (o que seria inaceitavel em uma operacao de urgencia):
 *
 *  1. PROVEDOR EXTERNO (Google Directions), quando GOOGLE_MAPS_API_KEY estiver
 *     configurada. Traz distancia, duracao e os passos da rota.
 *  2. ESTIMATIVA LOCAL (fallback), sempre disponivel: distancia em linha reta
 *     (Haversine) corrigida por um fator de sinuosidade e dividida por uma
 *     velocidade media que varia com a prioridade do chamado.
 *
 * Se a API falhar, demorar ou estourar cota, o resultado cai automaticamente
 * na estimativa - e a resposta sempre informa a "fonte", para o operador saber
 * o grau de confianca do numero que esta vendo.
 */
const { calcularDistanciaKm } = require('../utils/geo');

const CONFIG = {
  apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  // Rota real e maior que a linha reta; 1.3 e um fator conservador urbano.
  fatorSinuosidade: Number(process.env.ROTA_FATOR_SINUOSIDADE || 1.3),
  timeoutMs: Number(process.env.MAPAS_TIMEOUT_MS || 4000),
  cacheTtlMs: Number(process.env.MAPAS_CACHE_TTL_MS || 60000),
};

// Velocidades medias urbanas (km/h). Emergencia usa sirene e prioridade.
const VELOCIDADES_KMH = {
  critica: 60,
  alta: 55,
  media: 40,
  baixa: 35,
  padrao: 40,
};

/** Ha provedor externo configurado? */
function provedorConfigurado() {
  return CONFIG.apiKey.length > 0;
}

/** Velocidade media adotada para a prioridade informada. */
function velocidadeMediaKmh(prioridade) {
  return VELOCIDADES_KMH[prioridade] || VELOCIDADES_KMH.padrao;
}

/**
 * Estimativa local de rota (fallback). Funcao PURA.
 * @returns {{distancia_km:number, duracao_min:number, fonte:'estimativa',
 *            velocidade_media_kmh:number, observacao:string}|null}
 */
function estimarRota(origem, destino, opcoes = {}) {
  const retaKm = calcularDistanciaKm(origem.lat, origem.lng, destino.lat, destino.lng);
  if (retaKm === null) return null;

  const fator = opcoes.fator || CONFIG.fatorSinuosidade;
  const velocidade = velocidadeMediaKmh(opcoes.prioridade);
  const distancia = retaKm * fator;
  const duracao = (distancia / velocidade) * 60;

  return {
    distancia_km: Number(distancia.toFixed(2)),
    distancia_linha_reta_km: Number(retaKm.toFixed(2)),
    duracao_min: Math.max(1, Math.round(duracao)),
    velocidade_media_kmh: velocidade,
    fonte: 'estimativa',
    observacao:
      'Estimativa local (distancia em linha reta x fator de sinuosidade / velocidade media). ' +
      'Configure GOOGLE_MAPS_API_KEY para usar rotas reais.',
  };
}

// Cache simples em memoria: evita repetir a mesma consulta em poucos segundos.
const cache = new Map();
function chaveCache(origem, destino, prioridade) {
  const r = (v) => Number(v).toFixed(4);
  return `${r(origem.lat)},${r(origem.lng)}|${r(destino.lat)},${r(destino.lng)}|${prioridade || '-'}`;
}
function doCache(chave) {
  const item = cache.get(chave);
  if (!item) return null;
  if (Date.now() - item.em > CONFIG.cacheTtlMs) {
    cache.delete(chave);
    return null;
  }
  return item.valor;
}
function guardarCache(chave, valor) {
  cache.set(chave, { em: Date.now(), valor });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
}

/** Converte a resposta do Google Directions no formato interno. */
function traduzirGoogle(json, incluirPassos) {
  const rota = json.routes && json.routes[0];
  const perna = rota && rota.legs && rota.legs[0];
  if (!perna) return null;

  const resultado = {
    distancia_km: Number((perna.distance.value / 1000).toFixed(2)),
    duracao_min: Math.max(1, Math.round(perna.duration.value / 60)),
    fonte: 'google',
    resumo: rota.summary || null,
    polyline: rota.overview_polyline ? rota.overview_polyline.points : null,
  };
  if (incluirPassos && Array.isArray(perna.steps)) {
    resultado.passos = perna.steps.map((s) => ({
      instrucao: String(s.html_instructions || '').replace(/<[^>]+>/g, ''),
      distancia_km: Number((s.distance.value / 1000).toFixed(2)),
      duracao_min: Math.max(1, Math.round(s.duration.value / 60)),
    }));
  }
  return resultado;
}

/** Consulta o provedor externo. Lanca em caso de falha (tratada no chamador). */
async function rotaViaGoogle(origem, destino, opcoes = {}) {
  const url =
    'https://maps.googleapis.com/maps/api/directions/json' +
    `?origin=${origem.lat},${origem.lng}` +
    `&destination=${destino.lat},${destino.lng}` +
    '&mode=driving&departure_time=now&language=pt-BR' +
    `&key=${encodeURIComponent(CONFIG.apiKey)}`;

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), CONFIG.timeoutMs);
  try {
    const resp = await fetch(url, { signal: controle.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.status !== 'OK') throw new Error(`Directions: ${json.status}`);
    const traduzida = traduzirGoogle(json, opcoes.incluirPassos);
    if (!traduzida) throw new Error('Resposta sem rota.');
    return traduzida;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Obtem a rota/ETA entre dois pontos, com fallback automatico.
 * Nunca lanca por falha do provedor: sempre devolve algo utilizavel.
 */
async function obterRota(origem, destino, opcoes = {}) {
  if (
    origem == null || destino == null ||
    origem.lat == null || origem.lng == null ||
    destino.lat == null || destino.lng == null
  ) {
    return null;
  }

  const chave = chaveCache(origem, destino, opcoes.prioridade);
  const emCache = doCache(chave);
  if (emCache) return { ...emCache, cache: true };

  let resultado = null;
  if (provedorConfigurado()) {
    try {
      resultado = await rotaViaGoogle(origem, destino, opcoes);
    } catch (err) {
      // Falha do provedor nao pode derrubar a operacao: cai na estimativa.
      resultado = estimarRota(origem, destino, opcoes);
      if (resultado) {
        resultado.observacao =
          `Provedor de mapas indisponivel (${err.message}). ${resultado.observacao}`;
        resultado.degradado = true;
      }
    }
  } else {
    resultado = estimarRota(origem, destino, opcoes);
  }

  if (resultado) guardarCache(chave, resultado);
  return resultado;
}

module.exports = {
  CONFIG,
  VELOCIDADES_KMH,
  provedorConfigurado,
  velocidadeMediaKmh,
  estimarRota,
  traduzirGoogle,
  rotaViaGoogle,
  obterRota,
};
