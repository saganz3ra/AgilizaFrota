/**
 * Diagnostico de login: replica o que o backend faz em GET /auth/me e mostra
 * a verdade do Firebase + banco, para descobrir por que um login e recusado.
 *
 * Uso: npm run diagnostico -- "email-de-login@exemplo.com"
 */
require('dotenv').config();
const path = require('path');
const { pool } = require('../config/db');
const { getFirebaseAdmin, obterUidPorEmail } = require('../config/firebase');
const { env } = require('../config/env');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  console.log('===== Diagnostico Agiliza Frota =====\n');

  // 1. Firebase Admin
  const admin = getFirebaseAdmin();
  let projectId = '(desconhecido)';
  if (!admin) {
    console.log('Firebase Admin: NAO configurado (firebase-key.json ausente em', env.firebaseKeyPath + ').');
  } else {
    try {
      const key = require(path.resolve(process.cwd(), env.firebaseKeyPath));
      projectId = key.project_id;
      console.log('Firebase Admin: OK | project_id =', projectId);
    } catch {
      console.log('Firebase Admin: inicializado (nao foi possivel ler o project_id do arquivo).');
    }
  }

  // 2. Banco
  try {
    const t = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
    console.log('Banco: OK | total de usuarios =', t.rows[0].n);
  } catch (e) {
    console.log('Banco: FALHA ->', e.message);
    console.log('Verifique se o PostgreSQL esta rodando e se rodou "npm run migrate".');
    await pool.end();
    process.exit(1);
  }

  const centrais = await pool.query(
    "SELECT email, ativo, firebase_uid FROM usuarios WHERE papel = 'central' ORDER BY email",
  );
  console.log(`\nOperadores 'central' no banco: ${centrais.rows.length}`);
  centrais.rows.forEach((r) =>
    console.log(`  - ${r.email} | ativo: ${r.ativo} | firebase_uid: ${r.firebase_uid}`),
  );

  if (!email) {
    console.log('\n(Passe um e-mail para uma verificacao detalhada: npm run diagnostico -- "email")');
    await pool.end();
    process.exit(0);
  }

  console.log(`\n--- Verificando o e-mail: ${email} ---`);
  let uid = null;
  if (admin) {
    try {
      uid = await obterUidPorEmail(email);
    } catch (e) {
      console.log('Erro ao consultar o Firebase:', e.message);
    }
  }
  console.log('UID no Firebase:', uid || '(nao encontrado neste projeto)');

  const porEmail = await pool.query(
    'SELECT id, papel, ativo, firebase_uid FROM usuarios WHERE email = $1',
    [email],
  );
  console.log('Registro por e-mail no banco:', porEmail.rows[0] || '(nenhum)');

  let porUid = { rows: [] };
  if (uid) {
    porUid = await pool.query(
      'SELECT id, papel, ativo, email FROM usuarios WHERE firebase_uid = $1',
      [uid],
    );
    console.log('Registro por firebase_uid no banco:', porUid.rows[0] || '(nenhum)');
  }

  console.log('\n===== VEREDITO =====');
  if (!uid) {
    console.log('CAUSA: este e-mail NAO existe no Firebase do projeto', projectId + '.');
    console.log('  -> O apiKey do FRONT (.env.local) pode ser de OUTRO projeto. Front e backend');
    console.log('     precisam usar o MESMO projeto Firebase.');
  } else if (porUid.rows.length === 0) {
    console.log('CAUSA: nao ha registro no banco com esse firebase_uid.');
    console.log(`  -> Rode: npm run criar-central -- "${email}" "umaSenha123" "Administrador"`);
  } else if (!porUid.rows[0].ativo) {
    console.log('CAUSA: o usuario existe mas esta INATIVO.');
    console.log(`  -> Rode: npm run criar-central -- "${email}" "x" "Administrador" (reativa e garante central)`);
  } else if (porUid.rows[0].papel !== 'central') {
    console.log(`CAUSA: o papel e '${porUid.rows[0].papel}', deveria ser 'central'.`);
    console.log(`  -> Rode: npm run criar-central -- "${email}" "x" "Administrador"`);
  } else {
    console.log("TUDO CERTO no banco: existe perfil 'central' ATIVO com o firebase_uid correto.");
    console.log('  -> Se o login ainda falha, o problema esta na conexao front<->backend:');
    console.log('     1) O backend (npm run dev) esta rodando na porta 3000?');
    console.log('     2) Reinicie o backend (para recarregar a chave do Firebase).');
    console.log('     3) No navegador, DevTools > Network > requisicao "me": veja o status real.');
  }

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Erro inesperado:', err.message);
  try {
    await pool.end();
  } catch {
    /* ignora */
  }
  process.exit(1);
});
