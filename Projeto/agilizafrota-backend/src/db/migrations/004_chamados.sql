-- ==========================================================================
-- Migration 004 - Chamados e Alertas (Sprint 4)
-- Tabela chamados (RF05). O alerta em tempo real (RF06) e entregue por SSE,
-- nao exige tabela adicional.
--
-- Notas:
--  - tipo: urgencia | emergencia (RF05).
--  - prioridade: nivel derivado do tipo (ajustavel): baixa|media|alta|critica.
--  - origem_tipo: quem abriu (central | sistema_externo).
--  - status: ciclo de vida; a atribuicao/andamento evolui nas sprints 5 e 6.
--  - aberto_em: horario do evento (suporte a idempotencia/offline).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS chamados (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo                  VARCHAR(20) NOT NULL CHECK (tipo IN ('urgencia', 'emergencia')),
  prioridade            VARCHAR(20) NOT NULL DEFAULT 'media'
                        CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
  natureza              VARCHAR(150) NOT NULL,
  descricao             TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'aberto'
                        CHECK (status IN ('aberto', 'atribuido', 'em_atendimento', 'concluido', 'cancelado')),
  origem_tipo           VARCHAR(20) NOT NULL CHECK (origem_tipo IN ('central', 'sistema_externo')),
  criado_por            UUID REFERENCES usuarios(id),
  solicitante_nome      VARCHAR(100),
  solicitante_telefone  VARCHAR(20),
  origem_endereco       TEXT,
  origem_lat            DECIMAL(9,6),
  origem_lng            DECIMAL(9,6),
  destino_unidade_id    UUID REFERENCES unidades(id),
  destino_endereco      TEXT,
  aberto_em             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chamados_status      ON chamados (status);
CREATE INDEX IF NOT EXISTS idx_chamados_prioridade  ON chamados (prioridade);
CREATE INDEX IF NOT EXISTS idx_chamados_tipo        ON chamados (tipo);
CREATE INDEX IF NOT EXISTS idx_chamados_aberto_em   ON chamados (aberto_em);
CREATE INDEX IF NOT EXISTS idx_chamados_destino     ON chamados (destino_unidade_id);

DROP TRIGGER IF EXISTS trg_chamados_atualizado_em ON chamados;
CREATE TRIGGER trg_chamados_atualizado_em
  BEFORE UPDATE ON chamados
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
