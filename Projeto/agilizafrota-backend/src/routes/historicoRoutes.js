/**
 * Rotas do historico da frota e dos atendimentos (RF12). Somente central.
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/historicoController');
const { historicoLista, historicoPorId, historicoResumo } = require('../validators/historicoValidators');

const router = Router();

router.use(autenticar, autorizarPapel('central'));

router.get('/', validate(historicoLista), ctrl.linhaDoTempo);
router.get('/resumo', validate(historicoResumo), ctrl.resumo);
router.get('/veiculos/:id', validate(historicoPorId), ctrl.porVeiculo);
router.get('/motoristas/:id', validate(historicoPorId), ctrl.porMotorista);

module.exports = router;
