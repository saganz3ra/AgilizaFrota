/**
 * Rotas de auditoria (RF14). Somente central; apenas leitura (append-only).
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/auditoriaController');
const { listarAuditoria, trilhaEntidade } = require('../validators/relatorioValidators');

const router = Router();

router.use(autenticar, autorizarPapel('central'));

router.get('/', validate(listarAuditoria), ctrl.listar);
router.get('/resumo', ctrl.resumo);
router.get('/entidades/:entidade/:id', validate(trilhaEntidade), ctrl.porEntidade);

module.exports = router;
