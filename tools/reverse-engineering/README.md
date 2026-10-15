# Investigation notes

- Confirm executable type and compiler from actual binary evidence.
- Inventory and hash original assets locally.
- Reverse-engineer palettes, sprites and scene data using read-only tools.
- Do not commit original game assets; they belong in `original/` (ignored).

## Original palette routine harness

`trace-palettes.py` executes the original MZ palette code with Unicorn (pinned in `requirements.txt`). It captures VGA DAC writes into ignored reports and rejects unknown executable revisions. It is an isolated routine test, not a full DOS emulator or a full-game timing capture. See [setup, verified behavior and limitations](../../docs/palette-effects.md).

`trace-icon-context.py` reuses that harness to check object 175, inventory insertion and ICONS[159] selection. See [verified context and reproduction](../../docs/icon159-context.md).

## Original MAP routine harness

`trace-map-backgrounds.py` compares all exported, referenced MAP strips with the original RNC2 instructions, and tests the original VGA blitter with a synthetic pattern. Run `scene-backgrounds` first. Uses the same pinned Unicorn dependency and executable profile as `trace-palettes.py`. See [reproduction, results and limits](../../docs/map-brd-resources.md).
