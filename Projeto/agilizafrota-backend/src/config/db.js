/**
 * Pool de conexoes com o PostgreSQL.
 *
 * Exporta:
 *  - pool: instancia do pool (para transacoes com client dedicado).
 *  - query: helper para consultas simples.
 */
const { Pool } = require('pg');
const { env } = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  // Em producao, muitos provedores de Postgres exigem SSL.
  ssl: env.isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Erro em um client ocioso do pool: registra e evita derrubar o processo.
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

module.exports = { pool, query };
