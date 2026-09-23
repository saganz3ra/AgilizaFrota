import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferências de interface do app (tema e tamanho da fonte), persistidas.
///
/// Por que um ChangeNotifier e não um valor global: mudar tema ou fonte precisa
/// reconstruir o `MaterialApp`. Expondo por Provider, só o topo da árvore
/// reconstrói quando muda — o resto da tela não se importa.
///
/// Persistência com `shared_preferences`: são preferências de INTERFACE, por
/// aparelho — não vão para o backend (não mudam regra de negócio) nem para o
/// banco de sincronização offline (que é só para dados operacionais).
class TemaController extends ChangeNotifier {
  static const _chaveTema = 'tema';
  static const _chaveFonte = 'escala_fonte';

  // Começa em `system`: antes de o usuário escolher, segue o tema do aparelho.
  ThemeMode _modo = ThemeMode.system;
  ThemeMode get modo => _modo;

  // 1.0 = padrão. Multiplica o tamanho de todo o texto (acessibilidade, RNF04).
  double _escalaFonte = 1.0;
  double get escalaFonte => _escalaFonte;

  TemaController() {
    _carregar();
  }

  Future<void> _carregar() async {
    final prefs = await SharedPreferences.getInstance();
    switch (prefs.getString(_chaveTema)) {
      case 'claro':
        _modo = ThemeMode.light;
        break;
      case 'escuro':
        _modo = ThemeMode.dark;
        break;
      case 'sistema':
        _modo = ThemeMode.system;
        break;
      // Sem valor salvo: mantém `system`.
    }
    final f = prefs.getDouble(_chaveFonte);
    if (f != null) _escalaFonte = f;
    notifyListeners();
  }

  Future<void> definirModo(ThemeMode modo) async {
    _modo = modo;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_chaveTema, switch (modo) {
      ThemeMode.light => 'claro',
      ThemeMode.dark => 'escuro',
      ThemeMode.system => 'sistema',
    });
  }

  Future<void> definirEscalaFonte(double escala) async {
    _escalaFonte = escala;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_chaveFonte, escala);
  }
}
