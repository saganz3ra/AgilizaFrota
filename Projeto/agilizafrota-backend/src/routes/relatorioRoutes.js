/**
 * Rotas de relatorios (RF13). Somente central.
 * Formatos: ?formato=json (padrao) | csv (Excel) | html (imprimir/PDF).
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/relatorioController');
const { relatorioPadrao } = require('../validators/relatorioValidators');

const router = Router();

router.use(autenticar, autorizarPapel('central'));

router.get('/operacional', validate(relatorioPadrao), ctrl.operacional);
router.get('/frota', validate(relatorioPadrao), ctrl.frota);
router.get('/desempenho', validate(relatorioPadrao), ctrl.desempenho);

module.exports = router;
