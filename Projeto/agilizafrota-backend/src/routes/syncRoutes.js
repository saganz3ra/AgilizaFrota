/**
 * Rotas de sincronizacao offline (RNF03). Motorista (e central, para apoio).
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/syncController');
const { sincronizar, estado } = require('../validators/syncValidators');

const router = Router();

router.use(autenticar, autorizarPapel('motorista', 'central'));

router.post('/', validate(sincronizar), ctrl.sincronizar);
router.get('/estado', validate(estado), ctrl.estado);

module.exports = router;
