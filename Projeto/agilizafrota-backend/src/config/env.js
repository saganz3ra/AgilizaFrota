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

  authRateLimit: {
    windowMin: parseInt(optional('AUTH_RATE_LIMIT_WINDOW_MIN', '15'), 10),
    max: parseInt(optional('AUTH_RATE_LIMIT_MAX', '50'), 10),
  },
};

env.isProduction = env.nodeEnv === 'production';

module.exports = { env };
