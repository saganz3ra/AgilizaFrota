// Teste do TemaController: a preferência de interface (tema e escala de fonte)
// precisa sobreviver ao fechamento do app (RNF04). Sem rede nem Firebase.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:agilizafrota_mobile/core/tema/tema_controller.dart';

void main() {
  // shared_preferences fala com o SO por canal de plataforma; no teste,
  // ensureInitialized + setMockInitialValues trocam isso por um mapa em memória.
  TestWidgetsFlutterBinding.ensureInitialized();

  group('TemaController', () {
    test('sem nada salvo, começa em system e fonte 1.0', () async {
      SharedPreferences.setMockInitialValues({});
      final c = TemaController();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(c.modo, ThemeMode.system);
      expect(c.escalaFonte, 1.0);
    });

    test('carrega o tema e a fonte que estavam salvos', () async {
      SharedPreferences.setMockInitialValues({
        'tema': 'escuro',
        'escala_fonte': 1.2,
      });
      final c = TemaController();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(c.modo, ThemeMode.dark);
      expect(c.escalaFonte, 1.2);
    });

    test('definirModo persiste o tema (escuro -> "escuro")', () async {
      SharedPreferences.setMockInitialValues({});
      final c = TemaController();
      await c.definirModo(ThemeMode.dark);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('tema'), 'escuro');
      expect(c.modo, ThemeMode.dark);
    });

    test('definirEscalaFonte persiste a escala', () async {
      SharedPreferences.setMockInitialValues({});
      final c = TemaController();
      await c.definirEscalaFonte(0.9);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getDouble('escala_fonte'), 0.9);
      expect(c.escalaFonte, 0.9);
    });

    test('notifica ouvintes ao trocar de tema (rebuild do MaterialApp)', () async {
      SharedPreferences.setMockInitialValues({});
      final c = TemaController();
      var avisos = 0;
      c.addListener(() => avisos++);
      await c.definirModo(ThemeMode.light);
      expect(avisos, greaterThan(0));
    });
  });
}
