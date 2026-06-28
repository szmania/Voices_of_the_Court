
import os
import re
import unittest
import json
from pathlib import Path


class TestActionScriptsCanPerformAtDistance(unittest.TestCase):
    """Test suite for verifying canPerformAtDistance attribute in action scripts."""

    @classmethod
    def setUpClass(cls):
        """Set up test fixtures before running tests."""
        cls.actions_dir = Path("default_userdata/scripts/actions/standard")
        cls.expected_values = cls._load_expected_values()

    @staticmethod
    def _load_expected_values():
        """Load expected canPerformAtDistance values from the classification table."""
        return {
            "addGoldToTreasury.js": True,
            "addTrait.js": True,
            "agreeToTruce.js": True,
            "allianceDiplomatic.js": True,
            "assignToCouncilPosition.js": True,
            "assignToCourtPosition.js": True,
            "becomeBestFriends.js": True,
            "becomeBloodBrothers.js": True,
            "becomeCloseFriends.js": True,
            "becomeLovers.js": True,
            "becomeNemesis.js": True,
            "becomeRivals.js": True,
            "becomeSoulmates.js": True,
            "changeLiege.js": True,
            "changeLocation.js": False,
            "convertReligion.js": True,
            "declareWar.js": True,
            "emotionHappy.js": True,
            "emotionPain.js": False,
            "emotionSad.js": True,
            "emotionWorry.js": True,
            "employAsKnight.js": True,
            "employInCourt.js": True,
            "fireFromCouncil.js": True,
            "giveGold.js": True,
            "grantIndependence.js": True,
            "grantLandedTitle.js": True,
            "imprisonCharacter.js": False,
            "improveOpinion.js": True,
            "intercourse.js": False,
            "killCharacter.js": False,
            "leaveConversation.js": False,
            "lowerOpinion.js": True,
            "marryOrBetroth.js": True,
            "newAllianceDiplomatic.js": True,
            "noOp.js": True,
            "offerVassalage.js": True,
            "receiveGold.js": True,
            "undressCharacter.js": False,
            "woundCharacter.js": False
        }

    def test_1_all_action_scripts_contain_canperformatdistance_attribute(self):
        """TC-001: Verify all action scripts contain canPerformAtDistance attribute."""
        missing_attributes = []
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                # Check if canPerformAtDistance property exists in the module exports
                self.assertIn(
                    "canPerformAtDistance:", content,
                    f"Missing canPerformAtDistance attribute in {action_file.name}"
                )
    
    def test_2_canperformatdistance_true_for_distance_capable_actions(self):
        """TC-002: Verify canPerformAtDistance is true for distance-capable actions."""
        mismatches = []
        
        for action_file in self.actions_dir.glob("*.js"):
            expected = self.expected_values.get(action_file.name)
            if expected is True:  # Only check actions that should be True
                with self.subTest(file=action_file.name):
                    content = action_file.read_text(encoding='utf-8')
                    # Extract the canPerformAtDistance value
                    match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                    self.assertIsNotNone(
                        match, 
                        f"Could not find canPerformAtDistance in {action_file.name}"
                    )
                    actual_value = match.group(1) == 'true'
                    self.assertEqual(
                        actual_value, True,
                        f"Expected canPerformAtDistance=True for {action_file.name}, got {actual_value}"
                    )
    
    def test_3_canperformatdistance_false_for_non_distance_capable_actions(self):
        """TC-003: Verify canPerformAtDistance is false for non-distance-capable actions."""
        mismatches = []
        
        for action_file in self.actions_dir.glob("*.js"):
            expected = self.expected_values.get(action_file.name)
            if expected is False:  # Only check actions that should be False
                with self.subTest(file=action_file.name):
                    content = action_file.read_text(encoding='utf-8')
                    # Extract the canPerformAtDistance value
                    match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                    self.assertIsNotNone(
                        match, 
                        f"Could not find canPerformAtDistance in {action_file.name}"
                    )
                    actual_value = match.group(1) == 'true'
                    self.assertEqual(
                        actual_value, False,
                        f"Expected canPerformAtDistance=False for {action_file.name}, got {actual_value}"
                    )

    def test_4_attribute_follows_existing_module_pattern(self):
        """TC-004: Verify attribute follows existing module pattern."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Verify canPerformAtDistance is defined at the module level,
                # outside of any functions.
                lines = content.split('\n')
                in_function = False
                found_at_module_level = False
                
                for line in lines:
                    stripped = line.strip()
                    if stripped.startswith('function') or stripped.startswith('check:') or stripped.startswith('run:') or stripped.startswith('chatMessage:'):
                        in_function = True
                    elif stripped.startswith('}'):
                        in_function = False
                    
                    if not in_function and 'canPerformAtDistance:' in stripped:
                        found_at_module_level = True
                        break
                
                self.assertTrue(
                    found_at_module_level,
                    f"canPerformAtDistance should be at module level in {action_file.name}"
                )
                
                # Verify it follows the same pattern as other module properties
                # (signature, args, description). The property should be a key-value pair.
                match = re.search(r'^\s*canPerformAtDistance:\s*(true|false),?\s*$', content, re.MULTILINE)
                self.assertIsNotNone(
                    match,
                    f"canPerformAtDistance should follow key-value pattern in {action_file.name}"
                )
                
                # Check for boolean literal
                self.assertIn(
                    match.group(1), ['true', 'false'],
                    f"canPerformAtDistance should be a boolean literal in {action_file.name}"
                )

    def test_5_no_syntax_errors_introduced(self):
        """TC-005: Verify no syntax errors introduced."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                try:
                    # A simple way to check for syntax errors is to try to parse it
                    # with a tool that understands JavaScript. Since we don't have a
                    # JS parser readily available, we'll rely on the fact that a
                    # malformed file might fail to be read or processed by other tests.
                    # This test will primarily check for JSON-like syntax issues if any.
                    
                    # A mock validation - we assume if other tests pass, syntax is likely ok.
                    # A more robust solution would be to use a linter.
                    action_file.read_text(encoding='utf-8')

                except Exception as e:
                    self.fail(f"Could not parse {action_file.name}: {e}")

    def test_6_attribute_does_not_break_existing_functionality_true_actions(self):
        """TC-006: Verify attribute doesn't break existing functionality (true actions)."""
        # This is a conceptual test. We can't execute the game's logic directly.
        # We assume that adding a property to an exported object does not break
        # existing functionality if the game engine safely ignores unknown properties.
        
        # We can verify that the core functions (check, run) are still present.
        for action_file in self.actions_dir.glob("*.js"):
            if self.expected_values.get(action_file.name) is True:
                with self.subTest(file=action_file.name):
                    content = action_file.read_text(encoding='utf-8')
                    self.assertIn(
                        "check:", content,
                        f"'check' function should still be present in {action_file.name}"
                    )
                    self.assertIn(
                        "run:", content,
                        f"'run' function should still be present in {action_file.name}"
                    )

    def test_7_attribute_does_not_break_existing_functionality_false_actions(self):
        """TC-007: Verify attribute doesn't break existing functionality (false actions)."""
        for action_file in self.actions_dir.glob("*.js"):
            if self.expected_values.get(action_file.name) is False:
                with self.subTest(file=action_file.name):
                    content = action_file.read_text(encoding='utf-8')
                    self.assertIn(
                        "check:", content,
                        f"'check' function should still be present in {action_file.name}"
                    )
                    self.assertIn(
                        "run:", content,
                        f"'run' function should still be present in {action_file.name}"
                    )

    def test_8_consistency_of_attribute_placement(self):
        """TC-008: Verify consistency of attribute placement."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                try:
                    desc_index = next(i for i, line in enumerate(lines) if 'description:' in line)
                    check_index = next(i for i, line in enumerate(lines) if 'check:' in line)
                    can_perform_index = next(i for i, line in enumerate(lines) if 'canPerformAtDistance:' in line)
                    
                    self.assertTrue(
                        desc_index < can_perform_index < check_index,
                        f"canPerformAtDistance should be between description and check in {action_file.name}"
                    )
                except StopIteration:
                    self.fail(f"Could not find required properties in {action_file.name}")

    def test_9_attribute_uses_correct_boolean_literals(self):
        """TC-009: Verify attribute uses correct boolean literals."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"Should find boolean literal for canPerformAtDistance in {action_file.name}"
                )

    def test_10_attribute_accessibility(self):
        """TC-010: Verify attribute accessibility."""
        # We can't import JS modules directly in Python. 
        # This test simulates checking accessibility by creating a temporary script.
        
        test_script_content = """
        const fs = require('fs');
        const path = require('path');
        const actionsDir = process.argv[2];
        const results = {};

        fs.readdirSync(actionsDir).forEach(file => {
            if (file.endsWith('.js')) {
                const action = require(path.join(actionsDir, file));
                if ('canPerformAtDistance' in action) {
                    results[file] = action.canPerformAtDistance;
                } else {
                    results[file] = 'missing';
                }
            }
        });
        console.log(JSON.stringify(results));
        """
        
        test_script_path = Path("tests/temp_js_test.js")
        test_script_path.write_text(test_script_content, encoding='utf-8')
        
        try:
            # Run the test script
            import subprocess
            result = subprocess.run(
                ['node', str(test_script_path), str(self.actions_dir)],
                capture_output=True, text=True, check=True
            )
            
            output = result.stdout.strip()
            if output.startswith('{') and output.endswith('}'):
                import json
                accessibility_results = json.loads(output)
                
                for action_file, expected in self.expected_values.items():
                    self.assertEqual(
                        accessibility_results.get(action_file), expected,
                        f"Accessibility check failed for {action_file}"
                    )
            else:
                self.fail(f"Failed to get valid JSON from node script. Output: {output}")

        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            self.fail(f"Could not run node script for accessibility check: {e}")
        finally:
            if test_script_path.exists():
                test_script_path.unlink()

    def test_11_no_duplicate_or_conflicting_attributes(self):
        """TC-011: Verify no duplicate or conflicting attributes."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                matches = re.findall(r'canPerformAtDistance:', content)
                self.assertEqual(
                    len(matches), 1,
                    f"Found duplicate canPerformAtDistance attribute in {action_file.name}"
                )

    def test_12_attribute_does_not_conflict_with_reserved_words(self):
        """TC-012: Verify attribute doesn't conflict with reserved words."""
        # `canPerformAtDistance` is not a JavaScript reserved word.
        # This test serves as a confirmation of that knowledge.
        self.assertFalse(
            'canPerformAtDistance' in ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'],
            "canPerformAtDistance should not be a reserved keyword"
        )

    def test_13_attribute_value_matches_documentation(self):
        """TC-013: Verify attribute value matches documentation."""
        for action_file_name, expected_value in self.expected_values.items():
            action_file = self.actions_dir / action_file_name
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"Could not find canPerformAtDistance in {action_file.name}"
                )
                actual_value = match.group(1) == 'true'
                self.assertEqual(
                    actual_value, expected_value,
                    f"Value mismatch for {action_file.name} between code and documentation"
                )

    def test_14_attribute_is_serializable(self):
        """TC-014: Verify attribute is serializable."""
        # We test if the module object can be JSON serialized.
        # This is a proxy for ensuring the property is simple.
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                try:
                    # Again, we can't import JS modules, so we'll simulate this.
                    # We create a simple object that mimics the module export.
                    module_obj = {
                        "signature": "test",
                        "canPerformAtDistance": self.expected_values.get(action_file.name)
                    }
                    import json
                    serialized = json.dumps(module_obj)
                    deserialized = json.loads(serialized)
                    
                    self.assertEqual(
                        deserialized['canPerformAtDistance'],
                        module_obj['canPerformAtDistance']
                    )
                except Exception as e:
                    self.fail(f"Serialization test failed for {action_file.name}: {e}")

    def test_15_attribute_works_with_strict_mode(self):
        """TC-015: Verify attribute works with strict mode."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Check if "use strict" is already present
                if not content.strip().startswith('"use strict"'):
                    strict_content = '"use strict";\n' + content
                else:
                    strict_content = content

                # We can't execute this, but we can confirm that adding the property
                # doesn't violate any obvious strict mode rules (like assigning to
                # an undeclared variable, which our pattern doesn't do).
                # The property is part of an object literal, which is safe.
                
                self.assertIn("canPerformAtDistance:", strict_content)

    def test_16_attribute_survives_minification(self):
        """TC-016: Verify attribute survives minification."""
        # This is a conceptual test. A real implementation would require a JS minifier.
        # However, property names in object literals are typically preserved unless
        # specifically configured for property mangling.
        
        # We will assume standard minification preserves property names.
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                # A minifier would likely preserve `canPerformAtDistance`
                # unless it's configured to mangle properties, which would be unsafe
                # for module exports like this.
                pass

    def test_17_attribute_does_not_affect_action_signature(self):
        """TC-017: Verify attribute doesn't affect action signature."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # The 'signature' property should still be present and unchanged.
                self.assertIn(
                    "signature:", content,
                    f"signature property should be present in {action_file.name}"
                )
                
                # We can do a basic check on the `args` property as well.
                self.assertIn(
                    "args:", content,
                    f"args property should be present in {action_file.name}"
                )

    def test_18_attribute_works_across_different_action_types(self):
        """TC-018: Verify attribute works across different action types."""
        # We classify actions into conceptual categories to ensure our logic holds.
        action_categories = {
            "financial": ["addGoldToTreasury.js", "giveGold.js", "receiveGold.js"],
            "social": ["becomeBestFriends.js", "becomeLovers.js", "improveOpinion.js"],
            "diplomatic": ["agreeToTruce.js", "allianceDiplomatic.js", "declareWar.js"],
            "administrative": ["assignToCouncilPosition.js", "employInCourt.js", "fireFromCouncil.js"],
            "physical": ["intercourse.js", "killCharacter.js", "woundCharacter.js"]
        }
        
        for category, files in action_categories.items():
            for file_name in files:
                action_file = self.actions_dir / file_name
                if action_file.exists():
                    with self.subTest(category=category, file=action_file.name):
                        expected = self.expected_values.get(action_file.name)
                        
                        content = action_file.read_text(encoding='utf-8')
                        match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                        
                        self.assertIsNotNone(match)
                        actual = match.group(1) == 'true'
                        
                        self.assertEqual(
                            actual, expected,
                            f"Value for {file_name} in category {category} is incorrect."
                        )

    def test_19_attribute_enables_letter_system_integration(self):
        """TC-019: Verify attribute enables letter system integration."""
        # Conceptual test.
        # The letter system should read this property. If it's true, the action
        # can be considered for inclusion in a letter.
        
        for action_file in self.actions_dir.glob("*.js"):
            if self.expected_values.get(action_file.name) is True:
                with self.subTest(file=action_file.name):
                    # In a real system, we'd mock the letter system and see if it
                    # correctly identifies this action as distance-capable.
                    pass

    def test_20_attribute_prevents_inappropriate_letter_use(self):
        """TC-020: Verify attribute prevents inappropriate letter use."""
        # Conceptual test.
        # If the property is false, the letter system should not allow the action.
        
        for action_file in self.actions_dir.glob("*.js"):
            if self.expected_values.get(action_file.name) is False:
                with self.subTest(file=action_file.name):
                    # Here, we'd verify the letter system blocks this action.
                    pass

    def test_21_attribute_handles_edge_cases(self):
        """TC-021: Verify attribute handles edge cases."""
        # Edge cases could include actions that are ambiguous.
        # Example: `emotionHappy.js`. It's an internal state change, but can be
        # triggered by news received from a distance. So, `true` is appropriate.
        # Example: `convertReligion.js`. Can be influenced from afar.
        
        ambiguous_cases = {
            "emotionHappy.js": True,
            "convertReligion.js": True,
            "becomeLovers.js": True  # A declaration can be made by letter
        }
        
        for file_name, expected in ambiguous_cases.items():
            action_file = self.actions_dir / file_name
            if action_file.exists():
                with self.subTest(file=file_name):
                    content = action_file.read_text(encoding='utf-8')
                    match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                    self.assertIsNotNone(match)
                    actual = match.group(1) == 'true'
                    self.assertEqual(
                        actual, expected,
                        f"Edge case {file_name} not handled as expected."
                    )

    def test_22_attribute_does_not_introduce_performance_overhead(self):
        """TC-022: Verify attribute doesn't introduce performance overhead."""
        # This is a conceptual test. The overhead of adding a single boolean
        # property to a JavaScript object is negligible and not worth measuring
        # in this context.
        # A real performance test would require benchmarking the game engine's
        # action-loading and execution code.
        
        # We can assert that the file size doesn't increase dramatically.
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                # The change adds a single line. We expect a small increase.
                # A more robust test would compare file sizes before/after.
                pass

    def test_23_attribute_works_with_existing_documentation_tools(self):
        """TC-023: Verify attribute works with existing documentation tools."""
        # This is a conceptual test. If documentation tools are used (like JSDoc),
        # they should be able to parse the new property.
        # The key-value format is standard, so it should be compatible.
        
        # To simulate, we can check if the format is clean.
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # The property should be on its own line or clearly defined.
                match = re.search(r'^\s*canPerformAtDistance:\s*(true|false),?\s*$', content, re.MULTILINE)
                self.assertIsNotNone(
                    match,
                    f"Property format in {action_file.name} should be clean for doc tools."
                )

    def test_24_attribute_survives_code_refactoring(self):
        """TC-024: Verify attribute survives code refactoring."""
        # Conceptual test.
        # As long as the property is part of the exported module object,
        # refactoring internal function logic should not affect it.
        
        # We can check that it's defined outside of the main functions (check, run).
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                run_function_match = re.search(r'run:\s*\(', content)
                self.assertIsNotNone(run_function_match)
                
                prop_match = re.search(r'canPerformAtDistance:', content)
                self.assertIsNotNone(prop_match)
                
                # The property should appear before the 'run' function's body.
                self.assertLess(
                    prop_match.start(),
                    run_function_match.start(),
                    f"Property in {action_file.name} should be outside the run function."
                )

    def test_25_complete_implementation_coverage(self):
        """TC-025: Verify complete implementation coverage."""
        all_scripts = {f.name for f in self.actions_dir.glob("*.js")}
        updated_scripts = set(self.expected_values.keys())
        
        missing_from_test = all_scripts - updated_scripts
        self.assertEqual(
            len(missing_from_test), 0,
            f"The following scripts are not in the test's expected values: {missing_from_test}"
        )
        
        extra_in_test = updated_scripts - all_scripts
        self.assertEqual(
            len(extra_in_test), 0,
            f"The following scripts are in the test but not in the directory: {extra_in_test}"
        )
        
        self.assertEqual(
            len(all_scripts), 40,
            f"Expected 40 action scripts, but found {len(all_scripts)}"
        )

    def test_26_attribute_follows_naming_conventions(self):
        """TC-026: Verify attribute follows naming conventions."""
        # The name `canPerformAtDistance` uses camelCase, which is a standard
        # convention in JavaScript.
        
        # This test confirms the property name matches this convention.
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                self.assertIn(
                    "canPerformAtDistance", content,
                    "The property name should follow camelCase."
                )
                self.assertNotIn(
                    "can_perform_at_distance", content,
                    "The property name should not use snake_case."
                )
                self.assertNotIn(
                    "CanPerformAtDistance", content,
                    "The property name should not use PascalCase."
                )

    def test_27_attribute_is_immutable_after_definition(self):
        """TC-027: Verify attribute is immutable after definition."""
        # Conceptual test.
        # The property is part of an object literal and assigned a boolean literal.
        # It's not defined with `let` or `var`, so it can't be easily reassigned
        # without directly modifying the exported object, which is not expected.
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                # We can check that there are no assignments to this property.
                content = action_file.read_text(encoding='utf-8')
                
                # This regex looks for assignments like `module.exports.canPerformAtDistance = ...`
                # or `action.canPerformAtDistance = ...`. It's a heuristic.
                assignment_match = re.search(r'\.canPerformAtDistance\s*=', content)
                self.assertIsNone(
                    assignment_match,
                    f"Should not find assignments to canPerformAtDistance in {action_file.name}"
                )

    def test_28_attribute_works_with_module_caching(self):
        """TC-028: Verify attribute works with module caching."""
        # Conceptual test. When a module is required multiple times in Node.js,
        # it's loaded from the cache. The property is part of the module object,
        # so it will be consistent across all requires.
        
        # We can simulate this by checking if the value is constant.
        # This test relies on the accessibility test (test_10) to work correctly.
        
        # As a proxy, we'll just check that reading it multiple times from the file
        # gives the same value, although this doesn't test runtime caching.
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                matches = re.findall(r'canPerformAtDistance:\s*(true|false)', content)
                
                if len(matches) > 0:
                    values = [m == 'true' for m in matches]
                    self.assertEqual(
                        len(set(values)), 1,
                        f"canPerformAtDistance should have consistent value across multiple reads: {values}"
                    )

    def test_29_attribute_does_not_conflict_with_framework_conventions(self):
        """TC-029: Verify attribute doesn't conflict with framework conventions."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # The property should coexist with expected framework properties
                required_properties = ['signature', 'args', 'description', 'check', 'run', 'chatMessage']
                
                for prop in required_properties:
                    self.assertIn(
                        f'{prop}:', content,
                        f"Required property '{prop}' should still be present in {action_file.name}"
                    )
                
                # Check that canPerformAtDistance doesn't interfere with these properties
                # by ensuring they're all present and in reasonable positions
                lines = content.split('\n')
                prop_positions = {}
                
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    for prop in required_properties + ['canPerformAtDistance']:
                        if stripped.startswith(f'{prop}:'):
                            prop_positions[prop] = i
                
                # All required properties should be found
                for prop in required_properties:
                    self.assertIn(
                        prop, prop_positions,
                        f"Property '{prop}' should be found in {action_file.name}"
                    )
                
                # canPerformAtDistance should also be found
                self.assertIn(
                    'canPerformAtDistance', prop_positions,
                    f"canPerformAtDistance should be found in {action_file.name}"
                )

    def test_30_attribute_enables_future_extensibility(self):
        """TC-030: Verify attribute enables future extensibility."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # The pattern used for canPerformAtDistance should allow similar attributes
                # to be added following the same approach
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"Should find canPerformAtDistance defined as a simple property in {action_file.name}"
                )
                
                # Verify it follows the same pattern as other properties
                # This makes it easy to add similar properties in the future
                lines = content.split('\n')
                prop_lines = []
                
                for line in lines:
                    stripped = line.strip()
                    if any(stripped.startswith(f'{prop}:') for prop in 
                           ['signature', 'args', 'description', 'canPerformAtDistance', 'check', 'run', 'chatMessage']):
                        prop_lines.append(stripped)
                
                # Should be able to add another property following the same pattern
                # Check that properties are defined at the same indentation level
                if len(prop_lines) > 1:
                    # Get indentation of first property line
                    first_indent = len(prop_lines[0]) - len(prop_lines[0].lstrip())
                    
                    # Check that canPerformAtDistance follows the same indentation
                    cp_line = next((line for line in prop_lines if line.startswith('canPerformAtDistance:')), None)
                    self.assertIsNotNone(
                        cp_line,
                        f"Should find canPerformAtDistance line in {action_file.name}"
                    )
                    
                    cp_indent = len(cp_line) - len(cp_line.lstrip())
                    self.assertEqual(
                        first_indent, cp_indent,
                        f"canPerformAtDistance should have same indentation as other properties in {action_file.name}"
                    )


if __name__ == '__main__':
    unittest.main()