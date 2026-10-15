# CURSE Remastered

A TypeScript and PixiJS 8 reconstruction of the classic DOS point-and-click adventure, targeting modern Windows.

> Original game files are **not** included. Supply your own legally obtained files in `original/`. Never commit originals, decoded assets or reports.

## Setup

Requires Node.js 22+ and pnpm 10.

```powershell
pnpm install
pnpm dev
```

## Original asset recovery

The asset pipeline is intentionally **non-destructive**. It reads `original/` and writes generated outputs to `reports/`, which is gitignored.

```powershell
pnpm inventory
pnpm --filter @curse/asset-extractor rnc-info
pnpm --filter @curse/asset-extractor title-png
pnpm --filter @curse/asset-extractor extract-all
```

- `inventory` creates a file inventory with sizes, signatures and hashes.
- `rnc-info` inspects an RNC header and checks the packed CRC.
- `title-png` decompresses `DATA/TITLE.DAT`, validates its CRC and applies `DATA/TITLE.PAL` to produce `reports/TITLE.png` (320×200).
- `extract-all` recursively scans `original/` for game data extensions. It decompresses **RNC method 1** resources to `reports/extracted/<original-relative-path>.bin` and produces `reports/extracted/manifest.json`. RNC method 2 is **not supported yet**; unknown/raw formats are inventoried without guessing how to interpret them. A successfully decompressed binary is not necessarily a ready-to-display image.

The extractor preserves original names and directory structure. It does not overwrite or modify original files. Do not publish extracted copyrighted game assets.

## Development checks

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm check
```

Husky runs lint-staged before commits and `pnpm check` before pushes. Run `pnpm format` when normalizing the existing codebase.

## Roadmap

1. **Asset recovery:** inventory all files; validate RNC1 extraction; implement RNC2; reverse-engineer `.MAP`, `.SPR`, `.BRD`, `.SFX`, palettes and any additional containers; produce reproducible conversion tools and manifests.
2. **Original playable reconstruction:** scenes, hotspots, verbs, navigation, character animation, audio and save/load in TypeScript + PixiJS 8.
3. **Optional non-destructive graphics improvements:** offer **Original** (integer nearest-neighbor), **Enhanced** (e.g. xBRZ/ScaleFX), and **Remastered HD** (offline AI upscaling with manual review). Preserve original art, transparency and animation consistency. Backgrounds and sprites may require different processing. Do not run AI upscaling during gameplay.

**Current status:** RNC1 and title-image extraction tools exist. Batch extraction and full-project validation still need to be run locally against the original game data. RNC2 and most resource format parsers are pending.
