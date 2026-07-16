/**
 * Runner de migrations em SQL puro.
 *
 * - Le todos os arquivos .sql da pasta ./migrations em ordem alfabetica
 *   (por isso o prefixo numerico 001_, 002_, ...).
 * - Aplica apenas os que ainda nao foram registrados na tabela de controle
 *   "schema_migrations".
 * - Cada migration roda dentro de uma transacao; se falhar, faz rollback.
 *
 * Uso: npm run migrate
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureControlTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nome        VARCHAR(255) PRIMARY KEY,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getApplied(client) {
  const { rows } = await client.query('SELECT nome FROM schema_migrations');
  return new Set(rows.map((r) => r.nome));
}

async function run() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Pasta de migrations nao encontrada: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    await ensureControlTable(client);
    const applied = await getApplied(client);

    let executadas = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  - ${file} (ja aplicada, ignorando)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`  > aplicando ${file} ...`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [file]);
        await client.query('COMMIT');
        executadas += 1;
        console.log(`    OK: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`    FALHA em ${file}: ${err.message}`);
        throw err;
      }
    }

    console.log(
      executadas === 0
        ? 'Nenhuma migration pendente. Banco atualizado.'
        : `Concluido. ${executadas} migration(s) aplicada(s).`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Erro ao executar migrations:', err.message);
  process.exit(1);
});
