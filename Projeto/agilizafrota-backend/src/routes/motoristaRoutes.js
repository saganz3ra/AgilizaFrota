/**
 * Rotas do app do motorista (RNF11): uma chamada resolve a tela inicial.
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const ctrl = require('../controllers/painelMotoristaController');

const router = Router();

router.get('/painel', autenticar, autorizarPapel('motorista'), ctrl.painel);

// Registro/remocao do token de push (notificacoes FCM) deste aparelho.
router.post('/dispositivo', autenticar, autorizarPapel('motorista'), ctrl.registrarDispositivo);
router.delete('/dispositivo', autenticar, autorizarPapel('motorista'), ctrl.removerDispositivo);

module.exports = router;
