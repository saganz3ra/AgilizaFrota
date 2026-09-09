import 'dart:convert';

/// Um registro aguardando envio ao servidor.
///
/// A fila guarda a INTENCAO do motorista, nao a resposta do servidor: o
/// que ele fez, quando fez e com quais dados. Assim o pacote pode ser
/// reenviado quantas vezes for preciso - o servidor resolve a duplicidade
/// pelo id, e o horario do evento preserva a cronologia real.
class ItemFila {
  /// Id da linha na fila local.
  final int? idLocal;

  /// Tipo aceito pelo `POST /api/sync` do backend.
  final String tipo;

  /// Marco, quando o tipo e `atendimento_marco`.
  final String? marco;

  /// Parametros de rota (ex.: id do turno ou do atendimento).
  final Map<String, dynamic> params;

  /// Corpo da requisicao.
  final Map<String, dynamic> dados;

  /// Quando o fato ACONTECEU (relogio do aparelho). Define a ordem de
  /// aplicacao no servidor - nao a ordem em que a rede voltou.
  final DateTime ocorridoEm;

  /// Quantas vezes ja tentamos enviar.
  final int tentativas;

  /// Ultimo erro recebido, mostrado ao motorista quando o item falha.
  final String? ultimoErro;

  const ItemFila({
    required this.tipo,
    required this.ocorridoEm,
    this.idLocal,
    this.marco,
    this.params = const {},
    this.dados = const {},
    this.tentativas = 0,
    this.ultimoErro,
  });

  /// Rotulo legivel, para a tela da fila.
  String get descricao {
    switch (tipo) {
      case 'turno_iniciar':
        return 'Abertura de turno';
      case 'turno_encerrar':
        return 'Encerramento de turno';
      case 'atendimento_iniciar':
        return 'Inicio de atendimento';
      case 'posicao':
        return 'Posicao de GPS';
      case 'atendimento_marco':
        switch (marco) {
          case 'chegada_local':
            return 'Chegada ao local';
          case 'inicio_transporte':
            return 'Inicio do transporte';
          case 'concluir':
            return 'Conclusao do atendimento';
          case 'cancelar':
            return 'Cancelamento do atendimento';
        }
        return 'Marco do atendimento';
      default:
        return tipo;
    }
  }

  /// Formato esperado por `POST /api/sync`.
  Map<String, dynamic> paraSync() => {
        'id_local': '$idLocal',
        'tipo': tipo,
        if (marco != null) 'marco': marco,
        'ocorrido_em': ocorridoEm.toUtc().toIso8601String(),
        if (params.isNotEmpty) 'params': params.map((c, v) => MapEntry(c, '$v')),
        if (dados.isNotEmpty) 'dados': dados,
      };

  Map<String, Object?> paraLinha() => {
        'tipo': tipo,
        'marco': marco,
        'params': jsonEncode(params),
        'dados': jsonEncode(dados),
        'ocorrido_em': ocorridoEm.toUtc().toIso8601String(),
        'tentativas': tentativas,
        'ultimo_erro': ultimoErro,
      };

  factory ItemFila.daLinha(Map<String, Object?> linha) => ItemFila(
        idLocal: linha['id'] as int?,
        tipo: linha['tipo'] as String,
        marco: linha['marco'] as String?,
        params: (jsonDecode(linha['params'] as String? ?? '{}') as Map)
            .cast<String, dynamic>(),
        dados: (jsonDecode(linha['dados'] as String? ?? '{}') as Map)
            .cast<String, dynamic>(),
        ocorridoEm: DateTime.parse(linha['ocorrido_em'] as String),
        tentativas: (linha['tentativas'] as int?) ?? 0,
        ultimoErro: linha['ultimo_erro'] as String?,
      );
}
