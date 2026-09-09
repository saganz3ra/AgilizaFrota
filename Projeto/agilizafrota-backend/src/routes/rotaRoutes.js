/**
 * Rotas de ETA e sugestao de trajeto (RF16/RF17).
 * Central e motorista podem consultar (o app usa para orientar o trajeto).
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/rotaController');
const { calcularRota } = require('../validators/rotaValidators');

const router = Router();

router.use(autenticar, autorizarPapel('central', 'motorista'));

router.get('/eta', validate(calcularRota), ctrl.eta);
router.get('/sugerir', validate(calcularRota), ctrl.sugerir);

module.exports = router;
