/**
 * Verificacoes de saude (RNF08 - alta disponibilidade basica).
 *
 * Tres niveis, no padrao usado por orquestradores (Docker/Kubernetes):
 *  - /status : identificacao simples da API.
 *  - /health/live  (liveness)  : o processo esta vivo? Nao toca no banco,
 *    para nao reiniciar a aplicacao so porque o banco oscilou.
 *  - /health/ready (readiness) : esta apto a RECEBER TRAFEGO? Verifica o
 *    banco; se falhar, responde 503 e o balanceador tira a instancia da
 *    rotacao ate ela se recuperar - sem derrubar o servico como um todo.
 */
const { Router } = require('express');
const { verificarBanco } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');

const router = Router();
const iniciadoEm = Date.now();

router.get('/status', (_req, res) => {
  res.json({ mensagem: 'Agiliza Frota API rodando com sucesso!', versao: '0.1.0' });
});

// Liveness: processo de pe (nao depende de dependencias externas).
router.get('/health/live', (_req, res) => {
  res.json({
    status: 'vivo',
    uptime_s: Math.round((Date.now() - iniciadoEm) / 1000),
    memoria_mb: Math.round(process.memoryUsage().heapUsed / 1048576),
  });
});

// Readiness: pronto para atender (checa o banco).
router.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    try {
      const banco = await verificarBanco();
      res.json({ status: 'pronto', banco });
    } catch (err) {
      res.status(503).json({
        status: 'indisponivel',
        banco: { ok: false, erro: err.message },
        codigo: 'BANCO_INDISPONIVEL',
      });
    }
  }),
);

// Compatibilidade: /health continua funcionando (equivale ao readiness).
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await verificarBanco();
    res.json({ status: 'ok', banco: 'conectado' });
  }),
);

module.exports = router;
