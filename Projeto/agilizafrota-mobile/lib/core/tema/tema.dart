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
class TemaApp {
  const TemaApp._();

  /// Altura minima de qualquer botao principal.
  static const double alturaToque = 56;

  static ThemeData get claro {
    final esquema = ColorScheme.fromSeed(
      seedColor: Cores.marca,
      brightness: Brightness.light,
    ).copyWith(
      primary: Cores.marca,
      onPrimary: Cores.marcaContraste,
      surface: Cores.superficie,
      onSurface: Cores.conteudo,
      error: Cores.prioridadeCritica,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: esquema,
      scaffoldBackgroundColor: Cores.superficieSuave,
      appBarTheme: const AppBarTheme(
        backgroundColor: Cores.marca,
        foregroundColor: Cores.marcaContraste,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Cores.marcaContraste,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      textTheme: const TextTheme(
        headlineSmall: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: Cores.conteudo,
        ),
        titleMedium: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: Cores.conteudo,
        ),
        bodyLarge: TextStyle(fontSize: 17, color: Cores.conteudo),
        bodyMedium: TextStyle(fontSize: 15, color: Cores.conteudo),
        bodySmall: TextStyle(fontSize: 14, color: Cores.conteudoSuave),
      ),
      cardTheme: CardThemeData(
        color: Cores.superficie,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Cores.borda),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Cores.superficie,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Cores.borda),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Cores.borda),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Cores.marca, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Cores.prioridadeCritica),
        ),
        labelStyle: const TextStyle(color: Cores.conteudoSuave, fontSize: 16),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: Cores.marca,
          foregroundColor: Cores.marcaContraste,
          minimumSize: const Size.fromHeight(alturaToque),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Cores.marca,
          minimumSize: const Size.fromHeight(alturaToque),
          side: const BorderSide(color: Cores.marca, width: 1.5),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      dividerTheme: const DividerThemeData(color: Cores.borda, space: 1),
    );
  }
}
