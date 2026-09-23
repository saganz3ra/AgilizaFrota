import 'package:flutter/material.dart';

/// Paleta do Agiliza Frota - a mesma linguagem visual do painel web
/// (`globals.css`), para que os dois clientes sejam reconhecidos como o
/// mesmo sistema.
///
/// Verde = ação/marca; azul-marinho = moldura (cabeçalho); branco =
/// superfícies; cinza claro = fundo. Alto contraste, pensado para leitura
/// rápida sob pressão (RNF04).
class Cores {
  const Cores._();

  // Marca = verde (ações primárias, estado ativo)
  static const Color marca = Color(0xFF16A34A);
  static const Color marcaEscura = Color(0xFF15803D);
  static const Color marcaClara = Color(0xFFE7F6EC);
  static const Color marcaContraste = Color(0xFFFFFFFF);

  // Marinho = moldura (AppBar / cabeçalhos)
  static const Color marinho = Color(0xFF0F2B46);
  static const Color marinhoEscuro = Color(0xFF0A2036);

  // Superfícies
  static const Color superficie = Color(0xFFFFFFFF);
  static const Color superficieSuave = Color(0xFFF4F7FA);
  static const Color borda = Color(0xFFE6EBF1);

  // Texto
  static const Color conteudo = Color(0xFF0F2233);
  static const Color conteudoSuave = Color(0xFF64748B);
  static const Color conteudoInverso = Color(0xFFFFFFFF);

  // Estados do veículo (verde/azul/âmbar, distintos entre si)
  static const Color statusDisponivel = Color(0xFF16A34A);
  static const Color statusEmUso = Color(0xFF2563EB);
  static const Color statusManutencao = Color(0xFFD97706);

  // Prioridades do chamado
  static const Color prioridadeCritica = Color(0xFFDC2626);
  static const Color prioridadeAlta = Color(0xFFEA580C);
  static const Color prioridadeMedia = Color(0xFF2563EB);
  static const Color prioridadeBaixa = Color(0xFF64748B);

  // ------------------------------------------------------------------
  // Modo escuro
  //
  // So as cores que dependem do tema (superficies, texto, borda) ganham
  // versao escura. Marca (verde), prioridades e status permanecem os mesmos
  // nos dois temas, de proposito: sao cores SEMANTICAS - "critico" precisa
  // ser o mesmo vermelho no claro e no escuro, senao o motorista teria de
  // reaprender o codigo de cores ao trocar de tema.
  //
  // Regra pratica do Flutter: cor que muda com o tema mora no ThemeData
  // (lida via Theme.of(context)), nao numa constante fixa. Por isso essas
  // cores alimentam o `TemaApp.escuro`, e as telas leem do ColorScheme -
  // nao referenciam estas constantes direto.
  // ------------------------------------------------------------------

  // Marca mais clara: #16A34A fica apagado sobre fundo escuro; #22C55E
  // mantem contraste com texto e nao "some".
  static const Color marcaEscuraTema = Color(0xFF22C55E);
  static const Color marcaContrasteEscuro = Color(0xFF04140B);

  // Superficies escuras em azul-ardosia (nao preto puro): cansa menos a
  // vista e preserva a identidade azul/verde do sistema.
  static const Color superficieEscura = Color(0xFF0F172A); // cards
  static const Color fundoEscuro = Color(0xFF0B1220); // scaffold
  static const Color bordaEscura = Color(0xFF1E293B);

  static const Color conteudoClaro = Color(0xFFE2E8F0);
  static const Color conteudoClaroSuave = Color(0xFF94A3B8);

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

  /// Cor de um status de veículo, pelo nome que a API devolve.
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
