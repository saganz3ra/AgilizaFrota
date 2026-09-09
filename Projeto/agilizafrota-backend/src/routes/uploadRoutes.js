/**
 * Rotas de upload de evidencias (RF03).
 *
 * Apenas usuarios autenticados enviam. Motorista e o caso normal (foto do
 * painel); a central tambem pode, para anexar evidencias em correcoes.
 */
const { Router } = require('express');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { upload, tratarErroUpload } = require('../config/uploads');
const ctrl = require('../controllers/uploadController');

const router = Router();

router.post(
  '/',
  autenticar,
  autorizarPapel('motorista', 'central'),
  upload.single('arquivo'),
  tratarErroUpload,
  ctrl.enviar,
);

module.exports = router;
