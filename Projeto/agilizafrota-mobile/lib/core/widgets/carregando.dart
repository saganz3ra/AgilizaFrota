import 'package:flutter/material.dart';
import '../tema/cores.dart';

/// Indicador de carregamento centralizado, com rotulo opcional.
class Carregando extends StatelessWidget {
  final String? rotulo;

  const Carregando({super.key, this.rotulo});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: Cores.marca),
          if (rotulo != null) ...[
            const SizedBox(height: 16),
            Text(
              rotulo!,
              style: const TextStyle(color: Cores.conteudoSuave, fontSize: 15),
            ),
          ],
        ],
      ),
    );
  }
}
