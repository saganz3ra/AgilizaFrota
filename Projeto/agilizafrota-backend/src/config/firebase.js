/**
 * Inicializacao do Firebase Admin SDK.
 *
 * O backend NAO gerencia senhas: ele apenas valida os ID tokens emitidos
 * pelo Firebase Authentication (RF01) e cruza o UID com a tabela "usuarios".
 *
 * A chave de servico e lida do caminho definido em FIREBASE_KEY_PATH.
 * Se o arquivo nao existir, a aplicacao ainda sobe, mas qualquer rota
 * protegida respondera 503 (ver authMiddleware).
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { env } = require('./env');

let inicializado = false;

function initFirebase() {
  if (inicializado || admin.apps.length > 0) {
    inicializado = true;
    return admin;
  }

  const keyPath = path.resolve(process.cwd(), env.firebaseKeyPath);

  if (!fs.existsSync(keyPath)) {
    console.warn(
      `[firebase] Chave de servico nao encontrada em "${keyPath}". ` +
        'Rotas protegidas ficarao indisponiveis (503) ate a chave ser adicionada.',
    );
    return null;
  }

  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  inicializado = true;
  console.log('[firebase] Firebase Admin inicializado com sucesso.');
  return admin;
}

/** Retorna a instancia admin inicializada, ou null se a chave nao existe. */
function getFirebaseAdmin() {
  return initFirebase();
}

/** Lanca um erro padronizado quando o Firebase nao esta configurado. */
function exigirFirebase() {
  const admin = initFirebase();
  if (!admin) {
    const err = new Error('Servico de autenticacao indisponivel (chave do Firebase ausente).');
    err.statusCode = 503;
    err.codigo = 'FIREBASE_INDISPONIVEL';
    err.isOperational = true;
    throw err;
  }
  return admin;
}

/**
 * Cria um usuario no Firebase Authentication (fluxo administrativo).
 * Retorna o uid gerado.
 */
async function criarUsuarioFirebase({ email, senha, nome }) {
  const admin = exigirFirebase();
  const userRecord = await admin.auth().createUser({
    email,
    password: senha,
    displayName: nome,
  });
  return userRecord.uid;
}

/** Busca o UID de um usuario existente pelo e-mail. Retorna null se nao existir. */
async function obterUidPorEmail(email) {
  const admin = exigirFirebase();
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return userRecord.uid;
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') return null;
    throw err;
  }
}

/** Remove um usuario do Firebase (usado em rollback de cadastro). Best-effort. */
async function removerUsuarioFirebase(uid) {
  const admin = initFirebase();
  if (!admin) return;
  try {
    await admin.auth().deleteUser(uid);
  } catch (_err) {
    // rollback best-effort: nao propaga
  }
}

module.exports = {
  getFirebaseAdmin,
  exigirFirebase,
  criarUsuarioFirebase,
  obterUidPorEmail,
  removerUsuarioFirebase,
};
