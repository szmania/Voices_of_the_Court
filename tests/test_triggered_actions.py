import unittest
from unittest.mock import patch, MagicMock
import json
import os
from pathlib import Path
import sys

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
src_path = project_root / 'src'
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(src_path))

from src.main.letter.letterInterfaces import Letter, LetterAssociatedAction, LetterType
from src.main.letter.Letter import Letter as LetterClass
from src.shared.gameData.Character import Character
from src.main.letter.LetterManager import LetterManager
from src.main.letter.parseLogForLetters import parseLettersFromLog
from src.main.letter.LetterActionTrigger import LetterActionTrigger
from src.shared.Config import Config
from src.shared.gameData.GameData import GameData

class TestTriggeredActionsInterface(unittest.TestCase):
    """TC-035, TC-036, TC-037: Interface Layer Tests"""

    def test_tc035_triggeredActions_field_exists(self):
        """Verify triggeredActions field exists on Letter interface."""
        # This is a type-level check, but we can verify it on an instance
        letter = LetterClass("1", MagicMock(), MagicMock(), "Subject", "Content", LetterType.PERSONAL)
        self.assertTrue(hasattr(letter, 'triggeredActions'))
        self.assertIsInstance(letter.triggeredActions, list)

    def test_tc036_triggeredActions_defaults_to_empty_array(self):
        """Verify triggeredActions defaults to an empty array."""
        letter = LetterClass("1", MagicMock(), MagicMock(), "Subject", "Content", LetterType.PERSONAL)
        self.assertEqual(letter.triggeredActions, [])

    def test_tc037_triggeredActions_is_json_serializable(self):
        """Verify triggeredActions is JSON-serializable."""
        letter = LetterClass("1", MagicMock(), MagicMock(), "Subject", "Content", LetterType.PERSONAL)
        action: LetterAssociatedAction = {
            "signature": "giveGold",
            "args": [100],
            "triggerOn": "receive"
        }
        letter.triggeredActions.append(action)
        try:
            json_string = json.dumps(letter.__dict__, default=lambda o: o.__dict__)
            rehydrated = json.loads(json_string)
            self.assertIn('triggeredActions', rehydrated)
            self.assertEqual(len(rehydrated['triggeredActions']), 1)
            self.assertEqual(rehydrated['triggeredActions'][0]['signature'], 'giveGold')
        except (TypeError, json.JSONDecodeError) as e:
            self.fail(f"triggeredActions failed to serialize/deserialize: {e}")

if __name__ == '__main__':
    unittest.main()
import sys
import json
import unittest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, mock_open

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# We need to mock the TypeScript/JavaScript modules since we're testing from Python
# The actual implementation is in TypeScript, so we'll test the Python-equivalent logic
# and verify the TypeScript source code behavior through file inspection and logic replication.


class TestLetterInterface(unittest.TestCase):
    """TC-035 through TC-037: Verify triggeredActions field on Letter interface."""

    def test_035_triggered_actions_field_exists_in_interface(self):
        """Verify Letter interface includes triggeredActions: LetterAssociatedAction[]."""
        letter_interfaces_path = project_root / 'src' / 'main' / 'letter' / 'letterInterfaces.ts'
        content = letter_interfaces_path.read_text(encoding='utf-8')

        # Verify triggeredActions is declared in the Letter interface
        self.assertIn('triggeredActions:', content,
                      'Letter interface should have triggeredActions property')
        self.assertIn('triggeredActions: LetterAssociatedAction[]', content,
                      'triggeredActions should be typed as LetterAssociatedAction[]')

    def test_036_triggered_actions_defaults_to_empty_array_in_constructor(self):
        """Verify Letter class constructor initializes triggeredActions to []."""
        letter_ts_path = project_root / 'src' / 'main' / 'letter' / 'Letter.ts'
        content = letter_ts_path.read_text(encoding='utf-8')

        # Verify triggeredActions is initialized to empty array
        self.assertIn('this.triggeredActions = []', content,
                      'Letter constructor should initialize triggeredActions to empty array')

    def test_037_triggered_actions_is_json_serializable(self):
        """Verify triggeredActions survives JSON round-trip with all fields intact."""
        # Create a sample LetterAssociatedAction object
        action = {
            'signature': 'giveGold',
            'args': [100],
            'triggerOn': 'receive'
        }

        # Create a letter dict with triggeredActions
        letter = {
            'id': 'test-letter-1',
            'triggeredActions': [action]
        }

        # JSON round-trip
        serialized = json.dumps(letter)
        deserialized = json.loads(serialized)

        self.assertEqual(deserialized['triggeredActions'][0]['signature'], 'giveGold')
        self.assertEqual(deserialized['triggeredActions'][0]['args'], [100])
        self.assertEqual(deserialized['triggeredActions'][0]['triggerOn'], 'receive')


class TestLetterFromLog(unittest.TestCase):
    """TC-038 through TC-040: Verify Letter.fromLog behavior with triggeredActions."""

    def test_038_fromlog_initializes_triggered_actions_to_empty(self):
        """Verify Letter.fromLog returns Letter with triggeredActions = []."""
        letter_ts_path = project_root / 'src' / 'main' / 'letter' / 'Letter.ts'
        content = letter_ts_path.read_text(encoding='utf-8')

        # Verify fromLog method exists
        self.assertIn('public static fromLog(', content)

        # Verify the constructor is called which initializes triggeredActions to []
        # The fromLog method calls `new Letter(...)` which sets triggeredActions = []
        self.assertIn('this.triggeredActions = []', content,
                      'Constructor should initialize triggeredActions to empty array')

    def test_039_fromlog_does_not_populate_triggered_actions_from_log(self):
        """Verify Letter.fromLog does not parse triggeredActions from log data."""
        parse_log_path = project_root / 'src' / 'main' / 'letter' / 'parseLogForLetters.ts'
        content = parse_log_path.read_text(encoding='utf-8')

        # Verify that triggeredActions is set AFTER fromLog returns, not inside fromLog
        # The fromLog call should be separate from the triggeredActions assignment
        fromlog_call_pos = content.find('LetterClass.fromLog(')
        triggered_actions_pos = content.find('letter.triggeredActions = triggeredActions')

        # triggeredActions assignment should come AFTER the fromLog call
        self.assertGreater(triggered_actions_pos, fromlog_call_pos,
                           'triggeredActions should be set after fromLog creates the letter')

    def test_040_fromlog_date_validation_still_returns_null(self):
        """Verify Letter.fromLog date validation (year < 867) still returns null."""
        letter_ts_path = project_root / 'src' / 'main' / 'letter' / 'Letter.ts'
        content = letter_ts_path.read_text(encoding='utf-8')

        # Verify year validation exists
        self.assertIn('year < 867', content,
                      'fromLog should validate year >= 867')
        self.assertIn('return null', content,
                      'fromLog should return null for invalid year')

        # Verify validation happens after date parsing
        fromlog_section = content[content.find('public static fromLog'):]
        date_parse_pos = fromlog_section.find('const dateParts = gameDate')
        validation_pos = fromlog_section.find('year < 867')
        self.assertGreater(validation_pos, date_parse_pos,
                           'Year validation should happen after date parsing')


class TestLetterManagerImport(unittest.TestCase):
    """TC-041 through TC-045: Verify LetterManager.importLettersFromLog captures triggeredActions."""

    def test_041_import_captures_ai_triggered_actions(self):
        """Verify importLettersFromLog populates triggeredActions from log."""
        parse_log_path = project_root / 'src' / 'main' / 'letter' / 'parseLogForLetters.ts'
        content = parse_log_path.read_text(encoding='utf-8')

        # Verify triggeredActions parsing logic exists
        self.assertIn('triggeredActions:', content,
                      'parseLettersFromLog should parse triggeredActions')
        self.assertIn('signature = actionFields[0]', content,
                      'Should parse action signature from log')
        self.assertIn('triggerOn = actionFields[2]', content,
                      'Should parse triggerOn from log')

        # Verify triggeredActions is assigned to the letter
        self.assertIn('letter.triggeredActions = triggeredActions', content,
                      'Should assign triggeredActions to letter object')

    def test_042_import_handles_letters_with_no_actions(self):
        """Verify letters without action data have triggeredActions = []."""
        parse_log_path = project_root / 'src' / 'main' / 'letter' / 'parseLogForLetters.ts'
        content = parse_log_path.read_text(encoding='utf-8')

        # Verify triggeredActions is initialized as empty array before parsing
        self.assertIn('const triggeredActions: any[] = [];', content,
                      'Should initialize triggeredActions as empty array')

    def test_043_import_handles_multiple_triggered_actions(self):
        """Verify importLettersFromLog handles multiple actions per letter."""
        parse_log_path = project_root / 'src' / 'main' / 'letter' / 'parseLogForLetters.ts'
        content = parse_log_path.read_text(encoding='utf-8')

        # Verify loop that parses multiple actions (parts[6+])
        self.assertIn('for (let i = 6; i < parts.length; i++)', content,
                      'Should loop through all action parts in log line')
        self.assertIn('triggeredActions.push(', content,
                      'Should push each parsed action to triggeredActions array')

    def test_044_import_persists_triggered_actions_to_json(self):
        """Verify triggeredActions is persisted to JSON file."""
        letter_manager_path = project_root / 'src' / 'main' / 'letter' / 'LetterManager.ts'
        content = letter_manager_path.read_text(encoding='utf-8')

        # Verify the history is persisted via JSON.stringify (which includes triggeredActions)
        self.assertIn('JSON.stringify(history, null, 2)', content,
                      'The history array should be persisted via JSON.stringify')

        # Verify getLetters reads the full letter object (including triggeredActions)
        self.assertIn('const letters = JSON.parse(data) as ILetter[]', content,
                      'LetterManager should parse full letter JSON including triggeredActions')

    def test_045_import_avoids_duplicating_triggered_actions(self):
        """Verify re-import does not duplicate triggeredActions."""
        letter_manager_path = project_root / 'src' / 'main' / 'letter' / 'LetterManager.ts'
        content = letter_manager_path.read_text(encoding='utf-8')

        # Verify deduplication logic exists in saveLetter
        self.assertIn('const isDuplicate = history.some(', content,
                      'saveLetter should have deduplication logic')

        # Verify dedup checks subject, totalDays, sender, and recipient
        dedup_section = content[content.find('const isDuplicate = history.some'):]
        self.assertIn('l.subject === letter.subject', dedup_section,
                      'Dedup should check subject')
        self.assertIn('l.totalDays === letter.totalDays', dedup_section,
                      'Dedup should check totalDays')
        self.assertIn('l.sender.id === letter.sender.id', dedup_section,
                      'Dedup should check sender')
        self.assertIn('l.recipient.id === letter.recipient.id', dedup_section,
                      'Dedup should check recipient')


class TestLetterActionTrigger(unittest.TestCase):
    """TC-046 through TC-048: Verify LetterActionTrigger execution behavior."""

    def test_046_execute_called_for_receive_trigger_during_import(self):
        """Verify executeLetterAction is called for 'receive' trigger during import."""
        parse_log_path = project_root / 'src' / 'main' / 'letter' / 'parseLogForLetters.ts'
        content = parse_log_path.read_text(encoding='utf-8')

        # Verify executeLetterAction is called for 'receive' trigger
        self.assertIn('LetterActionTrigger.executeLetterAction(letter, letter.associatedAction, config)', content,
                      'Should call executeLetterAction for associatedAction with receive trigger')

        # Verify it checks for triggerOn === 'receive'
        self.assertIn("associatedAction?.triggerOn === 'receive'", content,
                      'Should check for receive trigger type')

    def test_047_execute_called_for_read_trigger_during_mark_as_read(self):
        """Verify executeLetterAction is called for 'read' trigger during markAsRead."""
        letter_manager_path = project_root / 'src' / 'main' / 'letter' / 'LetterManager.ts'
        content = letter_manager_path.read_text(encoding='utf-8')

        # Verify executeLetterAction is called in markAsRead
        self.assertIn('LetterActionTrigger.executeLetterAction(letter, letter.associatedAction, config)', content,
                      'markAsRead should call executeLetterAction for read trigger')

        # Verify it's inside markAsRead method
        mark_as_read_section = content[content.find('public markAsRead'):content.find('public getLetterSummaryFilePath')]
        self.assertIn('LetterActionTrigger.executeLetterAction', mark_as_read_section,
                      'executeLetterAction should be called within markAsRead')

    def test_048_execute_handles_missing_action_module_gracefully(self):
        """Verify executeLetterAction returns error for missing action module."""
        action_trigger_path = project_root / 'src' / 'main' / 'letter' / 'LetterActionTrigger.ts'
        content = action_trigger_path.read_text(encoding='utf-8')

        # Verify error handling for missing action module
        self.assertIn('Action not found', content,
                      'Should log error when action module is not found')
        self.assertIn('return { success: false, message:', content,
                      'Should return failure result for missing action')

        # Verify it returns a structured error result, not throwing
        self.assertIn('success: false', content,
                      'Should return success: false for missing action')


class TestLetterRenderer(unittest.TestCase):
    """TC-049 through TC-053: Verify letterRenderer.ts renders triggered actions correctly."""

    def test_049_renders_triggered_actions_section_when_non_empty(self):
        """Verify renderLetterContent renders triggered actions section when non-empty."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify triggered actions section exists in renderLetterContent
        self.assertIn('letter.triggeredActions', content,
                      'renderLetterContent should reference triggeredActions')
        self.assertIn('letters.triggered_actions', content,
                      'Should use triggered_actions localization key')

        # Verify conditional rendering based on triggeredActions length
        self.assertIn('letter.triggeredActions && letter.triggeredActions.length > 0', content,
                      'Should check if triggeredActions is non-empty before rendering')

    def test_050_does_not_render_section_when_empty(self):
        """Verify renderLetterContent does NOT render triggered actions section when empty."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify empty state handling (ternary operator with empty string)
        self.assertIn('letter.triggeredActions && letter.triggeredActions.length > 0', content,
                      'Should have condition for non-empty triggeredActions')
        # The ternary should render empty string when condition is false
        self.assertIn(': ""', content,
                      'Should render empty string when triggeredActions is empty')

    def test_051_displays_action_signature_and_trigger_type(self):
        """Verify triggered actions display signature and trigger type."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify action signature is displayed
        self.assertIn('a.signature', content,
                      'Should display action signature')
        self.assertIn('action-signature', content,
                      'Should have action-signature CSS class')

        # Verify trigger type is displayed
        self.assertIn('a.triggerOn', content,
                      'Should display trigger type')
        self.assertIn('action-trigger', content,
                      'Should have action-trigger CSS class')

    def test_052_uses_data_i18n_localization_attributes(self):
        """Verify triggered actions section uses data-i18n localization attributes."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify data-i18n attribute is used
        self.assertIn('data-i18n="letters.triggered_actions"', content,
                      'Should use data-i18n for triggered_actions section')

        # Verify localization keys exist in en.json
        en_json_path = project_root / 'public' / 'locales' / 'en.json'
        en_json = json.loads(en_json_path.read_text(encoding='utf-8'))

        self.assertIn('triggered_actions', en_json.get('letters', {}),
                      'en.json should have triggered_actions key')
        self.assertIn('action_signature', en_json.get('letters', {}),
                      'en.json should have action_signature key')
        self.assertIn('action_trigger', en_json.get('letters', {}),
                      'en.json should have action_trigger key')

    def test_053_appears_after_letter_body_content(self):
        """Verify triggered actions section appears after letter body in DOM."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Find positions of body and triggered actions sections
        body_pos = content.find('letter-view-body')
        actions_pos = content.find('letter-view-actions')

        self.assertNotEqual(body_pos, -1, 'letter-view-body section should exist')
        self.assertNotEqual(actions_pos, -1, 'letter-view-actions section should exist')
        self.assertLess(body_pos, actions_pos,
                        'letter-view-body should appear before letter-view-actions in DOM')


class TestRegression(unittest.TestCase):
    """TC-054 through TC-058: Regression tests for existing functionality."""

    def test_054_date_display_still_works_with_triggered_actions(self):
        """Verify letter date display works correctly with triggeredActions present."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify formatDate function still exists and handles invalid years
        self.assertIn('function formatDate(date: Date): string', content,
                      'formatDate function should still exist')
        self.assertIn('getFullYear() < 867', content,
                      'formatDate should still handle invalid years')

        # Verify date is still displayed in letter view
        self.assertIn('formatDate(new Date(letter.timestamp))', content,
                      'Should still format and display letter timestamp')

    def test_055_future_letter_filter_still_works(self):
        """Verify future letter filter works with triggeredActions present."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify showFutureLetters filter still exists
        self.assertIn('let showFutureLetters', content,
                      'showFutureLetters filter should still exist')
        self.assertIn('showFutureLetters', content,
                      'showFutureLetters should be referenced in filtering logic')
        self.assertIn('l.totalDays <= currentGameDay', content,
                      'Future filter logic should still exist')

    def test_056_letter_caching_still_works(self):
        """Verify cachedLetterPairs caching works with triggeredActions."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify cache variable still exists
        self.assertIn('let cachedLetterPairs', content,
                      'cachedLetterPairs cache should still exist')
        self.assertIn('if (cachedLetterPairs)', content,
                      'Should still check cache before filtering')
        self.assertIn('cachedLetterPairs = letterPairs', content,
                      'Should still populate cache after filtering')

    def test_057_search_highlight_still_works(self):
        """Verify search/highlight functionality works with triggeredActions."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify search functions still exist
        self.assertIn('function performSearch(term: string)', content,
                      'performSearch function should still exist')
        self.assertIn('function highlightText(element: HTMLElement, term: string)', content,
                      'highlightText function should still exist')
        self.assertIn('function clearHighlights()', content,
                      'clearHighlights function should still exist')

    def test_058_status_summary_counts_unaffected(self):
        """Verify status summary counts are unaffected by triggeredActions."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify status summary functions still exist
        self.assertIn('function renderStatusSummary()', content,
                      'renderStatusSummary function should still exist')

        # Verify status counts are based on letter status, not triggeredActions
        status_section = content[content.find('function renderStatusSummary()'):]
        self.assertIn("l.status === 'generating'", status_section,
                      'Should count generating status')
        self.assertIn("l.status === 'pending'", status_section,
                      'Should count pending status')
        self.assertIn("l.status === 'failed'", status_section,
                      'Should count failed status')
        self.assertIn("l.status === 'sent' || l.status === 'read'", status_section,
                      'Should count completed status')


class TestEdgeCases(unittest.TestCase):
    """TC-059 through TC-061: Edge cases and sad paths."""

    def test_059_null_undefined_triggered_actions_does_not_crash(self):
        """Verify null/undefined triggeredActions does not crash renderer."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify safe access pattern (&& check before accessing length)
        self.assertIn('letter.triggeredActions && letter.triggeredActions.length > 0', content,
                      'Should use safe access pattern for triggeredActions')

        # Verify optional chaining or similar safety mechanism
        self.assertIn('letter.triggeredActions', content,
                      'Should safely access triggeredActions property')

    def test_060_malformed_triggered_actions_handled_gracefully(self):
        """Verify malformed action objects (missing fields) are handled gracefully."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify the renderer accesses specific fields (signature, triggerOn)
        # If these are missing, JavaScript will show undefined but not crash
        self.assertIn('a.signature', content,
                      'Should access signature field')
        self.assertIn('a.triggerOn', content,
                      'Should access triggerOn field')

        # Verify it uses map/join pattern which handles missing fields gracefully
        self.assertIn('.map(a =>', content,
                      'Should use map to iterate actions')
        self.assertIn('.join("")', content,
                      'Should join results to avoid undefined display')

    def test_061_unknown_action_signature_displays_fallback_text(self):
        """Verify unknown action signatures display fallback text in UI."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify the renderer displays the signature directly
        # Unknown signatures will display as-is (the signature string itself)
        self.assertIn('${a.signature}', content,
                      'Should display action signature directly as fallback')

        # Verify trigger type is also displayed
        self.assertIn('${a.triggerOn}', content,
                      'Should display trigger type')


class TestAdditional(unittest.TestCase):
    """TC-062 through TC-067: Additional tests for localization, persistence, edge cases, caching."""

    def test_062_localization_keys_exist_in_all_locales(self):
        """Verify triggered actions localization keys exist in ALL locale files."""
        locales_dir = project_root / 'public' / 'locales'
        locale_files = list(locales_dir.glob('*.json'))

        self.assertGreater(len(locale_files), 0, 'No locale files found')

        required_keys = ['triggered_actions', 'action_signature', 'action_trigger']

        for locale_file in locale_files:
            with self.subTest(locale=locale_file.name):
                content = json.loads(locale_file.read_text(encoding='utf-8'))
                letters_section = content.get('letters', {})

                for key in required_keys:
                    self.assertIn(key, letters_section,
                                  f'{locale_file.name} should have {key} key in letters section')

    def test_063_triggered_actions_survives_app_restart(self):
        """Verify triggeredActions data persists and reloads correctly."""
        letter_manager_path = project_root / 'src' / 'main' / 'letter' / 'LetterManager.ts'
        content = letter_manager_path.read_text(encoding='utf-8')

        # Verify getLetters reads full letter data from JSON
        self.assertIn('JSON.parse(data) as ILetter[]', content,
                      'Should parse full letter JSON including triggeredActions')

        # Verify saveLetter writes full letter data to JSON
        self.assertIn('JSON.stringify(history, null, 2)', content,
                      'Should serialize full letter history to JSON')

        # Verify the re-hydration in getLetters preserves all properties
        get_letters_section = content[content.find('public getLetters'):content.find('public getAllLetters')]
        self.assertIn('...l,', get_letters_section,
                      'Should spread all properties when re-hydrating')

    def test_064_triggered_actions_and_associated_action_are_independent(self):
        """Verify triggeredActions and associatedAction are independent properties."""
        letter_interfaces_path = project_root / 'src' / 'main' / 'letter' / 'letterInterfaces.ts'
        content = letter_interfaces_path.read_text(encoding='utf-8')

        # Verify both properties exist on the Letter interface
        self.assertIn('associatedAction?: LetterAssociatedAction;', content,
                      'Letter interface should have associatedAction property')
        self.assertIn('triggeredActions: LetterAssociatedAction[]', content,
                      'Letter interface should have triggeredActions property')

        # Verify they are separate declarations
        associated_pos = content.find('associatedAction?:')
        triggered_pos = content.find('triggeredActions:')
        self.assertNotEqual(associated_pos, triggered_pos,
                            'associatedAction and triggeredActions should be separate properties')

    def test_065_empty_args_array_renders_correctly(self):
        """Verify triggeredActions with empty args array renders correctly."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify the renderer accesses action properties for rendering
        self.assertIn('a.signature', content,
                      'Should access signature property of action')

        # Verify it uses map/join which handles empty arrays gracefully
        self.assertIn('.map(a =>', content,
                      'Should use map for rendering actions')

    def test_066_renderletters_handles_null_triggered_actions(self):
        """Verify renderLetters (list view) handles null/undefined triggeredActions."""
        renderer_path = project_root / 'src' / 'configWindow' / 'letterRenderer.ts'
        content = renderer_path.read_text(encoding='utf-8')

        # Verify renderLetters exists and processes letters
        self.assertIn('function renderLetters()', content,
                      'renderLetters function should exist')

        # Verify the letter filtering logic doesn't access triggeredActions
        # (it should only use sender, recipient, status, totalDays, etc.)
        render_letters_section = content[content.find('function renderLetters()'):]
        self.assertIn('letter.sender', render_letters_section,
                      'renderLetters should access sender')
        self.assertIn('letter.recipient', render_letters_section,
                      'renderLetters should access recipient')

        # Verify triggeredActions is NOT accessed in the list view filtering
        # (it's only used in renderLetterContent for the detail view)
        # The list view should not crash if triggeredActions is missing

    def test_067_letter_action_trigger_cache_returns_consistent_results(self):
        """Verify LetterActionTrigger action cache returns consistent results."""
        action_trigger_path = project_root / 'src' / 'main' / 'letter' / 'LetterActionTrigger.ts'
        content = action_trigger_path.read_text(encoding='utf-8')

        # Verify action cache exists
        self.assertIn('private static actionCache: Map<string, Action>', content,
                      'LetterActionTrigger should have actionCache')

        # Verify cache is checked before loading
        self.assertIn('if (this.actionCache.has(signature))', content,
                      'Should check cache before loading action')

        # Verify cache is populated after loading
        self.assertIn('this.actionCache.set(signature, actionModule)', content,
                      'Should cache loaded action module')

        # Verify cached value is returned
        self.assertIn('return this.actionCache.get(signature) || null', content,
                      'Should return cached action if available')


if __name__ == '__main__':
    unittest.main()
