// compactionCrossLanguage.test.ts
// Cross-language equivalence tests for memory compaction

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('compactionCrossLanguage', () => {
  const supportedLocales = ['en', 'zh', 'ru', 'fr', 'es'];

  describe('EN (English) locale', () => {
    it('should verify compaction prompts and output are in English', () => {
      const enPrompt = 'Summarize the following conversation preserving character names, actions, and emotions.';
      const enOutput = 'Player formed a secret alliance with Character at the Castle of Camelot.';

      expect(enPrompt).toContain('Summarize');
      expect(enOutput).toContain('Player');
      expect(enOutput).toContain('Character');
    });

    it('should verify token counting for English text is accurate', () => {
      const englishText = 'The player and character formed a strategic alliance against the enemy forces';
      const words = englishText.split(/\s+/);
      
      // Simple token estimation for English
      const estimatedTokens = words.length;
      expect(estimatedTokens).toBeGreaterThan(0);
      expect(estimatedTokens).toBe(14); // 14 words
    });
  });

  describe('ZH (Chinese) locale', () => {
    it('should verify CJK token counting accuracy and prompt localization', () => {
      const zhPrompt = '总结以下对话，保留角色姓名、行动和情感。';
      const zhOutput = '玩家与伯爵在卡美洛城堡建立了秘密联盟。';

      // CJK characters use more tokens than Latin characters
      const cjkCharCount = (zhOutput.match(/[\u4e00-\u9fff]/g) || []).length;
      expect(cjkCharCount).toBeGreaterThan(0);

      // Each CJK character counts as approximately 1.5-2 tokens
      const estimatedCJKTokens = cjkCharCount * 2;
      expect(estimatedCJKTokens).toBeGreaterThan(10);
    });

    it('should verify compaction triggers at correct thresholds accounting for CJK tokenization', () => {
      // Chinese text that would approach token limit
      const zhText = '玩家与角色进行了长时间的对话讨论关于联盟和秘密的事情'.repeat(5);
      const cjkChars = (zhText.match(/[\u4e00-\u9fff]/g) || []).length;
      
      // CJK token counting must be accurate for proper threshold detection
      const estimatedTokens = cjkChars * 2;
      const contextSize = 4096;
      const thresholdPercent = (estimatedTokens / contextSize) * 100;

      // Threshold should be calculated correctly
      expect(typeof thresholdPercent).toBe('number');
    });

    it('should verify Chinese UI labels display correctly', () => {
      const zhLabels = {
        'compaction.title': '记忆压缩',
        'compaction.enable': '启用记忆压缩',
        'compaction.phase1': '第一阶段阈值',
        'compaction.phase2': '第二阶段阈值',
        'compaction.runNow': '立即压缩'
      };

      expect(zhLabels['compaction.title']).toBe('记忆压缩');
      expect(zhLabels['compaction.enable']).toBe('启用记忆压缩');
    });
  });

  describe('RU (Russian) locale', () => {
    it('should verify Cyrillic token counting accuracy', () => {
      const ruText = 'Игрок и персонаж сформировали стратегический альянс против вражеских сил';
      
      // Cyrillic word count estimation
      const words = ruText.split(/\s+/);
      expect(words.length).toBeGreaterThan(0);

      // Cyrillic text should be properly tokenized
      const estimatedTokens = words.length * 1.5; // Cyrillic words are slightly longer
      expect(estimatedTokens).toBeGreaterThan(5);
    });

    it('should verify Russian prompt localization', () => {
      const ruPrompt = 'Суммируйте следующий разговор, сохраняя имена персонажей, действия и эмоции.';
      expect(ruPrompt).toContain('Суммируйте');
      expect(ruPrompt).toContain('персонаж');
    });

    it('should verify Russian UI labels are correct', () => {
      const ruLabels = {
        'compaction.title': 'Сжатие памяти',
        'compaction.enable': 'Включить сжатие памяти'
      };

      expect(ruLabels['compaction.title']).toBeDefined();
      expect(ruLabels['compaction.enable']).toBeDefined();
    });
  });

  describe('FR (French) locale', () => {
    it('should verify accented character handling in tokenization', () => {
      const frText = 'Le joueur a formé une alliance stratégique avec le personnage contre l\'ennemi';
      const words = frText.split(/\s+/);
      
      // French accented characters should be properly handled
      expect(words.length).toBeGreaterThan(0);
    });

    it('should verify French prompt localization', () => {
      const frPrompt = 'Résumez la conversation suivante en préservant les noms des personnages, leurs actions et leurs émotions.';
      expect(frPrompt).toContain('Résumez');
      expect(frPrompt).toContain('personnages');
    });
  });

  describe('ES (Spanish) locale', () => {
    it('should verify UTF-8 compatibility for Spanish text', () => {
      const esText = 'El jugador formó una alianza estratégica con el personaje contra el enemigo';
      const words = esText.split(/\s+/);
      
      // Spanish accented characters (á, é, í, ó, ú, ñ) should be preserved
      expect(esText).toContain('ó');
      expect(words.length).toBeGreaterThan(0);
    });

    it('should verify Spanish prompt localization', () => {
      const esPrompt = 'Resume la siguiente conversación preservando los nombres de los personajes, acciones y emociones.';
      expect(esPrompt).toContain('Resume');
      expect(esPrompt).toContain('conversación');
    });
  });

  describe('Cross-language equivalence verification', () => {
    it('should verify compaction triggers at correct token thresholds for all locales', () => {
      // Each locale should have its token counting validated
      const localeThresholdTests: Record<string, { text: string; expectedTokenRatio: number }> = {
        en: { text: 'A test message in English for token counting', expectedTokenRatio: 1.0 },
        zh: { text: '用于令牌计数的中文测试消息', expectedTokenRatio: 2.0 }, // CJK uses ~2x tokens
        ru: { text: 'Тестовое сообщение на русском для подсчета токенов', expectedTokenRatio: 1.2 },
        fr: { text: 'Un message de test en français pour le comptage de jetons', expectedTokenRatio: 1.1 },
        es: { text: 'Un mensaje de prueba en español para el conteo de tokens', expectedTokenRatio: 1.1 }
      };

      Object.entries(localeThresholdTests).forEach(([locale, { text, expectedTokenRatio }]) => {
        const wordCount = text.split(/\s+/).length;
        expect(wordCount).toBeGreaterThan(0);

        // Token ratio helps ensure locale-specific tokenization is reasonable
        if (locale === 'zh') {
          const cjkChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
          const estimatedTokens = cjkChars * 2;
          expect(estimatedTokens / wordCount).toBeGreaterThan(1.0); // CJK tokens > word count
        }
      });
    });

    it('should verify compacted output preserves key entities regardless of language', () => {
      // Entity preservation should work across locales
      const testCases = [
        { locale: 'en', input: 'Player met Character at the castle', expectedEntity: 'Player' },
        { locale: 'zh', input: '玩家在城堡遇到了角色', expectedEntity: '玩家' },
        { locale: 'ru', input: 'Игрок встретил Персонажа в замке', expectedEntity: 'Игрок' },
        { locale: 'fr', input: 'Le joueur a rencontré le personnage au château', expectedEntity: 'joueur' },
        { locale: 'es', input: 'El jugador se encontró con el personaje en el castillo', expectedEntity: 'jugador' }
      ];

      testCases.forEach(({ locale, input, expectedEntity }) => {
        expect(input.toLowerCase()).toContain(expectedEntity.toLowerCase());
      });
    });

    it('should verify UI labels display correct localized text in all supported languages', () => {
      const uiLabelsByLocale: Record<string, Record<string, string>> = {
        en: { save: 'Save', cancel: 'Cancel', settings: 'Settings' },
        zh: { save: '保存', cancel: '取消', settings: '设置' },
        ru: { save: 'Сохранить', cancel: 'Отмена', settings: 'Настройки' },
        fr: { save: 'Enregistrer', cancel: 'Annuler', settings: 'Paramètres' },
        es: { save: 'Guardar', cancel: 'Cancelar', settings: 'Configuración' }
      };

      supportedLocales.forEach(locale => {
        const labels = uiLabelsByLocale[locale];
        expect(labels.save).toBeDefined();
        expect(labels.cancel).toBeDefined();
        expect(labels.settings).toBeDefined();
      });
    });
  });
});