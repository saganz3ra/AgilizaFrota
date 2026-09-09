import '../../core/api/api_cliente.dart';
import '../painel/painel_modelo.dart';

/// Veiculo disponivel para o motorista escolher ao abrir o turno.
class VeiculoOpcao {
  final String id;
  final String placa;
  final String modelo;
  final String status;
  final int quilometragemAtual;

  const VeiculoOpcao({
    required this.id,
    required this.placa,
    required this.modelo,
    required this.status,
    required this.quilometragemAtual,
  });

  factory VeiculoOpcao.doJson(Map<String, dynamic> j) => VeiculoOpcao(
        id: j['id'] as String,
        placa: (j['placa'] as String?) ?? '',
        modelo: (j['modelo'] as String?) ?? '',
        status: (j['status'] as String?) ?? '',
        quilometragemAtual: (j['quilometragem_atual'] as num?)?.toInt() ?? 0,
      );

  String get rotulo => '$placa - $modelo';
}

/// Resposta do motorista a um item do checklist (RF04).
class RespostaChecklist {
  final ItemChecklist item;
  bool? conforme;
  String observacao = '';

  RespostaChecklist(this.item);

  bool get respondido => conforme != null;

  /// Item critico marcado como nao conforme bloqueia o turno e manda o
  /// veiculo para manutencao - regra aplicada pelo backend.
  bool get bloqueiaTurno => item.critico && conforme == false;

  Map<String, dynamic> paraJson() => {
        'codigo': item.codigo,
        'conforme': conforme ?? false,
        if (observacao.trim().isNotEmpty) 'observacao': observacao.trim(),
      };
}

/// Chamadas de turno e checklist (RF03/RF04).
class TurnoServico {
  final ApiCliente api;

  const TurnoServico(this.api);

  /// Veiculos que o motorista pode assumir.
  ///
  /// Dois filtros, e os dois sao necessarios:
  ///  - `status=disponivel` exclui o que esta em uso (ja tem turno aberto)
  ///    e o que esta em manutencao;
  ///  - `ativo=true` exclui o que foi baixado do cadastro. A listagem so
  ///    aplica esse filtro quando pedido, entao sem ele o app ofereceria
  ///    um veiculo que o backend recusa na hora de abrir o turno.
  Future<List<VeiculoOpcao>> veiculosDisponiveis() async {
    final resposta = await api.get('/veiculos', parametros: {
      'status': 'disponivel',
      'ativo': 'true',
    });
    final lista = (resposta as Map)['veiculos'] as List? ?? const [];
    return lista
        .map((v) => VeiculoOpcao.doJson((v as Map).cast<String, dynamic>()))
        .toList();
  }

  /// Catalogo de itens do checklist, caso o painel nao o tenha trazido.
  Future<List<ItemChecklist>> itensChecklist() async {
    final resposta = await api.get('/turnos/checklist/itens');
    final lista = (resposta as Map)['itens'] as List? ?? const [];
    return lista
        .map((i) => ItemChecklist.doJson((i as Map).cast<String, dynamic>()))
        .toList();
  }

  /// Abre o turno.
  ///
  /// O [idLocal] e gerado no aparelho ANTES do envio. Se a resposta se
  /// perder no caminho e o motorista tentar de novo, o servidor reconhece
  /// o mesmo id e devolve o turno ja criado em vez de abrir outro
  /// (RNF03 - idempotencia).
  Future<Map<String, dynamic>> iniciar({
    required String idLocal,
    required String veiculoId,
    required int kmInicial,
    required String fotoUrl,
    required List<RespostaChecklist> respostas,
    DateTime? inicioEm,
  }) async {
    final resposta = await api.post('/turnos/iniciar', {
      'id': idLocal,
      'veiculo_id': veiculoId,
      'km_inicial': kmInicial,
      'foto_inicio_url': fotoUrl,
      // Horario do EVENTO, do relogio do celular. Se o envio ficar na fila
      // por falta de sinal, o relatorio mostra quando o turno comecou de
      // verdade, nao quando a internet voltou.
      'inicio_em': (inicioEm ?? DateTime.now()).toUtc().toIso8601String(),
      'checklist': {
        'realizado_em': DateTime.now().toUtc().toIso8601String(),
        'respostas': respostas.map((r) => r.paraJson()).toList(),
      },
    });
    return (resposta as Map).cast<String, dynamic>();
  }

  /// Encerra o turno.
  Future<Map<String, dynamic>> encerrar({
    required String turnoId,
    required int kmFinal,
    required String fotoUrl,
    DateTime? fimEm,
  }) async {
    final resposta = await api.post('/turnos/$turnoId/encerrar', {
      'km_final': kmFinal,
      'foto_fim_url': fotoUrl,
      'fim_em': (fimEm ?? DateTime.now()).toUtc().toIso8601String(),
    });
    return (resposta as Map).cast<String, dynamic>();
  }
}
