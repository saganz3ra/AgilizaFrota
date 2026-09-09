-- ==========================================================================
-- Migration 008 - Notificacoes (Sprint 8)
-- Tabela "notificacoes" (RF15). O caso principal e avisar a recepcionista
-- hospitalar da chegada do veiculo, disparado AUTOMATICAMENTE pelo GPS
-- (geofence), sem exigir nenhuma acao do motorista (RNF11).
--
-- Decisoes:
--  - Uma notificacao por destinatario (cada recepcionista ativa da unidade).
--    Se a unidade nao tiver recepcionista cadastrado, grava-se uma
--    notificacao "da unidade" (destinatario_id nulo) para nao perder o evento.
--  - "dados" (JSONB) leva o contexto pronto para a tela: placa, motorista,
--    natureza do chamado, distancia. Evita novas consultas no cliente.
--  - Indice unico parcial garante que a chegada de um atendimento seja
--    notificada UMA vez por destinatario, mesmo com varias leituras de GPS
--    dentro do raio.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS notificacoes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destinatario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id      UUID REFERENCES unidades(id) ON DELETE SET NULL,
  tipo            VARCHAR(40) NOT NULL
                  CHECK (tipo IN ('chegada_veiculo', 'chamado_atribuido',
                                  'atendimento_concluido', 'aviso')),
  titulo          VARCHAR(150) NOT NULL,
  mensagem        TEXT NOT NULL,
  dados           JSONB NOT NULL DEFAULT '{}'::jsonb,

  chamado_id      UUID REFERENCES chamados(id) ON DELETE CASCADE,
  atendimento_id  UUID REFERENCES atendimentos(id) ON DELETE CASCADE,
  veiculo_id      UUID REFERENCES veiculos(id) ON DELETE SET NULL,

  lida            BOOLEAN NOT NULL DEFAULT FALSE,
  lida_em         TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario ON notificacoes (destinatario_id, lida, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_unidade      ON notificacoes (unidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_atendimento  ON notificacoes (atendimento_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo         ON notificacoes (tipo);

-- Nao repetir a mesma notificacao para o mesmo destinatario e atendimento.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notificacao_atendimento_dest
  ON notificacoes (atendimento_id, tipo, destinatario_id)
  WHERE atendimento_id IS NOT NULL AND destinatario_id IS NOT NULL;

-- Idem para a notificacao "da unidade" (sem destinatario individual).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notificacao_atendimento_unidade
  ON notificacoes (atendimento_id, tipo)
  WHERE atendimento_id IS NOT NULL AND destinatario_id IS NULL;
