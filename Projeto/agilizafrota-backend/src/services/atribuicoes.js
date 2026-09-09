/**
 * Regras compartilhadas de atribuicao de chamados (RF07).
 * Usado pelo controller de atribuicao e pelo cancelamento de chamados
 * (um chamado cancelado precisa liberar o veiculo que estava acionado).
 */
const { query } = require('../config/db');

const COLS = `id, chamado_id, veiculo_id, motorista_id, turno_id, atribuido_por,
              origem, status, motivo_cancelamento, atribuido_em, encerrado_em,
              criado_em, atualizado_em`;

/** Retorna a atribuicao ativa de um chamado, ou null. */
async function buscarAtiva(chamadoId) {
  const { rows } = await query(
    `SELECT ${COLS} FROM atribuicoes WHERE chamado_id = $1 AND status = 'ativa'`,
    [chamadoId],
  );
  return rows[0] || null;
}

/**
 * Cancela a atribuicao ativa do chamado (se houver) e devolve o veiculo para
 * "disponivel". Deve ser chamada DENTRO de uma transacao (recebe o client).
 * @returns {object|null} a atribuicao cancelada.
 */
async function cancelarAtivaNaTransacao(client, chamadoId, motivo) {
  const { rows } = await client.query(
    `UPDATE atribuicoes
        SET status = 'cancelada',
            motivo_cancelamento = $2,
            encerrado_em = CURRENT_TIMESTAMP
      WHERE chamado_id = $1 AND status = 'ativa'
      RETURNING ${COLS}`,
    [chamadoId, motivo || null],
  );
  const atribuicao = rows[0] || null;
  if (atribuicao) {
    await client.query(
      "UPDATE veiculos SET status = 'disponivel' WHERE id = $1 AND status = 'em_uso'",
      [atribuicao.veiculo_id],
    );
  }
  return atribuicao;
}

/** Traduz violacao de indice unico parcial (23505) em erro 409 amigavel. */
function traduzirConflitoAtribuicao(err) {
  if (!err || err.code !== '23505') return null;
  const alvo = `${err.constraint || ''} ${err.detail || ''} ${err.message || ''}`;
  const { AppError } = require('../utils/AppError');
  if (/chamado/i.test(alvo)) {
    return new AppError(409, 'Este chamado ja foi atribuido por outro operador.', 'CHAMADO_JA_ATRIBUIDO');
  }
  if (/veiculo/i.test(alvo)) {
    return new AppError(409, 'Este veiculo acabou de ser acionado para outro chamado.', 'VEICULO_JA_ATRIBUIDO');
  }
  return new AppError(409, 'Conflito de concorrencia na atribuicao.', 'CONFLITO');
}

module.exports = { COLS, buscarAtiva, cancelarAtivaNaTransacao, traduzirConflitoAtribuicao };
