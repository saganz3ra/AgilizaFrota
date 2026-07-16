/**
 * Rotas de turnos e checklist (RF03/RF04).
 * - iniciar/encerrar: motorista (encerrar tambem pela central).
 * - listar/obter: qualquer autenticado (o controller restringe o motorista
 *   aos seus proprios turnos).
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/turnoController');
const { iniciarTurno, encerrarTurno, idParam, listarTurnos } = require('../validators/turnoValidators');

const router = Router();

router.use(autenticar);

// Catalogo de itens do checklist (para o app renderizar o formulario).
router.get('/checklist/itens', ctrl.itensChecklist);

router.get('/', validate(listarTurnos), ctrl.listar);
router.get('/:id', validate(idParam), ctrl.obter);

router.post('/iniciar', autorizarPapel('motorista'), validate(iniciarTurno), ctrl.iniciar);
router.post('/:id/encerrar', autorizarPapel('motorista', 'central'), validate(encerrarTurno), ctrl.encerrar);

module.exports = router;
