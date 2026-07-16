/**
 * Seed de dados minimos para desenvolvimento/demonstracao.
 *
 * Cria uma unidade hospitalar de exemplo (usada, por exemplo, para permitir
 * o cadastro de um recepcionista). Idempotente: nao duplica se ja existir.
 *
 * Observacao: nao cria usuarios aqui, pois cada usuario depende de um
 * firebase_uid real gerado no Firebase Authentication. O primeiro operador
 * "central" e criado via rota POST /api/auth/bootstrap (ver README).
 *
 * Uso: npm run seed
 */
require('dotenv').config();
const { pool } = require('../config/db');

async function seed() {
  const client = await pool.connect();
  try {
    const nomeUnidade = 'Unidade Central - Guarapuava';
    const { rows } = await client.query(
      'SELECT id FROM unidades WHERE nome = $1 LIMIT 1',
      [nomeUnidade],
    );

    if (rows.length > 0) {
      console.log(`Unidade de exemplo ja existe (id: ${rows[0].id}).`);
      return;
    }

    const insert = await client.query(
      `INSERT INTO unidades (nome, endereco, cidade, lat, lng)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        nomeUnidade,
        'Rua Comendador Norberto, 1299 - Santa Cruz',
        'Guarapuava',
        -25.395700,
        -51.457700,
      ],
    );

    console.log(`Unidade de exemplo criada (id: ${insert.rows[0].id}).`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Erro ao executar seed:', err.message);
  process.exit(1);
});
