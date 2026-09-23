-- ==========================================================================
-- Migration 012 - Dispositivos para notificacao push (FCM)
--
-- Guarda os tokens de push (Firebase Cloud Messaging) por usuario. O caso de
-- uso e avisar o MOTORISTA de um novo acionamento (RF07) mesmo com o app em
-- segundo plano ou fechado, reforcando o tempo real (RF06).
--
-- Decisoes:
--  - `token` UNICO: o mesmo aparelho tem um token; se outra conta logar nele,
--    o token migra de dono (ON CONFLICT DO UPDATE no servico).
--  - ON DELETE CASCADE: anonimizar/remover um usuario leva junto seus tokens.
--  - Sem dado pessoal aqui: token e um identificador opaco do aparelho.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS dispositivos_fcm (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  plataforma    VARCHAR(20),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_fcm_usuario
  ON dispositivos_fcm (usuario_id);
