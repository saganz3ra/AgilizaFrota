/** Tipos compartilhados espelhando as respostas da API (backend). */

export type Papel = "motorista" | "central" | "recepcionista";

export interface Usuario {
  id: string;
  firebase_uid: string;
  nome: string;
  email: string;
  papel: Papel;
  unidade_id: string | null;
  telefone: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em?: string;
}

export type StatusVeiculo = "disponivel" | "em_uso" | "manutencao";

export interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string | null;
  ano: number | null;
  quilometragem_atual: number;
  status: StatusVeiculo;
  unidade_id: string | null;
  ultima_revisao: string | null;
  ativo: boolean;
}

export interface Unidade {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  lat: string | null;
  lng: string | null;
  ativo: boolean;
}

export type StatusTurno = "aberto" | "encerrado";

export interface Turno {
  id: string;
  motorista_id: string;
  veiculo_id: string;
  status: StatusTurno;
  km_inicial: number;
  km_final: number | null;
  inicio_em: string;
  fim_em: string | null;
}

export interface ItemChecklist {
  codigo: string;
  descricao: string;
  critico: boolean;
}

export interface RespostaChecklist {
  codigo: string;
  conforme: boolean;
  observacao?: string;
}

export interface Checklist {
  id: string;
  respostas: RespostaChecklist[];
  aprovado: boolean;
  realizado_em: string;
}

export interface TurnoDetalhe {
  turno: Turno;
  checklist: Checklist | null;
}

export type TipoChamado = "urgencia" | "emergencia";
export type PrioridadeChamado = "baixa" | "media" | "alta" | "critica";
export type StatusChamado =
  | "aberto"
  | "atribuido"
  | "em_atendimento"
  | "concluido"
  | "cancelado";

/** Sugestão de veículo calculada pelo backend (RF08). */
export interface SugestaoVeiculo {
  veiculo_id: string;
  placa: string;
  modelo: string;
  unidade_id: string | null;
  unidade_nome: string | null;
  turno_id: string | null;
  motorista_id: string | null;
  motorista_nome: string | null;
  pontuacao: number;
  motivos: string[];
  distancia_km: number | null;
}

export type StatusAtribuicao = "ativa" | "cancelada" | "concluida";

export interface Atribuicao {
  id: string;
  chamado_id: string;
  veiculo_id: string;
  motorista_id: string | null;
  turno_id: string | null;
  atribuido_por: string | null;
  origem: "manual" | "sugestao";
  status: StatusAtribuicao;
  motivo_cancelamento: string | null;
  atribuido_em: string;
  encerrado_em: string | null;
}

export interface Chamado {
  id: string;
  tipo: TipoChamado;
  prioridade: PrioridadeChamado;
  natureza: string;
  descricao: string | null;
  status: StatusChamado;
  origem_tipo: "central" | "sistema_externo";
  destino_unidade_id: string | null;
  aberto_em: string;
}

// ---------------------------------------------------------------------------
// Monitoramento da frota por GPS (RF11 / RNF10)
// ---------------------------------------------------------------------------

/**
 * Situação do rastreamento, derivada da idade da última posição recebida.
 * Os limiares vêm do próprio backend (`limiares_segundos`), para que a
 * regra não fique duplicada aqui.
 */
export type StatusRastreamento = "online" | "instavel" | "offline" | "sem_dados";

export interface VeiculoNoMapa {
  veiculo_id: string;
  placa: string;
  modelo: string;
  status_veiculo: StatusVeiculo;
  unidade_id: string | null;
  unidade_nome: string | null;

  // Última posição conhecida. Nulas quando o veículo nunca enviou GPS.
  lat: number | null;
  lng: number | null;
  velocidade_kmh: number | null;
  direcao_graus: number | null;
  precisao_m: number | null;
  qualidade: "boa" | "baixa" | "suspeita" | null;
  registrado_em: string | null;
  recebido_em: string | null;

  motorista_nome: string | null;
  atendimento_id: string | null;
  atendimento_status: string | null;

  rastreamento: StatusRastreamento;
  idade_segundos: number | null;
}

export interface MapaFrota {
  total: number;
  atualizado_em: string;
  limiares_segundos: { online: number; instavel: number };
  veiculos: VeiculoNoMapa[];
}

/** Ponto do rastro histórico de um veículo. */
export interface PosicaoGps {
  id: string;
  veiculo_id: string;
  lat: number;
  lng: number;
  velocidade_kmh: number | null;
  qualidade: string | null;
  descartada: boolean;
  registrado_em: string;
}

// ---------------------------------------------------------------------------
// Notificações (RF15)
// ---------------------------------------------------------------------------

/** Dados extras da notificação de chegada, gravados como JSONB. */
export interface DadosChegada {
  placa?: string;
  motorista?: string | null;
  natureza?: string | null;
  prioridade?: PrioridadeChamado | null;
  distancia_m?: number | null;
  unidade?: string | null;
}

export interface Notificacao {
  id: string;
  destinatario_id: string | null;
  unidade_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  dados: DadosChegada | null;
  chamado_id: string | null;
  atendimento_id: string | null;
  veiculo_id: string | null;
  lida: boolean;
  lida_em: string | null;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Atendimentos (RF09 / RF10 / RNF09)
// ---------------------------------------------------------------------------

export type StatusAtendimento =
  | "a_caminho"
  | "no_local"
  | "em_transporte"
  | "concluido"
  | "cancelado";

/** Métricas calculadas a partir dos marcos. Nulas enquanto o marco não veio. */
export interface MetricasAtendimento {
  distancia_total_km: number | null;
  distancia_ate_local_km: number | null;
  distancia_transporte_km: number | null;
  tempo_resposta_min: number | null;
  tempo_no_local_min: number | null;
  tempo_transporte_min: number | null;
  tempo_total_min: number | null;
}

export interface Atendimento extends MetricasAtendimento {
  id: string;
  chamado_id: string;
  atribuicao_id: string | null;
  veiculo_id: string;
  motorista_id: string;
  turno_id: string | null;
  status: StatusAtendimento;

  km_saida: number;
  km_local: number | null;
  km_final: number | null;

  inicio_em: string;
  chegada_local_em: string | null;
  inicio_transporte_em: string | null;
  fim_em: string | null;

  // RF10 — validação manual pela Central
  validado: boolean | null;
  validado_por: string | null;
  validado_em: string | null;
  observacao_validacao: string | null;
  km_total_ajustado: number | null;
  tempo_total_ajustado_min: number | null;

  observacoes: string | null;
  motivo_cancelamento: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Resposta de `GET /atendimentos/:id`, com o recálculo para conferência. */
export interface AtendimentoDetalhe {
  atendimento: Atendimento;
  metricas_recalculadas: MetricasAtendimento;
  conferencia: { consistente: boolean; problemas: string[] };
}
