/**
 * Rotas de envio de posicoes GPS (RF11).
 * O motorista envia pontos individualmente ou em lote (apos perda de sinal).
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/posicaoController');
const { enviarPosicao, enviarLote } = require('../validators/posicaoValidators');

const router = Router();

router.use(autenticar, autorizarPapel('motorista', 'central'));

router.post('/', validate(enviarPosicao), ctrl.enviar);
router.post('/lote', validate(enviarLote), ctrl.enviarLote);

module.exports = router;
