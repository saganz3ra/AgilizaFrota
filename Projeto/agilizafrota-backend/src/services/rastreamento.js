/**
 * Regras de confiabilidade do rastreamento por GPS (RNF10).
 *
 * Funcoes PURAS: validam e classificam pontos sem tocar no banco, o que
 * permite testar cada regra isoladamente.
 *
 * Problemas tratados:
 *  - coordenadas invalidas ou ausentes;
 *  - precisao ruim (erro do aparelho em metros);
 *  - "saltos" impossiveis (ponto que exigiria velocidade irreal);
 *  - perda de sinal: o status do veiculo e derivado da IDADE da ultima
 *    posicao, para a central saber quando os dados nao sao confiaveis.
 */
const { calcularDistanciaKm } = require('../utils/geo');

// Limiares (documentados para o TCC; ajustaveis conforme a operacao).
const LIMIARES = {
  precisaoBoaM: 50,          // ate 50 m: sinal bom
  precisaoMaximaM: 500,      // acima disso o ponto e considerado nao confiavel
  velocidadeMaximaKmh: 200,  // acima disso e salto impossivel (erro de GPS)
  onlineSegundos: 120,       // ate 2 min desde o ultimo ponto: online
  instavelSegundos: 600,     // ate 10 min: sinal instavel; acima: offline
};

/** Valida uma leitura de GPS. @returns {{valida:boolean, motivo?:string}} */
function validarPosicao(p) {
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { valida: false, motivo: 'Coordenadas ausentes ou nao numericas.' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valida: false, motivo: 'Coordenadas fora do intervalo valido.' };
  }
  if (lat === 0 && lng === 0) {
    return { valida: false, motivo: 'Coordenada nula (0,0) - GPS sem fix.' };
  }
  if (p.precisao_m !== null && p.precisao_m !== undefined && Number(p.precisao_m) > LIMIARES.precisaoMaximaM) {
    return { valida: false, motivo: `Precisao de ${p.precisao_m} m acima do limite aceitavel.` };
  }
  if (!p.registrado_em || Number.isNaN(new Date(p.registrado_em).getTime())) {
    return { valida: false, motivo: 'Horario da leitura ausente ou invalido.' };
  }
  return { valida: true };
}

/**
 * Detecta salto impossivel entre a posicao anterior e a nova.
 * @returns {{suspeita:boolean, velocidade_kmh:number|null, motivo?:string}}
 */
function detectarSalto(anterior, atual) {
  if (!anterior) return { suspeita: false, velocidade_kmh: null };
  const distanciaKm = calcularDistanciaKm(anterior.lat, anterior.lng, atual.lat, atual.lng);
  if (distanciaKm === null) return { suspeita: false, velocidade_kmh: null };

  const horas =
    (new Date(atual.registrado_em).getTime() - new Date(anterior.registrado_em).getTime()) / 3600000;
  if (horas <= 0) {
    return { suspeita: true, velocidade_kmh: null, motivo: 'Leitura fora de ordem cronologica.' };
  }
  const velocidade = distanciaKm / horas;
  if (velocidade > LIMIARES.velocidadeMaximaKmh) {
    return {
      suspeita: true,
      velocidade_kmh: Number(velocidade.toFixed(1)),
      motivo: `Salto de ${distanciaKm.toFixed(1)} km em ${(horas * 60).toFixed(1)} min (${velocidade.toFixed(0)} km/h).`,
    };
  }
  return { suspeita: false, velocidade_kmh: Number(velocidade.toFixed(1)) };
}

/** Classifica a qualidade do ponto a partir da precisao informada. */
function classificarQualidade(precisaoM) {
  if (precisaoM === null || precisaoM === undefined) return 'boa';
  const p = Number(precisaoM);
  if (Number.isNaN(p)) return 'boa';
  return p <= LIMIARES.precisaoBoaM ? 'boa' : 'baixa';
}

/**
 * Status de rastreamento a partir da idade da ultima posicao (RNF10).
 * @param {string|Date|null} ultimaEm
 * @param {Date} [agora]
 * @returns {{status:'online'|'instavel'|'offline'|'sem_dados', idade_segundos:number|null}}
 */
function statusRastreamento(ultimaEm, agora) {
  if (!ultimaEm) return { status: 'sem_dados', idade_segundos: null };
  const ref = (agora || new Date()).getTime();
  const t = new Date(ultimaEm).getTime();
  if (Number.isNaN(t)) return { status: 'sem_dados', idade_segundos: null };
  const idade = Math.max(0, Math.round((ref - t) / 1000));
  if (idade <= LIMIARES.onlineSegundos) return { status: 'online', idade_segundos: idade };
  if (idade <= LIMIARES.instavelSegundos) return { status: 'instavel', idade_segundos: idade };
  return { status: 'offline', idade_segundos: idade };
}

/**
 * Avalia um ponto completo: validade + qualidade + salto em relacao ao anterior.
 * @returns {{aceita:boolean, qualidade:string, descartada:boolean, motivo:string|null,
 *            velocidade_estimada_kmh:number|null}}
 */
function avaliarPosicao(atual, anterior) {
  const validacao = validarPosicao(atual);
  if (!validacao.valida) {
    return {
      aceita: false,
      qualidade: 'suspeita',
      descartada: true,
      motivo: validacao.motivo,
      velocidade_estimada_kmh: null,
    };
  }
  const salto = detectarSalto(anterior, atual);
  if (salto.suspeita) {
    // Ponto guardado, porem marcado: o dado bruto continua auditavel.
    return {
      aceita: true,
      qualidade: 'suspeita',
      descartada: true,
      motivo: salto.motivo,
      velocidade_estimada_kmh: salto.velocidade_kmh,
    };
  }
  return {
    aceita: true,
    qualidade: classificarQualidade(atual.precisao_m),
    descartada: false,
    motivo: null,
    velocidade_estimada_kmh: salto.velocidade_kmh,
  };
}

module.exports = {
  LIMIARES,
  validarPosicao,
  detectarSalto,
  classificarQualidade,
  statusRastreamento,
  avaliarPosicao,
};
