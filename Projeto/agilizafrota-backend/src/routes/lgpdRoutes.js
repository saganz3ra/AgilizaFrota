/**
 * Rotas de LGPD (RNF02).
 * O titular acessa os proprios dados; anonimizacao e retencao sao da central.
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/lgpdController');
const { registrarConsentimento, idParam, retencao } = require('../validators/lgpdValidators');

const router = Router();

router.use(autenticar);

// Direitos do proprio titular.
router.get('/termo', ctrl.termo);
router.get('/consentimentos', ctrl.meusConsentimentos);
router.post('/consentimentos', validate(registrarConsentimento), ctrl.registrarConsentimento);
router.get('/meus-dados', ctrl.meusDados);

// Acoes administrativas (auditadas).
router.get('/usuarios/:id/dados', autorizarPapel('central'), validate(idParam), ctrl.dadosDeUsuario);
router.post('/usuarios/:id/anonimizar', autorizarPapel('central'), validate(idParam), ctrl.anonimizar);
router.post('/retencao', autorizarPapel('central'), validate(retencao), ctrl.retencao);

module.exports = router;
