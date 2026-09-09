/**
 * Rotas de monitoramento da frota por GPS (RF11/RNF10).
 * - Envio de posicoes: motorista (o app envia em tempo real ou em lote).
 * - Mapa, historico e stream: central.
 */
const { Router } = require('express');
const { autenticar, autenticarEventStream } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/posicaoController');
const {
  enviarPosicao,
  enviarLote,
  listarFrota,
  historicoPosicoes,
} = require('../validators/posicaoValidators');

const router = Router();

// Stream do mapa (SSE) - token via header ou ?token= (EventSource).
router.get('/stream', autenticarEventStream, autorizarPapel('central'), ctrl.stream);

// Mapa da frota e rastro de um veiculo.
router.get('/', autenticar, autorizarPapel('central'), validate(listarFrota), ctrl.frota);
router.get(
  '/veiculos/:id/posicoes',
  autenticar,
  autorizarPapel('central'),
  validate(historicoPosicoes),
  ctrl.historico,
);

module.exports = router;
