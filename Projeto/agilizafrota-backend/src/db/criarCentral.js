/**
 * Cria (ou repara) o operador "central" administrador.
 *
 * Idempotente e robusto:
 *   1. Se a conta ja existe no Firebase, reaproveita o UID; senao, cria a conta.
 *   2. Garante o registro no banco com papel = 'central':
 *      - se nao existe, insere;
 *      - se existe com outro papel/inativo, promove para central e reativa.
 *
 * Uso:
 *   npm run criar-central -- "email@exemplo.com" "senhaForte" "Nome do Operador"
 *
 * Obs.: se a conta ja existir no Firebase, a senha informada e ignorada
 * (a senha atual e mantida). Requer firebase-key.json e DATABASE_URL.
 */
require('dotenv').config();
const { pool } = require('../config/db');
const {
  criarUsuarioFirebase,
  obterUidPorEmail,
  getFirebaseAdmin,
} = require('../config/firebase');

async function main() {
  const [emailArg, senha, ...nomePartes] = process.argv.slice(2);
  const email = (emailArg || '').trim().toLowerCase();
  const nome = nomePartes.join(' ').trim();

  if (!email || !senha || !nome) {
    console.error('Uso: npm run criar-central -- "email" "senha" "Nome do Operador"');
    process.exit(1);
  }

  if (!getFirebaseAdmin()) {
    console.error('Firebase Admin nao configurado. Verifique o firebase-key.json (FIREBASE_KEY_PATH).');
    process.exit(1);
  }

  // 1. Descobre/gera o UID no Firebase.
  let uid = await obterUidPorEmail(email);
  if (uid) {
    console.log(`Conta ja existe no Firebase (uid ${uid}); reaproveitando.`);
  } else {
    if (senha.length < 6) {
      console.error('Para criar uma nova conta, a senha deve ter ao menos 6 caracteres.');
      await pool.end();
      process.exit(1);
    }
    uid = await criarUsuarioFirebase({ email, senha, nome });
    console.log(`Conta criada no Firebase (uid ${uid}).`);
  }

  // 2. Garante o perfil no banco.
  const existente = await pool.query(
    'SELECT id, papel, ativo FROM usuarios WHERE firebase_uid = $1 OR email = $2',
    [uid, email],
  );

  let resultado;
  if (existente.rows.length === 0) {
    resultado = await pool.query(
      `INSERT INTO usuarios (firebase_uid, nome, email, papel)
       VALUES ($1, $2, $3, 'central')
       RETURNING id, email, papel, ativo`,
      [uid, nome, email],
    );
    console.log('Perfil central criado no banco.');
  } else {
    resultado = await pool.query(
      `UPDATE usuarios
          SET papel = 'central', ativo = TRUE, firebase_uid = $1
        WHERE id = $2
        RETURNING id, email, papel, ativo`,
      [uid, existente.rows[0].id],
    );
    console.log('Perfil ja existia; promovido/garantido como central ativo.');
  }

  const u = resultado.rows[0];
  console.log('\nOperador central pronto:');
  console.log(`  id:    ${u.id}`);
  console.log(`  email: ${u.email}`);
  console.log(`  papel: ${u.papel}  (ativo: ${u.ativo})`);
  console.log('\nJa e possivel entrar no painel web com esse e-mail e senha.');

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Erro:', err.message);
  try {
    await pool.end();
  } catch {
    /* ignora */
  }
  process.exit(1);
});
