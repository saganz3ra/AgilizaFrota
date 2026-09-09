/**
 * Ponto de entrada: sobe o servidor HTTP.
 *
 * Encerramento gracioso (RNF08): ao receber SIGTERM/SIGINT (deploy, restart
 * do orquestrador), o servidor para de aceitar novas conexoes, aguarda as
 * requisicoes em andamento terminarem e so entao fecha o pool do banco.
 * Isso evita respostas cortadas e transacoes interrompidas durante um deploy.
 */
const { app } = require('./app');
const { env } = require('./config/env');
const { pool } = require('./config/db');

const server = app.listen(env.port, () => {
  console.log(`Agiliza Frota API rodando na porta ${env.port} [${env.nodeEnv}]`);
});

let encerrando = false;

async function encerrar(sinal) {
  if (encerrando) return;
  encerrando = true;
  console.log(`\nRecebido ${sinal}. Encerrando com seguranca...`);

  // Prazo maximo para nao travar o deploy caso alguma conexao fique presa.
  const prazo = setTimeout(() => {
    console.error('Encerramento forcado (tempo limite excedido).');
    process.exit(1);
  }, 10000);

  server.close(async () => {
    try {
      await pool.end();
      console.log('Servidor e pool encerrados.');
    } catch (err) {
      console.error('Falha ao fechar o pool:', err.message);
    } finally {
      clearTimeout(prazo);
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));

// Falhas nao tratadas: registra antes de sair, para nao "morrer em silencio".
process.on('unhandledRejection', (motivo) => {
  console.error('Promise rejeitada sem tratamento:', motivo);
});

module.exports = { server };
