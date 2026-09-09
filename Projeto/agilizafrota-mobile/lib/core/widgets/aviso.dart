import 'package:flutter/material.dart';
import '../tema/cores.dart';

/// Faixa de aviso usada para erros e mensagens de estado.
///
/// Uma so aparencia para todo o app: o motorista aprende a reconhecer o
/// bloco vermelho como "algo deu errado" e o azul como "informacao".
class Aviso extends StatelessWidget {
  final String mensagem;
  final bool ehErro;
  final IconData? icone;

  const Aviso({
    super.key,
    required this.mensagem,
    this.ehErro = true,
    this.icone,
  });

  const Aviso.info({super.key, required this.mensagem, this.icone})
      : ehErro = false;

  @override
  Widget build(BuildContext context) {
    final cor = ehErro ? Cores.prioridadeCritica : Cores.marca;
    final fundo = ehErro ? const Color(0xFFFEF3F2) : Cores.marcaClara;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: fundo,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: cor.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icone ?? (ehErro ? Icons.error_outline : Icons.info_outline),
            color: cor,
            size: 22,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              mensagem,
              style: TextStyle(color: cor, fontSize: 15, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}
