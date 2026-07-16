/**
 * Ponto de entrada: sobe o servidor HTTP.
 */
const { app } = require('./app');
const { env } = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`Agiliza Frota API rodando na porta ${env.port} [${env.nodeEnv}]`);
});

// Encerramento gracioso.
function encerrar(sinal) {
  console.log(`\nRecebido ${sinal}. Encerrando servidor...`);
  server.close(() => {
    console.log('Servidor encerrado.');
    process.exit(0);
  });
}

process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));

module.exports = { server };
