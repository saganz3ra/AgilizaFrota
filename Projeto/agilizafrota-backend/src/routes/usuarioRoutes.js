/**
 * Rotas de gestao de usuarios (RF02). Todas restritas ao papel "central".
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/usuarioController');
const {
  idParam,
  criarUsuario,
  atualizarUsuario,
  listarUsuarios,
} = require('../validators/usuarioValidators');

const router = Router();

// Gestao de usuarios e exclusiva da central.
router.use(autenticar, autorizarPapel('central'));

router.get('/', validate(listarUsuarios), ctrl.listar);
router.get('/:id', validate(idParam), ctrl.obter);
router.post('/', validate(criarUsuario), ctrl.criar);
router.put('/:id', validate(atualizarUsuario), ctrl.atualizar);
router.patch('/:id/ativar', validate(idParam), ctrl.ativar);
router.patch('/:id/desativar', validate(idParam), ctrl.desativar);

module.exports = router;
