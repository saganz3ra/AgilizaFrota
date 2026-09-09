-- ==========================================================================
-- Migration 006 - Registro de Atendimentos (Sprint 6)
-- Tabela "atendimentos" (RF09), com metricas calculadas (RNF09) e campos de
-- validacao manual pela central (RF10).
--
-- Ciclo de vida (o "andamento" do RF09 sao os marcos intermediarios):
--   a_caminho -> no_local -> em_transporte -> concluido
--   (ou cancelado a qualquer momento antes de concluir)
--
-- Cada marco registra o horario do evento e a quilometragem do painel, o que
-- permite calcular distancias e tempos com precisao e auditar depois.
-- Os CHECKs garantem que a quilometragem nunca "ande para tras" (RNF09).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS atendimentos (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chamado_id              UUID NOT NULL REFERENCES chamados(id),
  atribuicao_id           UUID REFERENCES atribuicoes(id) ON DELETE SET NULL,
  veiculo_id              UUID NOT NULL REFERENCES veiculos(id),
  motorista_id            UUID NOT NULL REFERENCES usuarios(id),
  turno_id                UUID REFERENCES turnos(id) ON DELETE SET NULL,

  status                  VARCHAR(20) NOT NULL DEFAULT 'a_caminho'
                          CHECK (status IN ('a_caminho', 'no_local', 'em_transporte',
                                            'concluido', 'cancelado')),

  -- Marcos: quilometragem
  km_saida                INTEGER NOT NULL CHECK (km_saida >= 0),
  km_local                INTEGER CHECK (km_local IS NULL OR km_local >= km_saida),
  km_final                INTEGER CHECK (km_final IS NULL OR km_final >= COALESCE(km_local, km_saida)),

  -- Marcos: horarios do EVENTO (informados pelo app; suportam sincronizacao offline)
  inicio_em               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  chegada_local_em        TIMESTAMPTZ,
  inicio_transporte_em    TIMESTAMPTZ,
  fim_em                  TIMESTAMPTZ,

  -- Metricas calculadas pelo sistema (RNF09)
  distancia_total_km      INTEGER,
  distancia_ate_local_km  INTEGER,
  distancia_transporte_km INTEGER,
  tempo_resposta_min      INTEGER,
  tempo_no_local_min      INTEGER,
  tempo_transporte_min    INTEGER,
  tempo_total_min         INTEGER,

  -- Validacao manual pela central (RF10)
  validado                BOOLEAN NOT NULL DEFAULT FALSE,
  validado_por            UUID REFERENCES usuarios(id),
  validado_em             TIMESTAMPTZ,
  observacao_validacao    TEXT,
  km_total_ajustado       INTEGER CHECK (km_total_ajustado IS NULL OR km_total_ajustado >= 0),
  tempo_total_ajustado_min INTEGER CHECK (tempo_total_ajustado_min IS NULL OR tempo_total_ajustado_min >= 0),

  observacoes             TEXT,
  motivo_cancelamento     TEXT,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_chamado   ON atendimentos (chamado_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_veiculo   ON atendimentos (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_motorista ON atendimentos (motorista_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status    ON atendimentos (status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_inicio    ON atendimentos (inicio_em);
CREATE INDEX IF NOT EXISTS idx_atendimentos_validado  ON atendimentos (validado);

-- Um chamado so pode ter um atendimento em andamento; um veiculo so pode
-- estar em um atendimento por vez (RNF05).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_atendimento_ativo_chamado
  ON atendimentos (chamado_id)
  WHERE status IN ('a_caminho', 'no_local', 'em_transporte');
CREATE UNIQUE INDEX IF NOT EXISTS uniq_atendimento_ativo_veiculo
  ON atendimentos (veiculo_id)
  WHERE status IN ('a_caminho', 'no_local', 'em_transporte');

DROP TRIGGER IF EXISTS trg_atendimentos_atualizado_em ON atendimentos;
CREATE TRIGGER trg_atendimentos_atualizado_em
  BEFORE UPDATE ON atendimentos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
