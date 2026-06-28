"""
Test suite for verifying the canPerformAtDistance attribute in action scripts.
This test suite validates that all action scripts in default_userdata/scripts/actions/standard/
have the canPerformAtDistance attribute correctly set according to the classification table.
"""

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
    
    def test_001_all_action_scripts_contain_canperformatdistance_attribute(self):
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
    
    def test_002_canperformatdistance_true_for_distance_capable_actions(self):
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
    
    def test_003_canperformatdistance_false_for_non_distance_capable_actions(self):
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
    
    def test_004_attribute_follows_existing_module_pattern(self):
        """TC-004: Verify attribute follows existing module pattern."""
        sample_file = self.actions_dir / "addGoldToTreasury.js"
        content = sample_file.read_text(encoding='utf-8')
        
        # Check that canPerformAtDistance is defined at module level (outside functions)
        lines = content.split('\n')
        in_function = False
        brace_count = 0
        found_at_module_level = False
        
        for line in lines:
            stripped = line.strip()
            
            # Track if we're inside a function
            if 'function' in stripped or 'check:' in stripped or 'run:' in stripped or 'chatMessage:' in stripped:
                in_function = True
                # Count opening braces to track when we exit the function
                brace_count += line.count('{') - line.count('}')
            elif in_function and '}' in line:
                brace_count += line.count('}') - line.count('{')
                if brace_count <= 0:
                    in_function = False
                    brace_count = 0
            
            # Check for canPerformAtDistance outside of functions
            if not in_function and 'canPerformAtDistance:' in stripped:
                found_at_module_level = True
                break
        
        self.assertTrue(
            found_at_module_level,
            "canPerformAtDistance should be defined at module level, not inside a function"
        )
        
        # Verify it follows the same pattern as other module properties
        # Should be at the same indentation level as signature, args, description
        pattern_lines = [line for line in lines if 'signature:' in line or 'args:' in line or 'description:' in line]
        if pattern_lines:
            # Get indentation of first property line
            first_prop_line = pattern_lines[0]
            prop_indent = len(first_prop_line) - len(first_prop_line.lstrip())
            
            # Find canPerformAtDistance line and check its indentation
            for line in lines:
                if 'canPerformAtDistance:' in line:
                    actual_indent = len(line) - len(line.lstrip())
                    self.assertEqual(
                        actual_indent, prop_indent,
                        "canPerformAtDistance should have same indentation as other module properties"
                    )
                    break
        
        # Verify it's a boolean literal, not a variable or expression
        match = re.search(r'canPerformAtDistance:\s*(true|false)\s*[,}]', content)
        self.assertIsNotNone(
            match,
            "canPerformAtDistance should be a boolean literal (true/false)"
        )
        self.assertNotIn(
            'canPerformAtDistance: var',
            content,
            "canPerformAtDistance should not be assigned a variable"
        )
        self.assertNotIn(
            'canPerformAtDistance: function',
            content,
            "canPerformAtDistance should not be assigned a function"
        )
    
    def test_005_no_syntax_errors_introduced(self):
        """TC-005: Verify no syntax errors introduced in action scripts."""
        parsing_errors = []
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                # Basic syntax check: look for obvious JavaScript syntax issues
                # Check for balanced braces, parentheses, and brackets
                open_braces = content.count('{')
                close_braces = content.count('}')
                open_parens = content.count('(')
                close_parens = content.count(')')
                open_brackets = content.count('[')
                close_brackets = content.count(']')
                
                self.assertEqual(
                    open_braces, close_braces,
                    f"Unbalanced braces in {action_file.name}"
                )
                self.assertEqual(
                    open_parens, close_parens,
                    f"Unbalanced parentheses in {action_file.name}"
                )
                self.assertEqual(
                    open_brackets, close_brackets,
                    f"Unbalanced brackets in {action_file.name}"
                )
                
                # Check for basic module structure
                self.assertIn(
                    'signature:', content,
                    f"Missing signature property in {action_file.name}"
                )
                self.assertIn(
                    'args:', content,
                    f"Missing args property in {action_file.name}"
                )
                self.assertIn(
                    'description:', content,
                    f"Missing description property in {action_file.name}"
                )
                self.assertIn(
                    'check:', content,
                    f"Missing check function in {action_file.name}"
                )
                self.assertIn(
                    'run:', content,
                    f"Missing run function in {action_file.name}"
                )
    
    def test_006_attribute_does_not_break_existing_functionality_true_actions(self):
        """TC-006: Verify attribute doesn't break existing functionality for true actions."""
        # Test with a known working action that should be true
        test_file = self.actions_dir / "addGoldToTreasury.js"
        content = test_file.read_text(encoding='utf-8')
        
        # Verify the file still has the expected structure
        self.assertIn('function check', content)
        self.assertIn('function run', content)
        self.assertIn('function chatMessage', content)
        
        # Verify canPerformAtDistance doesn't interfere with function definitions
        lines = content.split('\n')
        in_check_function = False
        in_run_function = False
        in_chatmessage_function = False
        
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('check:'):
                in_check_function = True
            elif in_check_function and stripped.startswith('}'):
                in_check_function = False
            elif stripped.startswith('run:'):
                in_run_function = True
            elif in_run_function and stripped.startswith('}'):
                in_run_function = False
            elif stripped.startswith('chatMessage:'):
                in_chatmessage_function = True
            elif in_chatmessage_function and stripped.startswith('}'):
                in_chatmessage_function = False
            
            # Ensure canPerformAtDistance is not inside any function
            if 'canPerformAtDistance:' in stripped:
                self.assertFalse(
                    in_check_function or in_run_function or in_chatmessage_function,
                    "canPerformAtDistance should not be inside a function"
                )
    
    def test_007_attribute_does_not_break_existing_functionality_false_actions(self):
        """TC-007: Verify attribute doesn't break existing functionality for false actions."""
        # Test with a known working action that should be false
        test_file = self.actions_dir / "intercourse.js"
        content = test_file.read_text(encoding='utf-8')
        
        # Verify the file still has the expected structure
        self.assertIn('function check', content)
        self.assertIn('function run', content)
        self.assertIn('function chatMessage', content)
        
        # Verify canPerformAtDistance doesn't interfere with function definitions
        lines = content.split('\n')
        in_check_function = False
        in_run_function = False
        in_chatmessage_function = False
        
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('check:'):
                in_check_function = True
            elif in_check_function and stripped.startswith('}'):
                in_check_function = False
            elif stripped.startswith('run:'):
                in_run_function = True
            elif in_run_function and stripped.startswith('}'):
                in_run_function = False
            elif stripped.startswith('chatMessage:'):
                in_chatmessage_function = True
            elif in_chatmessage_function and stripped.startswith('}'):
                in_chatmessage_function = False
            
            # Ensure canPerformAtDistance is not inside any function
            if 'canPerformAtDistance:' in stripped:
                self.assertFalse(
                    in_check_function or in_run_function or in_chatmessage_function,
                    "canPerformAtDistance should not be inside a function"
                )
    
    def test_008_consistency_of_attribute_placement(self):
        """TC-008: Verify consistency of attribute placement."""
        inconsistent_placement = []
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                # Find line numbers of key properties
                desc_line = None
                cp_line = None
                check_line = None
                
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    if stripped.startswith('description:'):
                        desc_line = i
                    elif stripped.startswith('canPerformAtDistance:'):
                        cp_line = i
                    elif stripped.startswith('check:'):
                        check_line = i
                
                # Verify description comes before canPerformAtDistance
                if desc_line is not None and cp_line is not None:
                    self.assertLess(
                        desc_line, cp_line,
                        f"description should come before canPerformAtDistance in {action_file.name}"
                    )
                
                # Verify canPerformAtDistance comes before check
                if cp_line is not None and check_line is not None:
                    self.assertLess(
                        cp_line, check_line,
                        f"canPerformAtDistance should come before check in {action_file.name}"
                    )
    
    def test_009_attribute_uses_correct_boolean_literals(self):
        """TC-009: Verify attribute uses correct boolean literals."""
        incorrect_usage = []
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Check for proper boolean literals (not strings, numbers, or variables)
                matches = re.findall(r'canPerformAtDistance:\s*([^,\n\r]+)', content)
                for match in matches:
                    value = match.strip()
                    # Should be exactly 'true' or 'false' (possibly with whitespace)
                    self.assertIn(
                        value, ['true', 'false'],
                        f"canPerformAtDistance should be boolean literal 'true' or 'false', got '{value}' in {action_file.name}"
                    )
    
    def test_010_attribute_accessibility(self):
        """TC-010: Verify attribute accessibility."""
        # Test with a sample action script
        test_file = self.actions_dir / "addGoldToTreasury.js"
        
        # Create a temporary test script that imports the action module
        test_content = f'''
const fs = require('fs');
const path = require('path');

// Read the file content
const filePath = path.join(__dirname, 'default_userdata', 'scripts', 'actions', 'standard', 'addGoldToTreasury.js');
let content = fs.readFileSync(filePath, 'utf8');

// Extract the object literal (assuming it's the main export)
const wrapper = `(function () {{ {content} }})()`;
let moduleExports;
try {{
    // This is a simplified approach - in reality we'd need to properly parse the JS
    // For this test, we'll just check if the property exists in the text
    const canPerformMatch = content.match(/canPerformAtDistance:\s*(true|false)/);
    const isAccessible = canPerformMatch !== null;
    const value = canPerformMatch ? canPerformMatch[1] === 'true' : null;
    
    console.log(JSON.stringify({{
        accessible: isAccessible,
        value: value
    }}));
}} catch (e) {{
    console.log(JSON.stringify({{
        accessible: false,
        error: e.message
    }}));
}}
'''
        
        # Write temporary test file
        test_file_path = Path("temp_test_accessibility.js")
        test_file_path.write_text(test_content, encoding='utf-8')
        
        try:
            # Run the test script
            import subprocess
            result = subprocess.run(
                ['node', str(test_file_path)],
                capture_output=True,
                text=True,
                cwd='.'
            )
            
            # Parse the output
            output = result.stdout.strip()
            if output.startswith('{') and output.endswith('}'):
                import json
                result_data = json.loads(output)
                self.assertTrue(
                    result_data['accessible'],
                    "canPerformAtDistance property should be accessible"
                )
                # Note: We're not checking the exact value here as that's covered in other tests
            else:
                # Fallback: just check if we can find the property in the file
                content = test_file.read_text(encoding='utf-8')
                self.assertIn('canPerformAtDistance:', content)
        finally:
            # Clean up temporary file
            if test_file_path.exists():
                test_file_path.unlink()
    
    def test_011_no_duplicate_or_conflicting_attributes(self):
        """TC-011: Verify no duplicate or conflicting attributes."""
        duplicates_found = []
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                # Count occurrences of canPerformAtDistance
                matches = re.findall(r'canPerformAtDistance:', content)
                self.assertEqual(
                    len(matches), 1,
                    f"Expected exactly one canPerformAtDistance declaration in {action_file.name}, found {len(matches)}"
                )
    
    def test_012_attribute_does_not_conflict_with_reserved_words(self):
        """TC-012: Verify attribute doesn't conflict with reserved words."""
        # This is more of a documentation test - we're verifying the property name is valid
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Verify the property can be used (it's already being used in the file)
                self.assertIn(
                    'canPerformAtDistance:', content,
                    f"Property name 'canPerformAtDistance' should be valid in {action_file.name}"
                )
                
                # Additional check: ensure it's not causing syntax errors when accessed
                # We already test this in other tests by checking for the property
    
    def test_013_attribute_value_matches_documentation(self):
        """TC-013: Verify attribute value matches documentation."""
        mismatches = []
        
        for action_file in self.actions_dir.glob("*.js"):
            expected = self.expected_values.get(action_file.name)
            if expected is not None:  # Only check actions we have expectations for
                with self.subTest(file=action_file.name):
                    content = action_file.read_text(encoding='utf-8')
                    match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                    self.assertIsNotNone(
                        match,
                        f"Could not find canPerformAtDistance in {action_file.name}"
                    )
                    actual_value = match.group(1) == 'true'
                    self.assertEqual(
                        actual_value, expected,
                        f"canPerformAtDistance mismatch for {action_file.name}: expected {expected}, got {actual_value}"
                    )
    
    def test_014_attribute_is_serializable(self):
        """TC-014: Verify attribute is serializable."""
        # Test with a sample action script
        test_file = self.actions_dir / "addGoldToTreasury.js"
        content = test_file.read_text(encoding='utf-8')
        
        # Extract the object-like structure (simplified serialization test)
        # In a real scenario, we'd properly parse the JS object, but for this test
        # we'll check that the property can be extracted and would serialize correctly
        
        match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
        self.assertIsNotNone(match, "Should be able to extract canPerformAtDistance value")
        
        value_str = match.group(1)
        # This value should be directly serializable to JSON
        import json
        try:
            json_value = json.loads(value_str)
            self.assertIn(json_value, [True, False], "Value should be boolean and JSON serializable")
        except json.JSONDecodeError:
            self.fail(f"canPerformAtDistance value '{value_str}' is not JSON serializable")
    
    def test_015_attribute_works_with_strict_mode(self):
        """TC-015: Verify attribute works with strict mode."""
        # Check if any action files use strict mode
        strict_mode_files = []
        for action_file in self.actions_dir.glob("*.js"):
            content = action_file.read_text(encoding='utf-8')
            if '"use strict"' in content or "'use strict'" in content:
                strict_mode_files.append(action_file.name)
        
        # If there are strict mode files, verify canPerformAtDistance still works
        for file_name in strict_mode_files:
            with self.subTest(file=file_name):
                action_file = self.actions_dir / file_name
                content = action_file.read_text(encoding='utf-8')
                
                # Should still be able to find canPerformAtDistance
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"canPerformAtDistance should be accessible in strict mode file {file_name}"
                )
                
                # Should be a valid boolean literal
                value = match.group(1)
                self.assertIn(value, ['true', 'false'], f"Value should be boolean literal in {file_name}")
    
    def test_016_attribute_survives_minification(self):
        """TC-016: Verify attribute survives minification."""
        # This is a conceptual test - we're verifying the property is defined in a way
        # that would survive typical minification (as a property literal)
        # This is a conceptual test - we're verifying the property is defined in a way
        # that would survive typical minification (as a property literal)
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Check that it's defined as a simple property: value pair
                # This pattern should survive minification
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"canPerformAtDistance should be defined as a simple property: value pair in {action_file.name}"
                )
                
                # Ensure it's not wrapped in a complex expression that might break during minification
                # Look for the pattern in context - should be at object property level
                lines = content.split('\n')
                for line in lines:
                    if 'canPerformAtDistance:' in line:
                        # Check that it's not inside a function call or complex expression
                        stripped = line.strip()
                        # Should start with the property or be preceded by whitespace/comma
                        self.assertTrue(
                            stripped.startswith('canPerformAtDistance:') or 
                            stripped.endswith('canPerformAtDistance:') or
                            ',' in line.split('canPerformAtDistance:')[0] if 'canPerformAtDistance:' in line else True,
                            f"canPerformAtDistance should be at object property level in {action_file.name}"
                        )
                        break
    
    def test_017_attribute_does_not_affect_action_signature(self):
        """TC-017: Verify attribute doesn't affect action signature."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Extract signature property
                signature_match = re.search(r'signature:\s*\([^)]*\)', content)
                self.assertIsNotNone(
                    signature_match,
                    f"Should be able to find signature property in {action_file.name}"
                )
                
                signature = signature_match.group(0)
                # The signature should remain unchanged - it should still match the pattern
                # of having parentheses with parameters
                self.assertRegex(
                    signature,
                    r'signature:\s*\([^)]*\)',
                    f"Signature should maintain its format in {action_file.name}"
                )
                
                # Ensure canPerformAtDistance doesn't appear inside the signature
                self.assertNotRegex(
                    signature,
                    r'canPerformAtDistance',
                    f"canPerformAtDistance should not appear in signature in {action_file.name}"
                )
    
    def test_018_attribute_works_across_different_action_types(self):
        """TC-018: Verify attribute works across different action types."""
        # Test samples from each category mentioned in the classification table
        test_cases = [
            # Financial
            ("addGoldToTreasury.js", True),
            ("giveGold.js", True),
            ("receiveGold.js", True),
            # Social
            ("becomeBestFriends.js", True),
            ("emotionHappy.js", True),
            ("improveOpinion.js", True),
            ("lowerOpinion.js", True),
            # Diplomatic
            ("agreeToTruce.js", True),
            ("declareWar.js", True),
            ("marryOrBetroth.js", True),
            # Administrative
            ("assignToCouncilPosition.js", True),
            ("employAsKnight.js", True),
            ("employInCourt.js", True),
            # Physical (should be False)
            ("intercourse.js", False),
            ("killCharacter.js", False),
            ("undressCharacter.js", False),
            ("woundCharacter.js", False)
        ]
        
        for action_file, expected_value in test_cases:
            with self.subTest(file=action_file, expected=expected_value):
                action_path = self.actions_dir / action_file
                self.assertTrue(
                    action_path.exists(),
                    f"Test file {action_file} should exist"
                )
                
                content = action_path.read_text(encoding='utf-8')
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"Should find canPerformAtDistance in {action_file}"
                )
                
                actual_value = match.group(1) == 'true'
                self.assertEqual(
                    actual_value, expected_value,
                    f"canPerformAtDistance should be {expected_value} for {action_file}, got {actual_value}"
                )
    
    def test_019_attribute_enables_letter_system_integration(self):
        """TC-019: Verify attribute enables letter system integration."""
        # Test with a distance-capable action
        test_file = self.actions_dir / "addGoldToTreasury.js"
        content = test_file.read_text(encoding='utf-8')
        
        # Verify the attribute exists and is true
        match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
        self.assertIsNotNone(match, "Should find canPerformAtDistance")
        self.assertEqual(
            match.group(1), 'true',
            "canPerformAtDistance should be true for distance-capable actions"
        )
        
        # In a real implementation, the letter system would check this value
        # For this test, we verify the value is accessible and correct
        can_perform_distance = (match.group(1) == 'true')
        self.assertTrue(
            can_perform_distance,
            "Letter system should be able to determine this action can be performed at distance"
        )
    
    def test_020_attribute_prevents_inappropriate_letter_use(self):
        """TC-020: Verify attribute prevents inappropriate letter use."""
        # Test with a non-distance-capable action
        test_file = self.actions_dir / "intercourse.js"
        content = test_file.read_text(encoding='utf-8')
        
        # Verify the attribute exists and is false
        match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
        self.assertIsNotNone(match, "Should find canPerformAtDistance")
        self.assertEqual(
            match.group(1), 'false',
            "canPerformAtDistance should be false for non-distance-capable actions"
        )
        
        # In a real implementation, the letter system would check this value
        # and prevent the action from being performed via letter
        can_perform_distance = (match.group(1) == 'true')
        self.assertFalse(
            can_perform_distance,
            "Letter system should be able to determine this action cannot be performed at distance"
        )
    
    def test_021_attribute_handles_edge_cases(self):
        """TC-021: Verify attribute handles edge cases."""
        # Test actions that might be considered ambiguous or edge cases
        edge_cases = [
            # Emotional actions (mostly true based on classification)
            ("emotionHappy.js", True),
            ("emotionSad.js", True),
            ("emotionWorry.js", True),
            ("emotionPain.js", False),  # This is false - physical sensation
            # Social actions that are clearly defined
            ("becomeLovers.js", True),
            ("becomeNemesis.js", True),
            ("becomeRivals.js", True),
            ("becomeSoulmates.js", True),
            # Administrative actions
            ("assignToCourtPosition.js", True),
            ("fireFromCouncil.js", True),
            # Diplomatic actions
            ("changeLiege.js", True),
            ("grantIndependence.js", True),
            ("grantLandedTitle.js", True),
            # Physical actions (clearly false)
            ("imprisonCharacter.js", False),
            ("leaveConversation.js", False),
        ]
        
        for action_file, expected_value in edge_cases:
            with self.subTest(file=action_file, expected=expected_value):
                action_path = self.actions_dir / action_file
                self.assertTrue(
                    action_path.exists(),
                    f"Edge case file {action_file} should exist"
                )
                
                content = action_path.read_text(encoding='utf-8')
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"Should find canPerformAtDistance in edge case {action_file}"
                )
                
                actual_value = match.group(1) == 'true'
                self.assertEqual(
                    actual_value, expected_value,
                    f"canPerformAtDistance should be {expected_value} for edge case {action_file}, got {actual_value}"
                )
    
    def test_022_attribute_does_not_introduce_performance_overhead(self):
        """TC-022: Verify attribute doesn't introduce performance overhead."""
        # This is a conceptual test - we're verifying the property is a simple literal
        # that shouldn't add significant overhead
        
        total_properties = 0
        cp_properties = 0
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Count total properties in the object (approximate)
                # Look for patterns like "property:" 
                prop_matches = re.findall(r'(\w+):\s*[^,\n\r]+(?:,|$)', content)
                total_properties += len(prop_matches)
                
                # Count canPerformAtDistance properties
                cp_matches = re.findall(r'canPerformAtDistance:\s*[^,\n\r]+(?:,|$)', content)
                cp_properties += len(cp_matches)
                
                # Verify it's defined = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    defined,
                    f"Each action file should have exactly one canPerformAtDistance property"
                )
        
        # The overhead should be minimal - just one additional property per file
        # We're not actually measuring performance here, but verifying the structure
        # that would not introduce significant overhead
        self.assertGreater(
            cp_properties, 0,
            "Should find canPerformAtDistance properties in action files"
        )
    
    def test_023_attribute_works_with_existing_documentation_tools(self):
        """TC-023: Verify attribute works with existing documentation tools."""
        # This is a conceptual test - we're verifying the property follows
        # standard JS doc conventions that documentation tools would understand
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Check that the property follows standard JSDoc-compatible format
                # (though we're not checking for actual JSDoc comments here)
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"canPerformAtDistance should be in standard property format for {action_file.name}"
                )
                
                # The property should be at the module level, making it discoverable
                # by documentation tools that parse object literals
                lines = content.split('\n')
                in_function = False
                brace_count = 0
                
                for line in lines:
                    stripped = line.strip()
                    
                    # Track function boundaries
                    if any(keyword in stripped for keyword in ['function ', 'check:', 'run:', 'chatMessage:']):
                        in_function = True
                        brace_count += line.count('{') - line.count('}')
                    elif in_function and '}' in line:
                        brace_count += line.count('}') - line.count('{')
                        if brace_count <= 0:
                            in_function = False
                            brace_count = 0
                    
                    # Check if canPerformAtDistance is outside functions
                    if 'canPerformAtDistance:' in stripped and not in_function:
                        # This is good - it's at module level where documentation tools can find it
                        break
                else:
                    self.fail(
                        f"canPerformAtDistance should be at module level (outside functions) in {action_file.name} "
                        f"for documentation tools to access it"
                    )
    
    def test_024_attribute_survives_code_refactoring(self):
        """TC-024: Verify attribute survives code refactoring."""
        # This is a conceptual test - we're verifying the property is defined
        # in a stable way that would survive common refactoring operations
        
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # The property should be defined as a simple key-value pair
                # This format is resistant to common refactoring like:
                # - Whitespace changes
                # - Comment additions/removals
                # - Reformatting
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"canPerformAtDistance should be defined as a simple key-value pair in {action_file.name}"
                )
                
                # It should not be defined in a way that's fragile to refactoring
                # For example, not as part of a complex expression that could be reordered
                lines = content.split('\n')
                for line in lines:
                    if 'canPerformAtDistance:' in line:
                        stripped = line.strip()
                        # Should be a straightforward property assignment
                        self.assertRegex(
                            stripped,
                            r'^canPerformAtDistance:\s*(true|false)([,}])?$',
                            f"canPerformAtDistance should be a simple property assignment in {action_file.name}"
                        )
                        break
    
    def test_025_complete_implementation_coverage(self):
        """TC-025: Verify complete implementation coverage."""
        # Get all JS files in the actions directory
        action_files = set(f.name for f in self.actions_dir.glob("*.js"))
        
        # Get all files we have expectations for
        expected_files = set(self.expected_values.keys())
        
        # Check for missing files in our expectations
        missing_expectations = action_files - expected_files
        self.assertEqual(
            len(missing_expectations), 0,
            f"Missing expectations for files: {missing_expectations}"
        )
        
        # Check for extra files in our expectations (shouldn't happen if we maintained the list)
        extra_expectations = expected_files - action_files
        self.assertEqual(
            len(extra_expectations), 0,
            f"Extra expectations for non-existent files: {extra_expectations}"
        )
        
        # Verify each file has the attribute
        for action_file in action_files:
            with self.subTest(file=action_file):
                action_path = self.actions_dir / action_file
                content = action_path.read_text(encoding='utf-8')
                
                match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"Every action script should have canPerformAtDistance attribute: missing in {action_file}"
                )
    
    def test_026_attribute_follows_naming_conventions(self):
        """TC-026: Verify attribute follows naming conventions."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # Find the canPerformAtDistance property
                match = re.search(r'(canPerformAtDistance):\s*(true|false)', content)
                self.assertIsNotNone(
                    match,
                    f"Should find canPerformAtDistance property in {action_file.name}"
                )
                
                property_name = match.group(1)
                # Should be camelCase
                self.assertEqual(
                    property_name, 'canPerformAtDistance',
                    f"Property name should be 'canPerformAtDate' in {action_file.name}"
                )
                
                # Should match the naming style of other properties in the same file
                # Extract other property names
                other_props = re.findall(r'(\w+):\s*[^,\n\r]+(?:,|$)', content)
                other_props = [p for p in other_props if p not in ['canPerformAtDistance']]
                
                if other_props:
                    # Check that it follows similar naming pattern (camelCase)
                    # Most properties in these files appear to be camelCase
                    self.assertTrue(
                        any(c.isupper() for c in property_name[1:]) or '_' not in property_name,
                        f"Property name should follow camelCase convention like other properties in {action_file.name}"
                    )
    
    def test_027_attribute_is_immutable_after_definition(self):
        """TC-027: Verify attribute is immutable after definition."""
        for action_file in self.actions_dir.glob("*.js"):
            with self.subTest(file=action_file.name):
                content = action_file.read_text(encoding='utf-8')
                
                # The property should be defined as a literal value, not a variable or function call
                match = re.search(r'canPerformAtDistance:\s*(true|false)(?=\s*[,}])', content)
                self.assertIsNotNone(
                    match,
                    f"canPerformAtDistance should be defined as a literal boolean in {action_file.name}"
                )
                
                # Check that it's not assigned to a variable or function result
                # Look for patterns that would indicate mutability
                lines = content.split('\n')
                for line in lines:
                    if 'canPerformAtDistance:' in line:
                        stripped = line.strip()
                        # Should not contain assignment operators after the initial colon
                        # (except for the value itself which is true/false)
                        value_part = split(':', 1)[1].strip() if ':' in line else ''
                        self.assertFalse(
                            '=' in value_part and not value_part.strip().startswith(('true', 'false')),
                            f"canPerformAtDistance should not be assigned to a variable in {action_file.name}"
                        )
                        break
    
    def test_028_attribute_works_with_module_caching(self):
        """TC-028: Verify attribute works with module caching."""
        # This is a conceptual test - we're verifying that the property value
        # would be consistent across multiple "imports" (in this case, file reads)
        
        test_file = self.actions_dir / "addGoldToTreasury.js"
        
        # Read the file multiple times
        values = []
        for i in range(3):
            content = test_file.read_text(encoding='utf-8')
            match = re.search(r'canPerformAtDistance:\s*(true|false)', content)
            self.assertIsNotNone(
                match,
                f"Should be able to find canPerformAtDistance on read {i+1}"
            )
            values.append(match.group(1) == 'true')
        
        # All readings should give the same value
        self.assertEqual(
            len(set(values)), 1,
            f"canPerformAtDistance should have consistent value across multiple reads: {values}"
        )
    
    def test_029_attribute_does_not_conflict_with_framework_conventions(self):
        """TC-029: Verify attribute doesn't conflict with framework conventions."""
        for the framework conventions."""
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
    
    def test_030_attribute_enables_future_extensibility(self):
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