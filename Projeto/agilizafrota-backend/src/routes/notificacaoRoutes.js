/**
 * Rotas de notificacoes (RF15).
 * Recepcionista e central; o stream usa auth flexivel (EventSource).
 */
const { Router } = require('express');
const { autenticar, autenticarEventStream } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/notificacaoController');
const { idParam, listarNotificacoes } = require('../validators/historicoValidators');

const router = Router();

router.get('/stream', autenticarEventStream, ctrl.stream);
router.get('/', autenticar, validate(listarNotificacoes), ctrl.listar);
router.patch('/lidas', autenticar, ctrl.marcarTodasLidas);
router.patch('/:id/lida', autenticar, validate(idParam), ctrl.marcarLida);

module.exports = router;
