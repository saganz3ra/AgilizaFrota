/**
 * Barramento SSE das notificacoes (RF15).
 * Cada assinante e uma resposta HTTP aberta, associada ao usuario logado -
 * assim a recepcionista recebe apenas as notificacoes dela.
 */
const clientes = new Map(); // res -> usuarioId

function adicionarCliente(res, usuarioId) {
  clientes.set(res, usuarioId);
  res.on('close', () => clientes.delete(res));
}

function removerCliente(res) {
  clientes.delete(res);
}

/**
 * Publica para destinatarios especificos (ou para todos, se nao informado).
 * @param {string} evento
 * @param {object} dados
 * @param {string[]} [destinatarios] ids de usuario
 */
function publicar(evento, dados, destinatarios) {
  const payload = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  for (const [res, usuarioId] of clientes.entries()) {
    if (destinatarios && destinatarios.length > 0 && !destinatarios.includes(usuarioId)) continue;
    try {
      res.write(payload);
    } catch (_err) {
      clientes.delete(res);
    }
  }
}

function totalClientes() {
  return clientes.size;
}

module.exports = { adicionarCliente, removerCliente, publicar, totalClientes };
