#!/usr/bin/env bash
# Blocks /jarvis:stfu so Claude never takes a turn (exit 2 erases the prompt).
grep -qE '"prompt": ?"/(jarvis:)?stfu' && { echo "Jarvis: shutting up, sir." >&2; exit 2; }
exit 0
