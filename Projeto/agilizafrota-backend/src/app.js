/**
 * Configuracao da aplicacao Express (sem escutar porta - facilita testes).
 * Camada de seguranca (RNF01): helmet, CORS restrito, limite de payload e
 * tratamento de erros centralizado.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { env } = require('./config/env');
const { getFirebaseAdmin } = require('./config/firebase');
const rotas = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

// Inicializa o Firebase Admin no start (loga aviso se a chave estiver ausente).
getFirebaseAdmin();

const app = express();

// Cabecalhos de seguranca.
app.use(helmet());

// CORS: libera apenas as origens configuradas (ou "*" em dev).
const permitirTodas = env.corsOrigins.includes('*');
app.use(
  cors({
    origin: permitirTodas ? true : env.corsOrigins,
    credentials: true,
  }),
);

// Corpo JSON com limite de tamanho (evita payloads abusivos).
app.use(express.json({ limit: '1mb' }));

// Rotas da API.
app.use('/api', rotas);

// 404 e tratamento de erros (sempre por ultimo).
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
