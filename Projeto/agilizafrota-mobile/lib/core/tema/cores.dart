import 'package:flutter/material.dart';

/// Paleta do Agiliza Frota - identica aos tokens do painel web
/// (`globals.css`), para que os dois clientes sejam reconhecidos como o
/// mesmo sistema.
///
/// Padrao clinico institucional: azul e branco, alto contraste, pensado
/// para leitura rapida sob pressao (RNF04).
class Cores {
  const Cores._();

  // Marca
  static const Color marca = Color(0xFF1256B8);
  static const Color marcaEscura = Color(0xFF0E458F);
  static const Color marcaClara = Color(0xFFE8F0FC);
  static const Color marcaContraste = Color(0xFFFFFFFF);

  // Superficies
  static const Color superficie = Color(0xFFFFFFFF);
  static const Color superficieSuave = Color(0xFFF4F6FA);
  static const Color borda = Color(0xFFDCE3EC);

  // Texto
  static const Color conteudo = Color(0xFF101828);
  static const Color conteudoSuave = Color(0xFF5B6472);
  static const Color conteudoInverso = Color(0xFFFFFFFF);

  // Estados do veiculo
  static const Color statusDisponivel = Color(0xFF157347);
  static const Color statusEmUso = Color(0xFF1256B8);
  static const Color statusManutencao = Color(0xFFB45309);

  // Prioridades do chamado
  static const Color prioridadeCritica = Color(0xFFB42318);
  static const Color prioridadeAlta = Color(0xFFC4560C);
  static const Color prioridadeMedia = Color(0xFF1256B8);
  static const Color prioridadeBaixa = Color(0xFF5B6472);

  /// Cor de uma prioridade de chamado, pelo nome que a API devolve.
  static Color daPrioridade(String? prioridade) {
    switch (prioridade) {
      case 'critica':
        return prioridadeCritica;
      case 'alta':
        return prioridadeAlta;
      case 'media':
        return prioridadeMedia;
      default:
        return prioridadeBaixa;
    }
  }

  /// Cor de um status de veiculo, pelo nome que a API devolve.
  static Color doStatusVeiculo(String? status) {
    switch (status) {
      case 'disponivel':
        return statusDisponivel;
      case 'em_uso':
        return statusEmUso;
      case 'manutencao':
        return statusManutencao;
      default:
        return conteudoSuave;
    }
  }
}
