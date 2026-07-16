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

export type TipoChamado = "urgencia" | "emergencia";
export type PrioridadeChamado = "baixa" | "media" | "alta" | "critica";
export type StatusChamado =
  | "aberto"
  | "atribuido"
  | "em_atendimento"
  | "concluido"
  | "cancelado";

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
