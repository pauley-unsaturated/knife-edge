#!/usr/bin/env bash
# Usage: Scripts/new-note.sh <path.md> "tag1, tag2"  (writes frontmatter header to stdout)
# Notes are PunkRecords-compatible: YAML frontmatter with id/created/modified/tags, [[wikilinks]] in the body.
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
id=$(cat /proc/sys/kernel/random/uuid | tr a-f A-F)
printf -- "---\nid: %s\ncreated: %s\nmodified: %s\ntags: [%s]\n---\n" "$id" "$now" "$now" "$2"
