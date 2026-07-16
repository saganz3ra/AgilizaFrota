/**
 * Rotas de autenticacao (RF01).
 * Rate limiting aplicado a todo o grupo para mitigar abuso (RNF01).
 */
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { autenticar, autenticarSemPerfil } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validate');
const { registerSchema, bootstrapSchema } = require('../validators/authValidators');
const authController = require('../controllers/authController');

const router = Router();

const authLimiter = rateLimit({
  windowMs: env.authRateLimit.windowMin * 60 * 1000,
  max: env.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisicoes. Tente novamente mais tarde.', codigo: 'RATE_LIMIT' },
});

router.use(authLimiter);

// Provisiona o perfil do proprio usuario autenticado no Firebase.
router.post('/register', autenticarSemPerfil, validate(registerSchema), authController.register);

// Perfil do usuario autenticado (exige perfil ja provisionado).
router.get('/me', autenticar, authController.me);

// Cria o primeiro operador "central" (setup unico, protegido por segredo).
router.post('/bootstrap', autenticarSemPerfil, validate(bootstrapSchema), authController.bootstrap);

module.exports = router;
