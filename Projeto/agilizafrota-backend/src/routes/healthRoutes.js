/**
 * Rotas publicas de verificacao de saude da API e do banco.
 */
const { Router } = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');

const router = Router();

// Status simples da API.
router.get('/status', (_req, res) => {
  res.json({ mensagem: 'Agiliza Frota API rodando com sucesso!', versao: '0.1.0' });
});

// Verifica conectividade com o PostgreSQL.
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok', banco: 'conectado' });
  }),
);

module.exports = router;
