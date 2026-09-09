/**
 * Calculo das metricas de um atendimento (RNF09 - precisao dos calculos).
 *
 * Funcoes PURAS: nao acessam banco nem relogio, o que permite testar cada
 * regra isoladamente e garante que o mesmo atendimento sempre produza o
 * mesmo resultado (requisito de precisao e de auditoria).
 *
 * Convencoes de arredondamento (documentadas para o TCC):
 *  - Distancias: inteiros, em km, pela diferenca da quilometragem do painel.
 *  - Tempos: minutos inteiros, arredondados pelo padrao "meio para cima"
 *    (Math.round), a partir da diferenca entre os horarios dos marcos.
 *  - Marco ausente => metrica correspondente fica null (nunca zero), para
 *    nao confundir "nao aconteceu" com "levou 0 minutos".
 */

/** Diferenca em minutos entre dois instantes ISO/Date. Retorna null se faltar algum. */
function diferencaMinutos(inicio, fim) {
  if (!inicio || !fim) return null;
  const t1 = new Date(inicio).getTime();
  const t2 = new Date(fim).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  return Math.round((t2 - t1) / 60000);
}

/** Diferenca de quilometragem. Retorna null se faltar algum valor. */
function diferencaKm(de, ate) {
  if (de === null || de === undefined || ate === null || ate === undefined) return null;
  const a = Number(de);
  const b = Number(ate);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

/**
 * Calcula todas as metricas derivadas de um atendimento.
 * @param {object} at - marcos do atendimento (km_* e *_em).
 */
function calcularMetricas(at) {
  const distancia_ate_local_km = diferencaKm(at.km_saida, at.km_local);
  const distancia_transporte_km = diferencaKm(at.km_local ?? at.km_saida, at.km_final);
  const distancia_total_km = diferencaKm(at.km_saida, at.km_final);

  const tempo_resposta_min = diferencaMinutos(at.inicio_em, at.chegada_local_em);
  const tempo_no_local_min = diferencaMinutos(at.chegada_local_em, at.inicio_transporte_em);
  const tempo_transporte_min = diferencaMinutos(at.inicio_transporte_em ?? at.chegada_local_em, at.fim_em);
  const tempo_total_min = diferencaMinutos(at.inicio_em, at.fim_em);

  return {
    distancia_total_km,
    distancia_ate_local_km,
    distancia_transporte_km,
    tempo_resposta_min,
    tempo_no_local_min,
    tempo_transporte_min,
    tempo_total_min,
  };
}

/**
 * Verifica a consistencia dos dados informados (RNF09 / apoio ao RF10).
 * Nao lanca erro: devolve a lista de problemas para que a central decida
 * (validar mesmo assim, corrigir ou rejeitar).
 * @returns {{ consistente: boolean, problemas: string[] }}
 */
function verificarConsistencia(at) {
  const problemas = [];

  // Quilometragem nao pode retroceder.
  if (at.km_local !== null && at.km_local !== undefined && at.km_local < at.km_saida) {
    problemas.push('Quilometragem de chegada ao local menor que a de saida.');
  }
  if (at.km_final !== null && at.km_final !== undefined) {
    const referencia = at.km_local ?? at.km_saida;
    if (at.km_final < referencia) {
      problemas.push('Quilometragem final menor que a do marco anterior.');
    }
  }

  // Horarios devem seguir a ordem dos marcos.
  const sequencia = [
    ['inicio_em', at.inicio_em],
    ['chegada_local_em', at.chegada_local_em],
    ['inicio_transporte_em', at.inicio_transporte_em],
    ['fim_em', at.fim_em],
  ].filter(([, v]) => Boolean(v));
  for (let i = 1; i < sequencia.length; i += 1) {
    const anterior = new Date(sequencia[i - 1][1]).getTime();
    const atual = new Date(sequencia[i][1]).getTime();
    if (atual < anterior) {
      problemas.push(`Horario de "${sequencia[i][0]}" anterior a "${sequencia[i - 1][0]}".`);
    }
  }

  // Velocidade media implausivel indica erro de digitacao na quilometragem.
  const m = calcularMetricas(at);
  if (m.distancia_total_km !== null && m.tempo_total_min && m.tempo_total_min > 0) {
    const velocidadeKmH = (m.distancia_total_km / m.tempo_total_min) * 60;
    if (velocidadeKmH > 150) {
      problemas.push(
        `Velocidade media implausivel (${velocidadeKmH.toFixed(0)} km/h) - confira a quilometragem.`,
      );
    }
  }

  return { consistente: problemas.length === 0, problemas };
}

module.exports = { diferencaMinutos, diferencaKm, calcularMetricas, verificarConsistencia };
