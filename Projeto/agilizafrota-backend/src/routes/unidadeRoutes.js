/**
 * Rotas de unidades hospitalares (RF02).
 * Leitura: qualquer usuario autenticado. Escrita: apenas "central".
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/unidadeController');
const {
  idParam,
  criarUnidade,
  atualizarUnidade,
  listarUnidades,
} = require('../validators/unidadeValidators');

const router = Router();

// Todas as rotas exigem autenticacao.
router.use(autenticar);

router.get('/', validate(listarUnidades), ctrl.listar);
router.get('/:id', validate(idParam), ctrl.obter);

// Escritas restritas a central.
router.post('/', autorizarPapel('central'), validate(criarUnidade), ctrl.criar);
router.put('/:id', autorizarPapel('central'), validate(atualizarUnidade), ctrl.atualizar);
router.delete('/:id', autorizarPapel('central'), validate(idParam), ctrl.desativar);

module.exports = router;
