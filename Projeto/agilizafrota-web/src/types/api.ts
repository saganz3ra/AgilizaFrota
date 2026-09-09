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
