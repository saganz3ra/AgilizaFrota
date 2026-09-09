/**
 * Carrega e valida as variaveis de ambiente uma unica vez.
 * Falha rapido (fail-fast) se algo essencial estiver ausente.
 */
require('dotenv').config();

function required(nome) {
  const valor = process.env[nome];
  if (!valor || valor.trim() === '') {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }
  return valor;
}

function optional(nome, padrao) {
  const valor = process.env[nome];
  return valor === undefined || valor.trim() === '' ? padrao : valor;
}

const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),

  databaseUrl: required('DATABASE_URL'),

  corsOrigins: optional('CORS_ORIGINS', '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  firebaseKeyPath: optional('FIREBASE_KEY_PATH', './firebase-key.json'),

  bootstrapSecret: optional('BOOTSTRAP_SECRET', ''),

  // Chave de servico para o "sistema externo" (ex.: regulacao/SAMU) abrir chamados.
  externalApiKey: optional('EXTERNAL_API_KEY', ''),

  // Pool e timeouts do banco (RNF07 escalabilidade / RNF08 disponibilidade).
  pg: {
    max: parseInt(optional('PG_POOL_MAX', '10'), 10),
    idleTimeoutMs: parseInt(optional('PG_IDLE_TIMEOUT_MS', '30000'), 10),
    connectionTimeoutMs: parseInt(optional('PG_CONNECTION_TIMEOUT_MS', '5000'), 10),
    statementTimeoutMs: parseInt(optional('PG_STATEMENT_TIMEOUT_MS', '15000'), 10),
  },

  authRateLimit: {
    windowMin: parseInt(optional('AUTH_RATE_LIMIT_WINDOW_MIN', '15'), 10),
    max: parseInt(optional('AUTH_RATE_LIMIT_MAX', '50'), 10),
  },

  // Rate limit global (RNF01): teto amplo, so barra abuso automatizado.
  rateLimitGlobal: {
    windowMin: parseInt(optional('RATE_LIMIT_WINDOW_MIN', '1'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX', '300'), 10),
  },
};

env.isProduction = env.nodeEnv === 'production';

/**
 * Verificacoes de seguranca na inicializacao (RNF01).
 * Em producao, segredos fracos ou ausentes sao ERRO; em desenvolvimento,
 * apenas avisos - para nao atrapalhar quem esta comecando.
 */
function verificarSegredos() {
  const problemas = [];
  const fracos = ['troque-por-um-segredo-forte', 'troque-por-uma-chave-forte', '123456', 'segredo'];

  if (env.bootstrapSecret && fracos.includes(env.bootstrapSecret)) {
    problemas.push('BOOTSTRAP_SECRET esta com o valor de exemplo.');
  }
  if (env.externalApiKey && fracos.includes(env.externalApiKey)) {
    problemas.push('EXTERNAL_API_KEY esta com o valor de exemplo.');
  }
  if (env.externalApiKey && env.externalApiKey.length > 0 && env.externalApiKey.length < 16) {
    problemas.push('EXTERNAL_API_KEY e curta demais (use ao menos 16 caracteres).');
  }
  if (env.isProduction && env.corsOrigins.includes('*')) {
    problemas.push('CORS_ORIGINS="*" nao deve ser usado em producao.');
  }

  if (problemas.length === 0) return;
  const texto = problemas.map((p) => `  - ${p}`).join('\n');
  if (env.isProduction) {
    throw new Error(`Configuracao insegura em producao:\n${texto}`);
  }
  console.warn(`[seguranca] Avisos de configuracao (ok em desenvolvimento):\n${texto}`);
}

verificarSegredos();

env.verificarSegredos = verificarSegredos;

module.exports = { env };
