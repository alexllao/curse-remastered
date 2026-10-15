# Investigation notes

- Confirm executable type and compiler from actual binary evidence.
- Inventory and hash original assets locally.
- Reverse-engineer palettes, sprites and scene data using read-only tools.
- Do not commit original game assets; they belong in `original/` (ignored).

## Original palette routine harness

`trace-palettes.py` executes the original MZ palette code with Unicorn (pinned in `requirements.txt`). It captures VGA DAC writes into ignored reports and rejects unknown executable revisions. It is an isolated routine test, not a full DOS emulator or a full-game timing capture. See [setup, verified behavior and limitations](../../docs/palette-effects.md).
