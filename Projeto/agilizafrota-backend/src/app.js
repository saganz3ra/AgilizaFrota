/**
 * Configuracao da aplicacao Express.
 *
 * Camada de seguranca (RNF01 - conclusao):
 *  - helmet com HSTS em producao (forca HTTPS no navegador);
 *  - CORS restrito: em producao, "*" e recusado explicitamente;
 *  - rate limit GLOBAL (alem do limite mais rigido em /auth);
 *  - limite de corpo, validacao de entrada (Zod) e erros padronizados;
 *  - auditoria de escritas e de tentativas negadas (RF14);
 *  - medicao de tempo de resposta (RNF06).
 */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { env } = require('./config/env');
const { getFirebaseAdmin } = require('./config/firebase');
const rotas = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { auditar } = require('./middlewares/auditoria');
const { medirTempo } = require('./middlewares/metricas');
const { PASTA_UPLOADS } = require('./config/uploads');

// Inicializa o Firebase Admin no start (loga aviso se a chave estiver ausente).
getFirebaseAdmin();

const app = express();

// Confia no proxy reverso (IP real do cliente para rate limit e auditoria).
app.set('trust proxy', 1);

// Cabecalhos de seguranca. HSTS so faz sentido sob HTTPS (producao).
app.use(
  helmet({
    hsts: env.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);

// CORS: em producao, exigir origens explicitas.
const permitirTodas = env.corsOrigins.includes('*');
if (env.isProduction && permitirTodas) {
  throw new Error(
    'CORS_ORIGINS="*" nao e permitido em producao. Liste as origens do painel web.',
  );
}
app.use(
  cors({
    origin: permitirTodas ? true : env.corsOrigins,
    credentials: true,
  }),
);

// Corpo JSON com limite de tamanho (evita payloads abusivos).
app.use(express.json({ limit: '1mb' }));

// Rate limit global: barra abuso automatizado sem atrapalhar o uso normal.
// (As rotas de autenticacao tem um limite proprio, mais rigido.)
app.use(
  rateLimit({
    windowMs: env.rateLimitGlobal.windowMin * 60 * 1000,
    max: env.rateLimitGlobal.max,
    standardHeaders: true,
    legacyHeaders: false,
    // O stream SSE fica aberto por muito tempo: nao deve contar como abuso.
    skip: (req) => req.path.endsWith('/stream'),
    message: { erro: 'Muitas requisicoes. Tente novamente em instantes.', codigo: 'RATE_LIMIT' },
  }),
);

// Tempo de resposta (RNF06) e auditoria (RF14).
app.use(medirTempo);
app.use(auditar);

// Evidencias fotograficas (RF03).
//
// Servidas como arquivos estaticos, sem passar pelos controllers. O nome
// de cada arquivo e aleatorio (16 bytes), o que impede adivinhar a URL de
// uma foto alheia. Nao exigimos token aqui de proposito: a URL e gravada
// no turno e precisa abrir direto no navegador do operador e no relatorio
// impresso, onde nao ha como enviar cabecalho de autenticacao.
app.use(
  '/api/uploads',
  express.static(PASTA_UPLOADS, {
    maxAge: '7d',
    // Nunca executar nada que esteja nesta pasta.
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
    },
  }),
);

// Rotas da API.
app.use('/api', rotas);

// 404 e tratamento de erros (sempre por ultimo).
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
