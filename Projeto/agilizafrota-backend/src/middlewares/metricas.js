/**
 * Medicao do tempo de resposta (RNF06).
 *
 * "Garantir tempo de resposta adequado, especialmente para operacoes
 * criticas" so pode ser afirmado se for MEDIDO. Este middleware:
 *  - mede a duracao de cada requisicao e devolve no cabecalho
 *    `X-Response-Time` (visivel no DevTools e em testes de carga);
 *  - acumula estatisticas por rota em memoria (p50/p95/p99), expostas em
 *    `GET /api/metricas` para acompanhar a evolucao e alimentar os testes
 *    de carga da Sprint 12;
 *  - marca no log as requisicoes acima do limite considerado aceitavel.
 *
 * Guarda apenas as ultimas N amostras por rota: custo de memoria previsivel
 * e sem dependencia externa.
 */
const AMOSTRAS_POR_ROTA = Number(process.env.METRICAS_AMOSTRAS || 200);
const LIMITE_LENTO_MS = Number(process.env.METRICAS_LIMITE_LENTO_MS || 1000);

// rota -> { amostras:[], total, lentas, erros, ultima_ms }
const registros = new Map();

/** Normaliza a rota para nao explodir a chave com UUIDs. */
function normalizarRota(metodo, caminho) {
  const semQuery = caminho.split('?')[0];
  const generico = semQuery.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:id',
  );
  return `${metodo} ${generico}`;
}

/** Percentil (interpolacao simples) sobre uma lista ordenada. */
function percentil(ordenadas, p) {
  if (ordenadas.length === 0) return null;
  const indice = Math.min(ordenadas.length - 1, Math.floor((p / 100) * ordenadas.length));
  return ordenadas[indice];
}

function registrar(chave, duracaoMs, statusCode) {
  let r = registros.get(chave);
  if (!r) {
    r = { amostras: [], total: 0, lentas: 0, erros: 0, ultima_ms: 0 };
    registros.set(chave, r);
  }
  r.amostras.push(duracaoMs);
  if (r.amostras.length > AMOSTRAS_POR_ROTA) r.amostras.shift();
  r.total += 1;
  r.ultima_ms = duracaoMs;
  if (duracaoMs > LIMITE_LENTO_MS) r.lentas += 1;
  if (statusCode >= 500) r.erros += 1;
}

/** Middleware: mede e anota o tempo de resposta. */
function medirTempo(req, res, next) {
  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const duracao = Number(process.hrtime.bigint() - inicio) / 1e6; // ms
    const arredondado = Math.round(duracao * 10) / 10;
    registrar(normalizarRota(req.method, req.originalUrl), arredondado, res.statusCode);
    if (arredondado > LIMITE_LENTO_MS) {
      console.warn(`[lento] ${req.method} ${req.originalUrl} levou ${arredondado} ms`);
    }
  });

  // Cabecalho precisa ser escrito antes do envio do corpo.
  const writeHeadOriginal = res.writeHead.bind(res);
  res.writeHead = (...args) => {
    const duracao = Number(process.hrtime.bigint() - inicio) / 1e6;
    if (!res.headersSent) res.setHeader('X-Response-Time', `${Math.round(duracao * 10) / 10}ms`);
    return writeHeadOriginal(...args);
  };

  next();
}

/** Estatisticas consolidadas por rota. */
function resumo() {
  const rotas = [];
  for (const [rota, r] of registros.entries()) {
    const ordenadas = [...r.amostras].sort((a, b) => a - b);
    rotas.push({
      rota,
      chamadas: r.total,
      p50_ms: percentil(ordenadas, 50),
      p95_ms: percentil(ordenadas, 95),
      p99_ms: percentil(ordenadas, 99),
      max_ms: ordenadas[ordenadas.length - 1] ?? null,
      lentas: r.lentas,
      erros_5xx: r.erros,
    });
  }
  rotas.sort((a, b) => (b.p95_ms || 0) - (a.p95_ms || 0));

  const todas = rotas.reduce((s, r) => s + r.chamadas, 0);
  return {
    limite_lento_ms: LIMITE_LENTO_MS,
    amostras_por_rota: AMOSTRAS_POR_ROTA,
    total_requisicoes: todas,
    rotas_monitoradas: rotas.length,
    requisicoes_lentas: rotas.reduce((s, r) => s + r.lentas, 0),
    rotas,
  };
}

/** Zera as estatisticas (util antes de um teste de carga). */
function zerar() {
  registros.clear();
}

module.exports = { medirTempo, resumo, zerar, normalizarRota, percentil };
