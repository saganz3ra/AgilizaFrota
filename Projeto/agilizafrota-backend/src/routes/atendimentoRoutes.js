/**
 * Rotas de atendimentos (RF09) e validacao dos calculos (RF10).
 * - Registro dos marcos: motorista (a central tambem pode concluir/cancelar).
 * - Validacao manual: apenas central.
 * - Leitura: qualquer autenticado (o controller restringe o motorista aos
 *   proprios atendimentos).
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/atendimentoController');
const rotaCtrl = require('../controllers/rotaController');
const {
  idParam,
  iniciarAtendimento,
  chegadaLocal,
  iniciarTransporte,
  concluirAtendimento,
  cancelarAtendimento,
  validarAtendimento,
  listarAtendimentos,
} = require('../validators/atendimentoValidators');

const router = Router();

router.use(autenticar);

router.get('/', validate(listarAtendimentos), ctrl.listar);
router.get('/:id', validate(idParam), ctrl.obter);

// Rota sugerida ate o proximo destino do atendimento (RF17).
router.get('/:id/rota', validate(idParam), rotaCtrl.rotaDoAtendimento);

router.post('/', autorizarPapel('motorista'), validate(iniciarAtendimento), ctrl.iniciar);
router.patch(
  '/:id/chegada-local',
  autorizarPapel('motorista'),
  validate(chegadaLocal),
  ctrl.chegadaLocal,
);
router.patch(
  '/:id/inicio-transporte',
  autorizarPapel('motorista'),
  validate(iniciarTransporte),
  ctrl.iniciarTransporte,
);
router.patch(
  '/:id/concluir',
  autorizarPapel('motorista', 'central'),
  validate(concluirAtendimento),
  ctrl.concluir,
);
router.patch(
  '/:id/cancelar',
  autorizarPapel('motorista', 'central'),
  validate(cancelarAtendimento),
  ctrl.cancelar,
);

// RF10 - validacao manual dos calculos (somente central).
router.post('/:id/validar', autorizarPapel('central'), validate(validarAtendimento), ctrl.validar);

module.exports = router;
