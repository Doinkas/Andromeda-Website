#!/usr/bin/env python3
"""
Player Profiles Feature - Validation Script
Checks that all components are properly integrated
"""

import json
import os
import re
from pathlib import Path

# Define file paths
WORKSPACE_ROOT = Path("c:\\Users\\caleb\\OneDrive\\Desktop\\Andromeda-Website")

# Files that must exist
REQUIRED_FILES = [
    "js/ui/playerTooltip.ui.js",
    "js/services/profilesImport.service.js",
    "admin/profiles-import.html",
    "admin/js/profiles-import.js",
    "PLAYER_PROFILES_IMPLEMENTATION.md",
    "PLAYER_PROFILES_CSV_EXAMPLE.csv"
]

# File modifications to verify
MODIFICATIONS = {
    "js/services/rosters.service.js": [
        "preserv profile field",  # Should preserve profile
        "player.profile"          # Should check for profile
    ],
    "js/team-page.js": [
        "initPlayerTooltips",
        "data-player-profile",
        "JSON.stringify(player.profile)"
    ],
    "js/roster-render.js": [
        "initPlayerTooltips",
        "data-player-profile",
        "JSON.stringify(player.profile)"
    ],
    "firestore.rules": [
        "isValidProfile",
        "isValidPlayer",
        "profile.bio is string"
    ],
    "admin/index.html": [
        "profiles-import.html",
        "Import Player Profiles"
    ]
}

def validate_files_exist():
    """Check that all required files were created."""
    print("✓ Checking file existence...")
    
    for file_path in REQUIRED_FILES:
        full_path = WORKSPACE_ROOT / file_path
        if full_path.exists():
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ MISSING: {file_path}")
            return False
    
    return True

def validate_modifications():
    """Check that all required code modifications are present."""
    print("\n✓ Checking code modifications...")
    
    for file_path, required_strings in MODIFICATIONS.items():
        full_path = WORKSPACE_ROOT / file_path
        
        if not full_path.exists():
            print(f"  ✗ File missing: {file_path}")
            return False
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for required_str in required_strings:
            # Case-insensitive search
            if required_str.lower() in content.lower():
                print(f"  ✓ {file_path}: '{required_str}'")
            else:
                print(f"  ✗ {file_path}: Missing '{required_str}'")
                return False
    
    return True

def validate_csv_format():
    """Check CSV example file format."""
    print("\n✓ Checking CSV example format...")
    
    csv_path = WORKSPACE_ROOT / "PLAYER_PROFILES_CSV_EXAMPLE.csv"
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    header = lines[0].strip().split(',')
    required_columns = ['teamId', 'ign', 'bio', 'mains', 'strength', 'teamValue', 'favoriteHero', 'favoriteMap', 'funFact', 'twitch', 'twitter', 'youtube']
    
    for col in required_columns:
        if col in header:
            print(f"  ✓ Column: {col}")
        else:
            print(f"  ✗ Missing column: {col}")
            return False
    
    # Check data rows
    if len(lines) >= 2:
        print(f"  ✓ Example data rows: {len(lines) - 1}")
    else:
        print(f"  ✗ No example data rows")
        return False
    
    return True

def validate_firestore_rules():
    """Check Firestore rules validation functions."""
    print("\n✓ Checking Firestore rules validation...")
    
    rules_path = WORKSPACE_ROOT / "firestore.rules"
    
    with open(rules_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    required_rules = [
        ("isValidProfile", "function isValidProfile(profile)"),
        ("isValidPlayer", "function isValidPlayer(player)"),
        ("profile.bio is string", "profile.bio is string"),
        ("mains", "profile.mains is list"),
        ("rosters validation", "request.resource.data.players.all(p => isValidPlayer(p))")
    ]
    
    for rule_name, rule_code in required_rules:
        if rule_code in content:
            print(f"  ✓ {rule_name}")
        else:
            print(f"  ✗ Missing: {rule_name}")
            return False
    
    return True

def validate_js_modules():
    """Check that key JS modules export correct functions."""
    print("\n✓ Checking JS module exports...")
    
    # Check profilesImport.service.js
    import_service_path = WORKSPACE_ROOT / "js/services/profilesImport.service.js"
    with open(import_service_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    exports = ["parseCSV", "previewProfileChanges", "applyProfileUpdates"]
    
    for export in exports:
        if f"export function {export}" in content or f"export {{" in content and export in content:
            print(f"  ✓ profilesImport.service.js exports {export}")
        else:
            print(f"  ✗ profilesImport.service.js missing {export}")
            return False
    
    # Check playerTooltip.ui.js
    tooltip_path = WORKSPACE_ROOT / "js/ui/playerTooltip.ui.js"
    with open(tooltip_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "export function initPlayerTooltips" in content:
        print(f"  ✓ playerTooltip.ui.js exports initPlayerTooltips")
    else:
        print(f"  ✗ playerTooltip.ui.js missing initPlayerTooltips export")
        return False
    
    return True

def main():
    """Run all validations."""
    print("=" * 50)
    print("Player Profiles Feature - Validation")
    print("=" * 50)
    
    all_passed = True
    
    all_passed &= validate_files_exist()
    all_passed &= validate_modifications()
    all_passed &= validate_csv_format()
    all_passed &= validate_firestore_rules()
    all_passed &= validate_js_modules()
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✓ ALL VALIDATIONS PASSED")
        print("\nImplementation complete! Ready for testing.")
    else:
        print("✗ SOME VALIDATIONS FAILED")
        print("Please review the errors above.")
    print("=" * 50)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())
