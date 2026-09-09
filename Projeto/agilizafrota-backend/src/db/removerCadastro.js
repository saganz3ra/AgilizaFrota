/**
 * Remocao de CADASTROS de teste - APENAS DESENVOLVIMENTO.
 *
 * Complementa o `limpar-dev`, que apaga apenas dados operacionais. Aqui
 * vao embora os proprios cadastros: usuarios (por e-mail) e veiculos (por
 * placa).
 *
 * Duas particularidades que justificam um script em vez de um DELETE solto:
 *
 *  1. O usuario existe em DOIS lugares - na tabela `usuarios` e no Firebase
 *     Authentication. Apagar so a linha do banco deixa a conta orfa: a
 *     pessoa ainda consegue autenticar, mas recebe "usuario sem perfil no
 *     sistema" e ninguem entende o motivo. O script remove os dois lados.
 *
 *  2. Ha chaves estrangeiras SEM cascata apontando para esses cadastros
 *     (turnos, atendimentos, atribuicoes). Isso e proposital: o banco se
 *     recusa a apagar um motorista que tem historico, protegendo o RF12.
 *     O script detecta essas dependencias ANTES de tentar e explica o que
 *     fazer, em vez de despejar um erro de violacao de constraint.
 *
 * Em producao a remocao legitima de dados pessoais e a anonimizacao da
 * LGPD (`POST /api/lgpd/usuarios/:id/anonimizar`), que preserva o registro
 * operacional. Por isso este script se recusa a rodar la.
 *
 * Uso:
 *   npm run remover-cadastro -- --usuario a@x.com --usuario b@x.com
 *   npm run remover-cadastro -- --veiculo ABC1234 --veiculo ABF1234
 *   npm run remover-cadastro -- --usuario a@x.com --veiculo ABC1234 --sim
 */
const readline = require('readline');
const { env } = require('../config/env');
const { pool } = require('../config/db');
const { removerUsuarioFirebase } = require('../config/firebase');

/** Tabelas que impedem a remocao de um usuario, e o campo que aponta. */
const DEPENDENCIAS_USUARIO = [
  ['turnos', 'motorista_id'],
  ['checklists', 'motorista_id'],
  ['atendimentos', 'motorista_id'],
  ['atendimentos', 'validado_por'],
  ['atribuicoes', 'motorista_id'],
  ['atribuicoes', 'atribuido_por'],
  ['chamados', 'criado_por'],
  ['posicoes', 'motorista_id'],
];

const DEPENDENCIAS_VEICULO = [
  ['turnos', 'veiculo_id'],
  ['checklists', 'veiculo_id'],
  ['atendimentos', 'veiculo_id'],
  ['atribuicoes', 'veiculo_id'],
];

function lerArgumentos() {
  const args = process.argv.slice(2);
  const usuarios = [];
  const veiculos = [];
  let semPerguntar = false;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--usuario' && args[i + 1]) usuarios.push(args[i + 1].toLowerCase());
    if (args[i] === '--veiculo' && args[i + 1]) veiculos.push(args[i + 1].toUpperCase());
    if (args[i] === '--sim') semPerguntar = true;
  }
  return { usuarios, veiculos, semPerguntar };
}

function perguntar(texto) {
  const io = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    io.question(texto, (r) => {
      io.close();
      resolve(r.trim());
    }),
  );
}

/** Conta registros que impedem a exclusao. */
async function contarDependencias(client, dependencias, id) {
  const encontradas = [];
  for (const [tabela, campo] of dependencias) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM ${tabela} WHERE ${campo} = $1`,
      [id],
    );
    if (rows[0].n > 0) encontradas.push(`${rows[0].n} em ${tabela}.${campo}`);
  }
  return encontradas;
}

async function principal() {
  const { usuarios, veiculos, semPerguntar } = lerArgumentos();

  if (env.isProduction) {
    console.error('\nRECUSADO: este script nao roda com NODE_ENV=production.');
    console.error('Para remover dados pessoais em producao, use a anonimizacao da LGPD.\n');
    process.exit(1);
  }

  if (usuarios.length === 0 && veiculos.length === 0) {
    console.log('\nInforme o que remover:\n');
    console.log('  npm run remover-cadastro -- --usuario email@dominio.com');
    console.log('  npm run remover-cadastro -- --veiculo ABC1234\n');
    console.log('Pode repetir as opcoes e combinar as duas.\n');
    process.exit(1);
  }

  const client = await pool.connect();
  const paraRemover = { usuarios: [], veiculos: [] };
  const bloqueados = [];

  try {
    console.log('\n=== Remocao de cadastros de teste (desenvolvimento) ===\n');

    // ---------- levantamento ----------
    for (const email of usuarios) {
      const { rows } = await client.query(
        'SELECT id, nome, email, papel, firebase_uid FROM usuarios WHERE LOWER(email) = $1',
        [email],
      );
      if (rows.length === 0) {
        console.log(`  ! usuario nao encontrado: ${email}`);
        continue;
      }
      const usuario = rows[0];
      // Mesma protecao contra lockout que a API aplica (ULTIMO_CENTRAL):
      // remover o ultimo operador ativo deixaria o sistema sem ninguem
      // capaz de cadastrar outro - e o bootstrap so funciona uma vez.
      if (usuario.papel === 'central') {
        const { rows: restantes } = await client.query(
          "SELECT COUNT(*)::int AS n FROM usuarios WHERE papel = 'central' AND ativo = TRUE AND id <> $1",
          [usuario.id],
        );
        if (restantes[0].n === 0) {
          bloqueados.push(
            `usuario ${usuario.email}: e o unico operador da central ativo ` +
              '(removê-lo deixaria o sistema sem acesso administrativo)',
          );
          continue;
        }
      }

      const deps = await contarDependencias(client, DEPENDENCIAS_USUARIO, usuario.id);
      if (deps.length > 0) {
        bloqueados.push(`usuario ${usuario.email}: ${deps.join(', ')}`);
      } else {
        paraRemover.usuarios.push(usuario);
      }
    }

    for (const placa of veiculos) {
      const { rows } = await client.query(
        'SELECT id, placa, modelo FROM veiculos WHERE UPPER(placa) = $1',
        [placa],
      );
      if (rows.length === 0) {
        console.log(`  ! veiculo nao encontrado: ${placa}`);
        continue;
      }
      const veiculo = rows[0];
      const deps = await contarDependencias(client, DEPENDENCIAS_VEICULO, veiculo.id);
      if (deps.length > 0) {
        bloqueados.push(`veiculo ${veiculo.placa}: ${deps.join(', ')}`);
      } else {
        paraRemover.veiculos.push(veiculo);
      }
    }

    // ---------- dependencias ----------
    if (bloqueados.length > 0) {
      console.log('\nBLOQUEADO - estes cadastros ainda tem historico:\n');
      for (const b of bloqueados) console.log(`  - ${b}`);
      console.log(
        '\nO banco recusa apagar cadastro com historico, e isso protege a\n' +
          'rastreabilidade (RF12). Rode primeiro:\n\n' +
          '  npm run limpar-dev\n\n' +
          'e depois este script novamente.\n',
      );
      if (paraRemover.usuarios.length === 0 && paraRemover.veiculos.length === 0) return;
    }

    if (paraRemover.usuarios.length === 0 && paraRemover.veiculos.length === 0) {
      console.log('\nNada a remover.\n');
      return;
    }

    // ---------- confirmacao ----------
    console.log('\nSera REMOVIDO em definitivo:\n');
    for (const u of paraRemover.usuarios) {
      console.log(`  usuario  ${u.nome} <${u.email}> (${u.papel})`);
      console.log('           + a conta correspondente no Firebase');
    }
    for (const v of paraRemover.veiculos) {
      console.log(`  veiculo  ${v.placa} - ${v.modelo}`);
    }
    console.log('');

    if (!semPerguntar) {
      const resposta = await perguntar('Digite "remover" para confirmar: ');
      if (resposta.toLowerCase() !== 'remover') {
        console.log('\nCancelado. Nada foi alterado.\n');
        return;
      }
    }

    // ---------- execucao ----------
    // O banco primeiro, em transacao. O Firebase so depois de o COMMIT
    // passar: se a ordem fosse inversa e o banco falhasse, ficariamos com
    // um usuario sem conta - pior que uma conta sem usuario.
    await client.query('BEGIN');
    for (const u of paraRemover.usuarios) {
      await client.query('DELETE FROM usuarios WHERE id = $1', [u.id]);
      console.log(`  removido do banco: ${u.email}`);
    }
    for (const v of paraRemover.veiculos) {
      await client.query('DELETE FROM veiculos WHERE id = $1', [v.id]);
      console.log(`  removido do banco: ${v.placa}`);
    }
    await client.query('COMMIT');

    for (const u of paraRemover.usuarios) {
      if (!u.firebase_uid) continue;
      await removerUsuarioFirebase(u.firebase_uid);
      console.log(`  removido do Firebase: ${u.email}`);
    }

    console.log('\nConcluido.\n');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFalhou. Nada foi alterado no banco.\n', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

principal();
