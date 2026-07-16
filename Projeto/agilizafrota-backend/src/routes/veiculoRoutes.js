/**
 * Rotas de veiculos (RF02).
 * Leitura: qualquer usuario autenticado. Escrita: apenas "central".
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/veiculoController');
const {
  idParam,
  criarVeiculo,
  atualizarVeiculo,
  alterarStatus,
  listarVeiculos,
} = require('../validators/veiculoValidators');

const router = Router();

router.use(autenticar);

router.get('/', validate(listarVeiculos), ctrl.listar);
router.get('/:id', validate(idParam), ctrl.obter);

router.post('/', autorizarPapel('central'), validate(criarVeiculo), ctrl.criar);
router.put('/:id', autorizarPapel('central'), validate(atualizarVeiculo), ctrl.atualizar);
router.patch('/:id/status', autorizarPapel('central'), validate(alterarStatus), ctrl.alterarStatus);
router.delete('/:id', autorizarPapel('central'), validate(idParam), ctrl.desativar);

module.exports = router;
