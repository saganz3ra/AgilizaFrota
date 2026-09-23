import 'package:flutter/material.dart';
import 'cores.dart';

/// Tema do aplicativo.
///
/// Decisoes de design vindas do RNF04 ("interface simples, intuitiva e
/// adequada para uso sob pressao") e do RNF11 ("minimizar interacoes do
/// motorista"):
///  - alvos de toque grandes (56 px), porque o motorista pode estar com
///    luva, com pressa ou com o veiculo em movimento;
///  - tipografia maior que o padrao do Material;
///  - alto contraste, para leitura sob sol forte ou luz de emergencia.
///
/// Claro e escuro compartilham o MESMO construtor (`_construir`): so mudam as
/// cores que dependem do tema (superficies, texto, borda, marca). Assim,
/// qualquer ajuste de espacamento, raio ou tipografia vale para os dois temas
/// de uma vez - nao ha risco de um tema ficar para tras do outro.
class TemaApp {
  const TemaApp._();

  /// Altura minima de qualquer botao principal.
  static const double alturaToque = 56;

  static ThemeData get claro => _construir(
        brilho: Brightness.light,
        marca: Cores.marca,
        marcaContraste: Cores.marcaContraste,
        superficie: Cores.superficie,
        fundo: Cores.superficieSuave,
        borda: Cores.borda,
        conteudo: Cores.conteudo,
        conteudoSuave: Cores.conteudoSuave,
      );

  static ThemeData get escuro => _construir(
        brilho: Brightness.dark,
        marca: Cores.marcaEscuraTema,
        marcaContraste: Cores.marcaContrasteEscuro,
        superficie: Cores.superficieEscura,
        fundo: Cores.fundoEscuro,
        borda: Cores.bordaEscura,
        conteudo: Cores.conteudoClaro,
        conteudoSuave: Cores.conteudoClaroSuave,
      );

  /// Monta o ThemeData a partir das cores que variam com o tema.
  ///
  /// A moldura (AppBar) fica em azul-marinho nos DOIS temas: e a assinatura
  /// visual do sistema, igual a barra lateral do painel web. As acoes
  /// primarias e que sao verdes (elevatedButton), para o olho achar o botao.
  static ThemeData _construir({
    required Brightness brilho,
    required Color marca,
    required Color marcaContraste,
    required Color superficie,
    required Color fundo,
    required Color borda,
    required Color conteudo,
    required Color conteudoSuave,
  }) {
    final esquema = ColorScheme.fromSeed(
      seedColor: marca,
      brightness: brilho,
    ).copyWith(
      primary: marca,
      onPrimary: marcaContraste,
      surface: superficie,
      onSurface: conteudo,
      // onSurfaceVariant e a cor "de apoio" (texto secundario, icones): as
      // telas leem daqui, entao ela precisa acompanhar o tema.
      onSurfaceVariant: conteudoSuave,
      outlineVariant: borda,
      error: Cores.prioridadeCritica,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: esquema,
      scaffoldBackgroundColor: fundo,
      appBarTheme: const AppBarTheme(
        // Moldura em azul-marinho (igual à sidebar do painel web) nos dois
        // temas; as ações primárias é que ficam em verde (elevatedButton).
        backgroundColor: Cores.marinho,
        foregroundColor: Cores.marcaContraste,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Cores.marcaContraste,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      textTheme: TextTheme(
        headlineSmall: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: conteudo,
        ),
        titleMedium: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: conteudo,
        ),
        bodyLarge: TextStyle(fontSize: 17, color: conteudo),
        bodyMedium: TextStyle(fontSize: 15, color: conteudo),
        bodySmall: TextStyle(fontSize: 14, color: conteudoSuave),
      ),
      cardTheme: CardThemeData(
        color: superficie,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: borda),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: superficie,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: borda),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: borda),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: marca, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Cores.prioridadeCritica),
        ),
        labelStyle: TextStyle(color: conteudoSuave, fontSize: 16),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: marca,
          foregroundColor: marcaContraste,
          minimumSize: const Size.fromHeight(alturaToque),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: marca,
          minimumSize: const Size.fromHeight(alturaToque),
          side: BorderSide(color: marca, width: 1.5),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      dividerTheme: DividerThemeData(color: borda, space: 1),
    );
  }
}
