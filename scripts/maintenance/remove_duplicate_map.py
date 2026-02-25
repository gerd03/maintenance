#!/usr/bin/env python3
# Script to remove the first occurrence of the map section from careers.html

with open('careers.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and remove lines 546-579 (0-indexed would be 545-578)
# The map section in the main content area
new_lines = lines[:545] + lines[579:]

# Write back the file
with open('careers.html', 'w', encoding='utf-8', newline='\r\n') as f:
    f.writelines(new_lines)

print("Successfully removed duplicate map section from top of page")
