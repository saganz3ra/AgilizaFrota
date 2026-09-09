/**
 * Pool de conexoes com o PostgreSQL.
 *
 * Escalabilidade (RNF07) e disponibilidade (RNF08):
 *  - Tamanho do pool configuravel por ambiente (PG_POOL_MAX): permite crescer
 *    horizontalmente (varias instancias) sem estourar o limite do banco.
 *  - Timeouts explicitos: uma consulta travada nao pode prender a conexao
 *    indefinidamente e derrubar a API inteira.
 *  - Conexoes ociosas sao devolvidas, evitando vazamento em picos.
 */
const { Pool } = require('pg');
const { env } = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.isProduction ? { rejectUnauthorized: false } : false,
  max: env.pg.max,
  idleTimeoutMillis: env.pg.idleTimeoutMs,
  connectionTimeoutMillis: env.pg.connectionTimeoutMs,
  // Aborta consultas muito longas (protege contra travamento em cascata).
  statement_timeout: env.pg.statementTimeoutMs,
  query_timeout: env.pg.statementTimeoutMs,
});

pool.on('error', (err) => {
  // Erro em um client ocioso: registra e segue (o pool recria a conexao).
  console.error('Erro inesperado no pool do PostgreSQL:', err.message);
});

/**
 * Executa uma query no pool.
 * @param {string} text - SQL com placeholders ($1, $2, ...).
 * @param {Array} [params] - valores dos placeholders.
 */
function query(text, params) {
  return pool.query(text, params);
}

/** Verifica se o banco responde (usado nos health checks). */
async function verificarBanco() {
  const inicio = Date.now();
  await pool.query('SELECT 1');
  return { ok: true, latencia_ms: Date.now() - inicio };
}

module.exports = { pool, query, verificarBanco };
