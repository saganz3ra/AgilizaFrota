/**
 * Limpeza de dados de teste - APENAS DESENVOLVIMENTO.
 *
 * Por que este script existe fora da API:
 *
 * O Agiliza Frota nao expoe nenhum endpoint de exclusao, e isso e uma
 * decisao de projeto, nao um esquecimento. O sistema veio substituir a
 * ficha de papel SEM perder o rastro (RF12/RF14); um turno que pode ser
 * apagado e indistinguivel de um turno que nunca existiu, e a auditoria
 * perde o sentido. Para dados pessoais, a saida legitima e a anonimizacao
 * da LGPD (`POST /api/lgpd/usuarios/:id/anonimizar`), que remove a
 * identificacao e preserva o registro operacional.
 *
 * Durante o desenvolvimento, porem, acumula-se lixo de teste - turnos
 * abertos por engano, chamados de experimento - que nao tem valor
 * historico nenhum. Este script serve a esse caso e so a ele.
 *
 * Salvaguardas:
 *  - recusa-se a rodar com NODE_ENV=production;
 *  - exige confirmacao digitada (ou a flag --sim);
 *  - preserva os CADASTROS (unidades, veiculos, usuarios): eles custam a
 *    recriar e nao sao o que polui os testes;
 *  - roda em transacao unica: ou limpa tudo, ou nao muda nada.
 *
 * Uso:
 *   npm run limpar-dev
 *   npm run limpar-dev -- --sim          (sem perguntar)
 *   npm run limpar-dev -- --com-fotos    (apaga tambem as imagens enviadas)
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { env } = require('../config/env');
const { pool } = require('../config/db');
const { PASTA_UPLOADS } = require('../config/uploads');

// Ordem importa: filhos antes dos pais, para nao violar chave estrangeira.
const TABELAS = [
  { nome: 'notificacoes', descricao: 'notificacoes de chegada' },
  { nome: 'posicoes', descricao: 'posicoes de GPS' },
  { nome: 'atendimentos', descricao: 'atendimentos' },
  { nome: 'atribuicoes', descricao: 'acionamentos' },
  { nome: 'chamados', descricao: 'chamados' },
  { nome: 'checklists', descricao: 'checklists' },
  { nome: 'turnos', descricao: 'turnos' },
  { nome: 'auditoria', descricao: 'registros de auditoria' },
  { nome: 'consentimentos', descricao: 'consentimentos de LGPD' },
];

// Estes NAO sao tocados.
const PRESERVADAS = ['unidades', 'veiculos', 'usuarios', 'migrations'];

function perguntar(texto) {
  const io = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    io.question(texto, (resposta) => {
      io.close();
      resolve(resposta.trim());
    }),
  );
}

/** Quantas linhas existem hoje em cada tabela. */
async function contar(client) {
  const contagem = [];
  for (const tabela of TABELAS) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${tabela.nome}`);
    contagem.push({ ...tabela, total: rows[0].n });
  }
  return contagem;
}

/** Remove as imagens enviadas (evidencias dos turnos apagados). */
function limparFotos() {
  if (!fs.existsSync(PASTA_UPLOADS)) return 0;
  let removidas = 0;
  for (const pasta of fs.readdirSync(PASTA_UPLOADS)) {
    const caminho = path.join(PASTA_UPLOADS, pasta);
    if (!fs.statSync(caminho).isDirectory()) continue;
    for (const arquivo of fs.readdirSync(caminho)) {
      fs.unlinkSync(path.join(caminho, arquivo));
      removidas += 1;
    }
    fs.rmdirSync(caminho);
  }
  return removidas;
}

async function principal() {
  const argumentos = process.argv.slice(2);
  const semPerguntar = argumentos.includes('--sim');
  const comFotos = argumentos.includes('--com-fotos');

  if (env.isProduction) {
    console.error('\nRECUSADO: este script nao roda com NODE_ENV=production.');
    console.error('Ele apaga dados operacionais e nao tem volta.\n');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log('\n=== Limpeza de dados de teste (desenvolvimento) ===\n');
    console.log(`Banco: ${env.databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`);

    const contagem = await contar(client);
    const total = contagem.reduce((soma, t) => soma + t.total, 0);

    console.log('Sera APAGADO:');
    for (const t of contagem) {
      console.log(`  ${String(t.total).padStart(6)}  ${t.descricao}`);
    }
    console.log(`  ${String(total).padStart(6)}  registros no total\n`);
    console.log(`Sera PRESERVADO: ${PRESERVADAS.slice(0, 3).join(', ')}.\n`);

    if (total === 0 && !comFotos) {
      console.log('Nada a limpar. O banco ja esta sem dados operacionais.\n');
      return;
    }

    if (!semPerguntar) {
      const resposta = await perguntar('Digite "limpar" para confirmar: ');
      if (resposta.toLowerCase() !== 'limpar') {
        console.log('\nCancelado. Nada foi alterado.\n');
        return;
      }
    }

    // Tudo numa transacao: uma falha no meio nao deixa o banco pela metade.
    await client.query('BEGIN');
    for (const tabela of TABELAS) {
      const resultado = await client.query(`DELETE FROM ${tabela.nome}`);
      console.log(`  removidos ${String(resultado.rowCount).padStart(6)} de ${tabela.nome}`);
    }

    // Os veiculos ficam, mas voltam ao estado de repouso: sem turno, nao
    // faz sentido nenhum continuarem "em_uso".
    const veiculos = await client.query(
      "UPDATE veiculos SET status = 'disponivel' WHERE status = 'em_uso'",
    );
    console.log(`  ${veiculos.rowCount} veiculo(s) devolvido(s) para "disponivel"`);

    await client.query('COMMIT');

    if (comFotos) {
      const fotos = limparFotos();
      console.log(`  ${fotos} foto(s) removida(s) de uploads/`);
    }

    console.log('\nConcluido. Cadastros de unidades, veiculos e usuarios preservados.\n');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFalhou. Nada foi alterado.\n', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

principal();
