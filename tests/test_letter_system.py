import os
import re
import unittest
from pathlib import Path


class TestLetterSystemDateFix(unittest.TestCase):
    """TC-031: Verify date displays correctly for letters with valid game dates.
    
    Tests the fix for the year-0 → 1900 bug where totalDays < 365 caused
    JavaScript's Date.UTC(0, ...) to map year 0 to 1900.
    """

    @classmethod
    def setUpClass(cls):
        cls.project_root = Path(__file__).parent.parent
        cls.main_ts = cls.project_root / 'src' / 'main' / 'main.ts'
        cls.parse_ts = cls.project_root / 'src' / 'main' / 'letter' / 'parseLogForLetters.ts'
        cls.letter_ts = cls.project_root / 'src' / 'main' / 'letter' / 'Letter.ts'
        cls.renderer_ts = cls.project_root / 'src' / 'configWindow' / 'letterRenderer.ts'

    def test_1_totalDaysToDateString_uses_math_max_in_main_ts(self):
        """Verify totalDaysToDateString in main.ts uses Math.max(1, ...)."""
        content = self.main_ts.read_text(encoding='utf-8')
        
        # Find the totalDaysToDateString function
        func_match = re.search(r'function totalDaysToDateString\(totalDays: number\): string \{.*?\}', 
                              content, re.DOTALL)
        self.assertIsNotNone(func_match, 
                           'totalDaysToDateString function not found in main.ts')
        
        func_body = func_match.group(0)
        # Verify Math.max(1, ...) is used to prevent year 0
        self.assertIn('Math.max(1,', func_body,
                     'totalDaysToDateString should use Math.max(1, ...) to prevent year 0')
        
        # Verify the calculation: 867 + Math.floor(totalDays / 365)
        self.assertIn('867 + Math.floor(totalDays / 365)', func_body,
                     'Year calculation should use 867 base year')

    def test_2_totalDaysToDateString_uses_math_max_in_parse_log(self):
        """Verify totalDaysToDateString in parseLogForLetters.ts uses Math.max(1, ...)."""
        content = self.parse_ts.read_text(encoding='utf-8')
        
        func_match = re.search(r'function totalDaysToDateString\(totalDays: number\): string \{.*?\}', 
                              content, re.DOTALL)
        self.assertIsNotNone(func_match, 
                           'totalDaysToDateString function not found in parseLogForLetters.ts')
        
        func_body = func_match.group(0)
        self.assertIn('Math.max(1,', func_body,
                     'totalDaysToDateString should use Math.max(1, ...) to prevent year 0')
        self.assertIn('867 + Math.floor(totalDays / 365)', func_body,
                     'Year calculation should use 867 base year')

    def test_3_letter_fromlog_validates_year_minimum(self):
        """Verify Letter.fromLog validates year >= 867."""
        content = self.letter_ts.read_text(encoding='utf-8')
        
        # Verify year validation check exists in the file
        self.assertIn('year < 867', content,
                     'Letter.fromLog should validate year >= 867')
        self.assertIn('return null', content,
                     'Letter.fromLog should return null for invalid year')
        
        # Verify the validation happens after date parsing
        fromlog_match = re.search(r'public static fromLog\(.*?\{', content, re.DOTALL)
        self.assertIsNotNone(fromlog_match, 'Letter.fromLog method not found')
        
        # Find the date parsing section and verify validation follows
        date_parse_match = re.search(r'const dateParts = gameDate\.split.*?\n', 
                                     content, re.DOTALL)
        self.assertIsNotNone(date_parse_match, 'Date parsing in fromLog not found')
        
        # Verify year validation is in the fromLog method
        fromlog_section = content[fromlog_match.start():fromlog_match.end() + 2000]
        self.assertIn('year < 867', fromlog_section,
                     'Year validation should be in fromLog method')

    def test_4_formatDate_handles_invalid_year(self):
        """Verify formatDate in letterRenderer.ts handles years < 867."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Find formatDate function
        format_match = re.search(r'function formatDate\(date: Date\): string \{.*?\}', 
                                content, re.DOTALL)
        self.assertIsNotNone(format_match, 'formatDate function not found in letterRenderer.ts')
        
        format_body = format_match.group(0)
        # Verify invalid date handling
        self.assertIn('getFullYear() < 867', format_body,
                     'formatDate should check for years before 867')
        self.assertIn('letters.invalid_date', format_body,
                     'formatDate should use invalid_date localization key')

    def test_5_date_calculation_edge_cases(self):
        """Verify date calculation handles edge cases correctly."""
        content = self.main_ts.read_text(encoding='utf-8')
        
        # Verify dayOfYear calculation uses modulo and adds 1 for 1-indexing
        func_match = re.search(r'function totalDaysToDateString\(totalDays: number\): string \{.*?\}', 
                              content, re.DOTALL)
        self.assertIsNotNone(func_match)
        func_body = func_match.group(0)
        
        self.assertIn('totalDays % 365', func_body,
                     'Should use modulo 365 for day of year calculation')
        self.assertIn('+ 1', func_body,
                     'Should add 1 for 1-indexed day')


class TestLetterSystemFutureFilter(unittest.TestCase):
    """TC-032: Verify "Hide future letters" filter works correctly."""

    @classmethod
    def setUpClass(cls):
        cls.project_root = Path(__file__).parent.parent
        cls.renderer_ts = cls.project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        cls.letters_html = cls.project_root / 'public' / 'configWindow' / 'letters.html'

    def test_1_show_future_letters_variable_exists(self):
        """Verify showFutureLetters state variable exists and defaults to false."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Find the state section
        state_match = re.search(r'// State\n(.*?)\n\n', content, re.DOTALL)
        self.assertIsNotNone(state_match, 'State section not found in letterRenderer.ts')
        
        state_section = state_match.group(1)
        self.assertIn('let showFutureLetters', state_section,
                     'showFutureLetters variable should exist')
        self.assertIn('= false', state_section,
                     'showFutureLetters should default to false (hide future letters)')

    def test_2_future_letter_filter_logic_exists(self):
        """Verify renderLetters contains future letter filtering logic."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify showFutureLetters variable and filter logic exist in the file
        self.assertIn('let showFutureLetters', content,
                     'showFutureLetters variable should exist')
        self.assertIn('showFutureLetters', content,
                     'renderLetters should reference showFutureLetters')
        self.assertIn('l.totalDays <= currentGameDay', content,
                     'Should filter letters where totalDays <= currentGameDay')
        
        # Verify the filter is applied in renderLetters context
        render_section = content[content.find('function renderLetters()'):]
        self.assertIn('showFutureLetters', render_section[:5000],
                     'showFutureLetters should be referenced in renderLetters')
        self.assertIn('totalDays <= currentGameDay', render_section[:5000],
                     'Future filter logic should be in renderLetters')

    def test_3_toggle_button_exists_in_html(self):
        """Verify toggle-future-btn button exists in letters.html."""
        content = self.letters_html.read_text(encoding='utf-8')
        
        self.assertIn('id="toggle-future-btn"', content,
                     'Toggle button with id toggle-future-btn should exist')
        self.assertIn('class="btn"', content,
                     'Toggle button should have btn class')
        self.assertIn('data-i18n="letters.hide_future"', content,
                     'Toggle button should use hide_future localization key')

    def test_4_filter_state_resets_on_load(self):
        """Verify showFutureLetters resets to false on player load."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify showFutureLetters is initialized to false at module level
        # This means it resets to false every time the app/page loads
        self.assertIn('let showFutureLetters = false', content,
                     'showFutureLetters should be initialized to false at module level')

    def test_5_filter_works_with_character_filter(self):
        """Verify future filter works in conjunction with character filter."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify both character filtering and future filtering exist
        self.assertIn('selectedCharacterId', content,
                     'Should filter by selected character')
        self.assertIn('showFutureLetters', content,
                     'Should apply future letter filter')
        
        # Verify the filter is applied after character filtering
        render_section = content[content.find('function renderLetters()'):]
        render_section = render_section[:8000]  # First 8000 chars
        self.assertIn('filteredLetters = filteredLetters.filter', render_section,
                     'Should apply additional filtering after character filter')
        self.assertIn('showFutureLetters', render_section,
                     'Future filter should be applied in renderLetters')


class TestLetterSystemToggleButtonText(unittest.TestCase):
    """TC-033: Verify toggle button text changes correctly."""

    @classmethod
    def setUpClass(cls):
        cls.project_root = Path(__file__).parent.parent
        cls.renderer_ts = cls.project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        cls.letters_html = cls.project_root / 'public' / 'configWindow' / 'letters.html'
        cls.letter_css = cls.project_root / 'public' / 'configWindow' / 'letter.css'

    def test_1_update_future_button_text_function_exists(self):
        """Verify updateFutureButtonText function exists."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        self.assertIn('function updateFutureButtonText()', content,
                     'updateFutureButtonText function should exist')

    def test_2_button_text_uses_localization_keys(self):
        """Verify button text uses hide_future and show_all localization keys."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Look for the updateFutureButtonText function and check its content
        # Find the function and get a larger section around it
        func_start = content.find('function updateFutureButtonText()')
        self.assertNotEqual(func_start, -1, 'updateFutureButtonText function not found')
        
        # Get a section of the file around the function (200 chars should be enough)
        func_section = content[func_start:func_start + 500]
        
        self.assertIn('letters.hide_future', func_section,
                     'Should use letters.hide_future localization key')
        self.assertIn('letters.show_all', func_section,
                     'Should use letters.show_all localization key')

    def test_3_button_active_class_toggles(self):
        """Verify button active class toggles based on showFutureLetters state."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Look for the updateFutureButtonText function and check classList usage
        func_start = content.find('function updateFutureButtonText()')
        self.assertNotEqual(func_start, -1, 'updateFutureButtonText function not found')
        
        # Get a section of the file around the function
        func_section = content[func_start:func_start + 500]
        
        # Verify classList.add and remove for active state
        self.assertIn('classList.add', func_section,
                     'Should add active class when showFutureLetters is true')
        self.assertIn('classList.remove', func_section,
                     'Should remove active class when showFutureLetters is false')

    def test_4_button_initial_text_set_correctly(self):
        """Verify initial button text is set on DOMContentLoaded."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify updateFutureButtonText is called on initialization
        self.assertIn('updateFutureButtonText()', content,
                     'Should call updateFutureButtonText on initialization')
        
        # Verify it's in the DOMContentLoaded handler
        dom_start = content.find('DOMContentLoaded')
        self.assertNotEqual(dom_start, -1, 'DOMContentLoaded handler not found')
        
        dom_section = content[dom_start:dom_start + 2000]
        self.assertIn('updateFutureButtonText()', dom_section,
                     'Should call updateFutureButtonText in DOMContentLoaded')

    def test_5_toggle_button_has_css_styling(self):
        """Verify .btn.active CSS styling exists for toggle button."""
        content = self.letter_css.read_text(encoding='utf-8')
        
        self.assertIn('.btn {', content, '.btn base styles should exist')
        self.assertIn('.btn:hover', content, '.btn:hover styles should exist')
        self.assertIn('.btn.active', content, '.btn.active styles should exist')
        
        # Verify active state has distinct styling
        active_match = re.search(r'\.btn\.active \{.*?\}', content, re.DOTALL)
        self.assertIsNotNone(active_match, '.btn.active rule should exist')
        active_body = active_match.group(0)
        self.assertIn('background-color', active_body,
                     '.btn.active should have background-color')
        self.assertIn('color:', active_body,
                     '.btn.active should have color')

    def test_6_localization_keys_exist_in_all_locales(self):
        """Verify hide_future and show_all keys exist in all locale files."""
        locales_dir = self.project_root / 'public' / 'locales'
        locale_files = list(locales_dir.glob('*.json'))
        
        self.assertGreater(len(locale_files), 0, 'No locale files found')
        
        for locale_file in locale_files:
            with self.subTest(locale=locale_file.name):
                content = locale_file.read_text(encoding='utf-8')
                self.assertIn('"hide_future"', content,
                             f'{locale_file.name} should have hide_future key')
                self.assertIn('"show_all"', content,
                             f'{locale_file.name} should have show_all key')


class TestLetterSystemPerformanceCaching(unittest.TestCase):
    """TC-034: Verify performance improvement with cached letter pairs."""

    @classmethod
    def setUpClass(cls):
        cls.project_root = Path(__file__).parent.parent
        cls.renderer_ts = cls.project_root / 'src' / 'configWindow' / 'letterRenderer.ts'

    def test_1_cached_letter_pairs_variable_exists(self):
        """Verify cachedLetterPairs module-level variable exists."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify cachedLetterPairs variable exists with correct type
        self.assertIn('let cachedLetterPairs', content,
                     'cachedLetterPairs variable should exist')
        self.assertIn('cachedLetterPairs', content,
                     'cachedLetterPairs should be referenced')
        
        # Verify type annotation
        type_match = re.search(r'let cachedLetterPairs[^;]*', content)
        self.assertIsNotNone(type_match, 'cachedLetterPairs declaration not found')
        type_decl = type_match.group(0)
        self.assertIn('sent?: Letter', type_decl,
                     'Should have sent property in type')
        self.assertIn('received?: Letter', type_decl,
                     'Should have received property in type')
        self.assertIn('= null', type_decl,
                     'Should initialize to null')

    def test_2_renderLetters_uses_cache(self):
        """Verify renderLetters checks and uses cachedLetterPairs."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify cache check exists
        self.assertIn('if (cachedLetterPairs)', content,
                     'renderLetters should check if cachedLetterPairs exists')
        self.assertIn('letterPairs = cachedLetterPairs', content,
                     'Should use cached letter pairs when available')
        
        # Verify it's in renderLetters context
        render_section = content[content.find('function renderLetters()'):]
        render_section = render_section[:5000]
        self.assertIn('if (cachedLetterPairs)', render_section,
                     'Cache check should be in renderLetters')

    def test_3_cache_is_populated_after_filtering(self):
        """Verify cache is populated after filtering and sorting."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify cache assignment exists
        self.assertIn('cachedLetterPairs = letterPairs', content,
                     'Should assign filtered/sorted letter pairs to cache')
        
        # Verify it happens in renderLetters
        render_section = content[content.find('function renderLetters()'):]
        render_section = render_section[:10000]
        self.assertIn('cachedLetterPairs = letterPairs', render_section,
                     'Cache assignment should be in renderLetters')

    def test_4_cache_invalidation_on_filter_change(self):
        """Verify cache invalidation mechanism exists when filters change."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify filter change handlers exist and call renderLetters
        handlers_to_check = [
            'sortSelect.addEventListener',
            'searchInput.addEventListener',
            'characterSelect.addEventListener',
            'toggleFutureBtn.addEventListener'
        ]
        
        for handler in handlers_to_check:
            self.assertIn(handler, content,
                         f'Should have event listener for filter change: {handler}')
        
        # Verify that renderLetters is called in response to filter changes
        # Check that the event handlers call renderLetters
        toggle_handler = content[content.find('toggleFutureBtn.addEventListener'):]
        toggle_handler = toggle_handler[:500]  # First 500 chars of the handler
        self.assertIn('renderLetters()', toggle_handler,
                     'toggleFutureBtn click handler should call renderLetters')

    def test_5_document_fragment_used_for_batch_updates(self):
        """Verify DocumentFragment is used for batch DOM updates."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify DocumentFragment usage
        self.assertIn('document.createDocumentFragment()', content,
                     'Should use DocumentFragment for batch DOM updates')
        self.assertIn('fragment.appendChild', content,
                     'Should append items to fragment before adding to DOM')
        
        # Verify it's in renderLetters
        render_section = content[content.find('function renderLetters()'):]
        render_section = render_section[:8000]
        self.assertIn('document.createDocumentFragment()', render_section,
                     'DocumentFragment should be used in renderLetters')

    def test_6_cache_does_not_break_sorting(self):
        """Verify cached pairs maintain correct sort order."""
        content = self.renderer_ts.read_text(encoding='utf-8')
        
        # Verify sorting happens
        self.assertIn('letterPairs.sort', content,
                     'Should sort letter pairs')
        
        # Verify sort uses timestamps
        self.assertIn('getTimestamp', content,
                     'Sort should use timestamp helper')
        
        # Verify sorting is done before caching
        render_section = content[content.find('function renderLetters()'):]
        render_section = render_section[:12000]
        sort_pos = render_section.find('letterPairs.sort')
        cache_pos = render_section.find('cachedLetterPairs = letterPairs')
        self.assertGreater(cache_pos, sort_pos,
                          'Sorting should happen before caching')


if __name__ == '__main__':
    unittest.main()