/**
 * Notificacoes PUSH (Firebase Cloud Messaging).
 *
 * Complementa a tabela `notificacoes` (in-app): aqui o objetivo e alcancar o
 * MOTORISTA no aparelho, mesmo com o app fechado, quando ele e acionado
 * (RF07). Reaproveita o Firebase Admin ja usado para validar tokens.
 *
 * Tudo aqui e BEST-EFFORT: uma falha de push nunca deve quebrar o fluxo
 * principal (a atribuicao ja foi gravada). Por isso o chamador usa
 * `.catch(() => {})` e este modulo engole erros de envio.
 */
const { query } = require('../config/db');
const { getFirebaseAdmin } = require('../config/firebase');

/** Registra (ou atualiza o dono de) um token de push. */
async function registrarDispositivo(usuarioId, token, plataforma) {
  await query(
    `INSERT INTO dispositivos_fcm (usuario_id, token, plataforma)
     VALUES ($1, $2, $3)
     ON CONFLICT (token)
       DO UPDATE SET usuario_id = EXCLUDED.usuario_id,
                     plataforma = EXCLUDED.plataforma,
                     atualizado_em = CURRENT_TIMESTAMP`,
    [usuarioId, token, plataforma || null],
  );
}

/** Remove um token (ao desativar as notificacoes ou sair). */
async function removerDispositivo(token) {
  await query('DELETE FROM dispositivos_fcm WHERE token = $1', [token]);
}

async function tokensDoUsuario(usuarioId) {
  const { rows } = await query(
    'SELECT token FROM dispositivos_fcm WHERE usuario_id = $1',
    [usuarioId],
  );
  return rows.map((r) => r.token);
}

/**
 * Envia uma notificacao para TODOS os aparelhos de um usuario.
 * No-op silencioso quando o Firebase nao esta configurado ou nao ha tokens.
 */
async function enviarPara(usuarioId, { titulo, corpo, dados }) {
  const admin = getFirebaseAdmin();
  if (!admin) return;

  const tokens = await tokensDoUsuario(usuarioId);
  if (tokens.length === 0) return;

  const resposta = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: titulo, body: corpo },
    // `data` do FCM so aceita strings.
    data: dados || {},
    // priority high para acordar o aparelho num acionamento de emergencia.
    android: { priority: 'high' },
  });

  // Limpa tokens que o FCM reportou como invalidos/expirados, para a tabela
  // nao acumular lixo (e nao gastar envios).
  resposta.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error && r.error.code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    ) {
      removerDispositivo(tokens[i]).catch(() => {});
    }
  });
}

/**
 * Push ao motorista recem-acionado. Chamado pelo controller de atribuicao
 * (RF07), fora da transacao e sem bloquear a resposta.
 */
async function notificarNovaAtribuicao(motoristaId, chamado) {
  if (!motoristaId || !chamado) return;
  const corpo = `${chamado.natureza || 'Chamado'} - prioridade ${chamado.prioridade || ''}`.trim();
  await enviarPara(motoristaId, {
    titulo: 'Novo acionamento',
    corpo,
    dados: { tipo: 'atribuicao', chamado_id: String(chamado.id) },
  });
}

module.exports = {
  registrarDispositivo,
  removerDispositivo,
  tokensDoUsuario,
  enviarPara,
  notificarNovaAtribuicao,
};
