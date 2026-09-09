/// Perfil do usuario autenticado, como devolvido por `GET /api/auth/me`.
class Usuario {
  final String id;
  final String nome;
  final String email;
  final String papel;
  final String? telefone;
  final String? unidadeId;
  final bool ativo;

  const Usuario({
    required this.id,
    required this.nome,
    required this.email,
    required this.papel,
    required this.ativo,
    this.telefone,
    this.unidadeId,
  });

  factory Usuario.doJson(Map<String, dynamic> json) => Usuario(
        id: json['id'] as String,
        nome: (json['nome'] as String?) ?? '',
        email: (json['email'] as String?) ?? '',
        papel: (json['papel'] as String?) ?? '',
        telefone: json['telefone'] as String?,
        unidadeId: json['unidade_id'] as String?,
        ativo: json['ativo'] as bool? ?? true,
      );

  bool get ehMotorista => papel == 'motorista';

  /// Primeiro nome, para saudacao na tela inicial.
  String get primeiroNome => nome.trim().split(' ').first;
}
