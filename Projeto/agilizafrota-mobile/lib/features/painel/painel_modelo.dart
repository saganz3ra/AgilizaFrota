/// Modelos do painel do motorista (`GET /api/motorista/painel`).
///
/// Uma unica chamada resolve a tela inicial inteira - decisao do backend
/// para o RNF11 (minimizar interacoes). Aqui apenas espelhamos o formato.

/// Turno aberto do motorista, se houver.
class TurnoResumo {
  final String id;
  final String veiculoId;
  final int kmInicial;
  final DateTime inicioEm;

  const TurnoResumo({
    required this.id,
    required this.veiculoId,
    required this.kmInicial,
    required this.inicioEm,
  });

  factory TurnoResumo.doJson(Map<String, dynamic> j) => TurnoResumo(
        id: j['id'] as String,
        veiculoId: j['veiculo_id'] as String,
        kmInicial: (j['km_inicial'] as num).toInt(),
        inicioEm: DateTime.parse(j['inicio_em'] as String).toLocal(),
      );
}

/// Veiculo em uso no turno.
class VeiculoResumo {
  final String id;
  final String placa;
  final String modelo;
  final int quilometragemAtual;
  final String status;

  const VeiculoResumo({
    required this.id,
    required this.placa,
    required this.modelo,
    required this.quilometragemAtual,
    required this.status,
  });

  factory VeiculoResumo.doJson(Map<String, dynamic> j) => VeiculoResumo(
        id: j['id'] as String,
        placa: (j['placa'] as String?) ?? '',
        modelo: (j['modelo'] as String?) ?? '',
        quilometragemAtual: (j['quilometragem_atual'] as num?)?.toInt() ?? 0,
        status: (j['status'] as String?) ?? '',
      );
}

/// Chamado acionado pela central (atribuicao ativa) ou em atendimento.
class ChamadoResumo {
  final String chamadoId;
  final String natureza;
  final String tipo;
  final String prioridade;
  final String? origemEndereco;
  final String? destinoNome;

  const ChamadoResumo({
    required this.chamadoId,
    required this.natureza,
    required this.tipo,
    required this.prioridade,
    this.origemEndereco,
    this.destinoNome,
  });

  factory ChamadoResumo.doJson(Map<String, dynamic> j) => ChamadoResumo(
        chamadoId: (j['chamado_id'] ?? j['id']) as String,
        natureza: (j['natureza'] as String?) ?? 'Chamado',
        tipo: (j['tipo'] as String?) ?? '',
        prioridade: (j['prioridade'] as String?) ?? 'media',
        origemEndereco: j['origem_endereco'] as String?,
        destinoNome: j['destino_nome'] as String?,
      );

  bool get ehEmergencia => tipo == 'emergencia';
}

/// Atendimento em andamento.
class AtendimentoResumo {
  final String id;
  final String chamadoId;
  final String status;
  final ChamadoResumo chamado;

  const AtendimentoResumo({
    required this.id,
    required this.chamadoId,
    required this.status,
    required this.chamado,
  });

  factory AtendimentoResumo.doJson(Map<String, dynamic> j) => AtendimentoResumo(
        id: j['id'] as String,
        chamadoId: j['chamado_id'] as String,
        status: (j['status'] as String?) ?? '',
        chamado: ChamadoResumo.doJson(j),
      );

  /// Rotulo legivel da etapa atual, para o motorista se situar.
  String get etapa {
    switch (status) {
      case 'a_caminho':
        return 'A caminho da ocorrencia';
      case 'no_local':
        return 'No local da ocorrencia';
      case 'em_transporte':
        return 'Em transporte para a unidade';
      default:
        return status;
    }
  }
}

/// A proxima acao sugerida pelo backend - o coracao do RNF11.
///
/// O servidor decide o que o motorista deve fazer agora e ja devolve os
/// valores que ele nao precisa digitar (ex.: a quilometragem atual do
/// veiculo). O app so precisa desenhar um botao.
class ProximaAcao {
  /// Identificador da acao: iniciar_turno, iniciar_atendimento,
  /// registrar_chegada, iniciar_transporte, concluir_atendimento, aguardar.
  final String acao;
  final String rotulo;
  final String? endpoint;
  final List<String> requer;
  final Map<String, dynamic> sugestao;
  final String? dica;

  const ProximaAcao({
    required this.acao,
    required this.rotulo,
    this.endpoint,
    this.requer = const [],
    this.sugestao = const {},
    this.dica,
  });

  factory ProximaAcao.doJson(Map<String, dynamic> j) => ProximaAcao(
        acao: (j['acao'] as String?) ?? 'aguardar',
        rotulo: (j['rotulo'] as String?) ?? '',
        endpoint: j['endpoint'] as String?,
        requer: ((j['requer'] as List?) ?? const [])
            .map((e) => e.toString())
            .toList(),
        sugestao: (j['sugestao'] as Map?)?.cast<String, dynamic>() ?? const {},
        dica: j['dica'] as String?,
      );

  /// Quando nao ha nada a fazer, o botao vira apenas um aviso.
  bool get ehEspera => acao == 'aguardar';
}

/// Item do checklist obrigatorio (RF04), enviado junto quando nao ha turno.
class ItemChecklist {
  final String codigo;
  final String descricao;
  final bool critico;

  const ItemChecklist({
    required this.codigo,
    required this.descricao,
    required this.critico,
  });

  factory ItemChecklist.doJson(Map<String, dynamic> j) => ItemChecklist(
        codigo: j['codigo'] as String,
        descricao: (j['descricao'] as String?) ?? '',
        critico: j['critico'] as bool? ?? false,
      );
}

/// Estado completo da tela inicial.
class PainelMotorista {
  final TurnoResumo? turno;
  final VeiculoResumo? veiculo;
  final ChamadoResumo? atribuicao;
  final AtendimentoResumo? atendimento;
  final int notificacoesNaoLidas;
  final List<ItemChecklist> itensChecklist;
  final ProximaAcao proximaAcao;

  const PainelMotorista({
    required this.proximaAcao,
    this.turno,
    this.veiculo,
    this.atribuicao,
    this.atendimento,
    this.notificacoesNaoLidas = 0,
    this.itensChecklist = const [],
  });

  factory PainelMotorista.doJson(Map<String, dynamic> j) {
    Map<String, dynamic>? mapa(String chave) =>
        (j[chave] as Map?)?.cast<String, dynamic>();

    return PainelMotorista(
      turno: mapa('turno') == null ? null : TurnoResumo.doJson(mapa('turno')!),
      veiculo:
          mapa('veiculo') == null ? null : VeiculoResumo.doJson(mapa('veiculo')!),
      atribuicao: mapa('atribuicao') == null
          ? null
          : ChamadoResumo.doJson(mapa('atribuicao')!),
      atendimento: mapa('atendimento') == null
          ? null
          : AtendimentoResumo.doJson(mapa('atendimento')!),
      notificacoesNaoLidas: (j['notificacoes_nao_lidas'] as num?)?.toInt() ?? 0,
      itensChecklist: ((j['checklist_itens'] as List?) ?? const [])
          .map((e) => ItemChecklist.doJson((e as Map).cast<String, dynamic>()))
          .toList(),
      proximaAcao:
          ProximaAcao.doJson((j['proxima_acao'] as Map).cast<String, dynamic>()),
    );
  }

  bool get temTurnoAberto => turno != null;
}
