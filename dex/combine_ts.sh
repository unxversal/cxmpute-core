#!/usr/bin/env bash
set -euo pipefail

# Name of the output file
output="combined_ts_files.txt"

# Truncate (or create) the output file
: > "$output"

# Find all .ts and .tsx files and concatenate them
find . -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 |
while IFS= read -r -d '' file; do
  echo "=== $file ===" >> "$output"
  cat "$file" >> "$output"
  echo -e "\n" >> "$output"
done

echo "All .ts/.tsx files have been combined into $output"