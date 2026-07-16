/**
 * Barramento de eventos em tempo real dos chamados (RF06) via SSE.
 *
 * Mantem um registro de clientes (respostas HTTP mantidas abertas) e publica
 * eventos para todos eles. Suporta multiplas centrais conectadas ao mesmo
 * tempo (RNF05). O disparo sonoro/visual em si e responsabilidade do front,
 * ao receber o evento "chamado:novo".
 */
const clientes = new Set();

/** Registra uma resposta HTTP como assinante do stream e trata a desconexao. */
function adicionarCliente(res) {
  clientes.add(res);
  res.on('close', () => clientes.delete(res));
}

/** Remove um assinante explicitamente. */
function removerCliente(res) {
  clientes.delete(res);
}

/**
 * Publica um evento para todos os assinantes conectados.
 * @param {string} evento - nome do evento SSE (ex.: 'chamado:novo').
 * @param {object} dados - payload serializavel.
 */
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

/** Numero de assinantes conectados (util para diagnostico/testes). */
function totalClientes() {
  return clientes.size;
}

module.exports = { adicionarCliente, removerCliente, publicar, totalClientes };
