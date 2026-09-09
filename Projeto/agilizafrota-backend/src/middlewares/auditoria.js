/**
 * Auditoria das acoes criticas (RF14).
 *
 * Middleware global que observa a requisicao e, DEPOIS que a resposta e
 * enviada, grava o registro. Duas garantias importantes:
 *  - Nao bloqueia o usuario: a gravacao acontece apos "res.finish" e um erro
 *    de auditoria nunca derruba a operacao (apenas loga no console).
 *  - Nao vaza segredo: campos sensiveis (senha, token, segredo, chave) sao
 *    removidos do corpo antes de salvar.
 *
 * O que e auditado: toda operacao de escrita (POST/PUT/PATCH/DELETE) e as
 * tentativas NEGADAS (401/403) em qualquer metodo.
 */
const { query } = require('../config/db');

const CAMPOS_SENSIVEIS = ['senha', 'password', 'token', 'segredo', 'secret', 'api_key', 'apikey', 'chave'];

/** Remove segredos de um objeto (raso + um nivel). */
function limpar(objeto) {
  if (!objeto || typeof objeto !== 'object') return null;
  const copia = Array.isArray(objeto) ? [...objeto] : { ...objeto };
  for (const chave of Object.keys(copia)) {
    if (CAMPOS_SENSIVEIS.includes(chave.toLowerCase())) {
      copia[chave] = '***';
    } else if (copia[chave] && typeof copia[chave] === 'object') {
      copia[chave] = limpar(copia[chave]);
    }
  }
  return copia;
}

/** Deriva "entidade" e "acao" a partir do metodo e da rota. */
function descreverAcao(metodo, caminho) {
  const partes = caminho.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const entidade = partes[0] || 'api';
  const sufixo = partes.filter((p) => !/^[0-9a-f-]{36}$/i.test(p)).slice(1).join('_');

  const verbos = { POST: 'criar', PUT: 'atualizar', PATCH: 'atualizar', DELETE: 'remover', GET: 'consultar' };
  const verbo = verbos[metodo] || metodo.toLowerCase();
  const acao = sufixo ? `${entidade}_${sufixo}` : `${verbo}_${entidade}`;
  return { entidade, acao: acao.slice(0, 60) };
}

/** Primeiro UUID encontrado na rota (o recurso afetado). */
function extrairId(caminho, corpoResposta) {
  const m = caminho.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (m) return m[0];
  // Em criacoes, o id vem no corpo da resposta.
  if (corpoResposta && typeof corpoResposta === 'object') {
    for (const valor of Object.values(corpoResposta)) {
      if (valor && typeof valor === 'object' && typeof valor.id === 'string') return valor.id;
    }
  }
  return null;
}

/** Grava o registro (nunca lanca). */
async function registrar(dados) {
  try {
    await query(
      `INSERT INTO auditoria
         (usuario_id, usuario_email, papel, acao, entidade, entidade_id, metodo, rota,
          status_http, sucesso, dados_antes, dados_depois, ip, user_agent, duracao_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)`,
      [
        dados.usuario_id,
        dados.usuario_email,
        dados.papel,
        dados.acao,
        dados.entidade,
        dados.entidade_id,
        dados.metodo,
        dados.rota,
        dados.status_http,
        dados.sucesso,
        dados.dados_antes ? JSON.stringify(dados.dados_antes) : null,
        dados.dados_depois ? JSON.stringify(dados.dados_depois) : null,
        dados.ip,
        dados.user_agent,
        dados.duracao_ms,
      ],
    );
  } catch (err) {
    // A auditoria nunca pode derrubar a operacao do usuario.
    console.error('[auditoria] falha ao registrar:', err.message);
  }
}

const METODOS_ESCRITA = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** Middleware de auditoria (registrado em app.js, apos o parser do corpo). */
function auditar(req, res, next) {
  const inicio = Date.now();

  // Captura o corpo da resposta sem alterar o comportamento do handler.
  let corpoResposta = null;
  const jsonOriginal = res.json.bind(res);
  res.json = (corpo) => {
    corpoResposta = corpo;
    return jsonOriginal(corpo);
  };

  res.on('finish', () => {
    const escrita = METODOS_ESCRITA.includes(req.method);
    const negada = res.statusCode === 401 || res.statusCode === 403;
    if (!escrita && !negada) return; // leituras autorizadas nao geram log

    const { entidade, acao } = descreverAcao(req.method, req.originalUrl.split('?')[0]);
    void registrar({
      usuario_id: req.usuario ? req.usuario.id : null,
      usuario_email: req.usuario ? req.usuario.email : (req.firebase ? req.firebase.email : null),
      papel: req.usuario ? req.usuario.papel : null,
      acao: negada ? `negado_${acao}`.slice(0, 60) : acao,
      entidade,
      entidade_id: extrairId(req.originalUrl, corpoResposta),
      metodo: req.method,
      rota: req.originalUrl.split('?')[0],
      status_http: res.statusCode,
      sucesso: res.statusCode < 400,
      dados_antes: null,
      dados_depois: escrita ? limpar(req.body) : null,
      ip: req.headers['x-forwarded-for'] || req.ip || null,
      user_agent: req.headers['user-agent'] || null,
      duracao_ms: Date.now() - inicio,
    });
  });

  next();
}

module.exports = { auditar, limpar, descreverAcao, extrairId, registrar };
