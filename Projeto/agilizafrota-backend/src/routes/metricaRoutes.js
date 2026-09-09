/**
 * Observabilidade do tempo de resposta (RNF06). Somente central.
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { resumo, zerar } = require('../middlewares/metricas');

const router = Router();

router.use(autenticar, autorizarPapel('central'));

router.get('/', (_req, res) => res.json(resumo()));
router.post('/zerar', (_req, res) => {
  zerar();
  res.json({ mensagem: 'Estatisticas zeradas.' });
});

module.exports = router;
