-- ==========================================================================
-- Migration 003 - Core do Motorista (Sprint 3: Turno + Checklist)
-- Tabelas: turnos (RF03) e checklists (RF04).
--
-- Notas:
--  - Foto: guardamos apenas a URL/caminho no Firebase Storage (o upload e
--    feito pelo app). Ver foto_inicio_url / foto_fim_url.
--  - Offline (RNF03): "inicio_em"/"fim_em"/"realizado_em" sao os horarios do
--    EVENTO (informados pelo cliente), separados de "criado_em" (horario de
--    sincronizacao no servidor). O id pode ser gerado no cliente para permitir
--    reenvio idempotente.
--  - Regra: no maximo um turno "aberto" por motorista e por veiculo
--    (indices unicos parciais).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Tabela: turnos
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turnos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motorista_id     UUID NOT NULL REFERENCES usuarios(id),
  veiculo_id       UUID NOT NULL REFERENCES veiculos(id),
  status           VARCHAR(20) NOT NULL DEFAULT 'aberto'
                   CHECK (status IN ('aberto', 'encerrado')),
  km_inicial       INTEGER NOT NULL CHECK (km_inicial >= 0),
  km_final         INTEGER CHECK (km_final IS NULL OR km_final >= km_inicial),
  foto_inicio_url  TEXT NOT NULL,
  foto_fim_url     TEXT,
  inicio_em        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fim_em           TIMESTAMPTZ,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_turnos_motorista ON turnos (motorista_id);
CREATE INDEX IF NOT EXISTS idx_turnos_veiculo   ON turnos (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_turnos_status    ON turnos (status);
CREATE INDEX IF NOT EXISTS idx_turnos_inicio_em ON turnos (inicio_em);

-- No maximo um turno "aberto" por motorista / por veiculo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_turno_aberto_motorista
  ON turnos (motorista_id) WHERE status = 'aberto';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_turno_aberto_veiculo
  ON turnos (veiculo_id) WHERE status = 'aberto';

-- --------------------------------------------------------------------------
-- Tabela: checklists (executado antes de abrir o turno)
--  - respostas: JSONB no formato [{ "codigo": "...", "conforme": true,
--    "observacao": "..." }], validado contra o catalogo fixo no backend.
--  - aprovado: FALSE se algum item CRITICO estiver nao-conforme.
--  - turno_id: preenchido quando o turno e efetivamente aberto (aprovado).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklists (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motorista_id  UUID NOT NULL REFERENCES usuarios(id),
  veiculo_id    UUID NOT NULL REFERENCES veiculos(id),
  turno_id      UUID REFERENCES turnos(id) ON DELETE SET NULL,
  respostas     JSONB NOT NULL,
  aprovado      BOOLEAN NOT NULL,
  realizado_em  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checklists_motorista ON checklists (motorista_id);
CREATE INDEX IF NOT EXISTS idx_checklists_veiculo   ON checklists (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_checklists_turno     ON checklists (turno_id);

-- Triggers de atualizado_em (funcao criada na migration 002).
DROP TRIGGER IF EXISTS trg_turnos_atualizado_em ON turnos;
CREATE TRIGGER trg_turnos_atualizado_em
  BEFORE UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_checklists_atualizado_em ON checklists;
CREATE TRIGGER trg_checklists_atualizado_em
  BEFORE UPDATE ON checklists
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
