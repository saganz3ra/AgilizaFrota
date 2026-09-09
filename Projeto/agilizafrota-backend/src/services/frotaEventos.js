/**
 * Barramento SSE do monitoramento da frota (RF11).
 * Separado do barramento de chamados para que a central possa assinar
 * apenas o mapa (posicoes) sem receber o fluxo de alertas, e vice-versa.
 */
const clientes = new Set();

function adicionarCliente(res) {
  clientes.add(res);
  res.on('close', () => clientes.delete(res));
}

function removerCliente(res) {
  clientes.delete(res);
}

function publicar(evento, dados) {
  const payload = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  for (const res of clientes) {
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
