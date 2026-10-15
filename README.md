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

## Technical guide: how the original graphics work

This section is a living reverse-engineering notebook. It explains the concepts behind the extractor, records what we have verified, and distinguishes observations from hypotheses. When we identify a new file format, update this guide before or alongside the code.

### 1. What is a pixel, and what does 320 × 200 mean?

A **pixel** is one position in a digital image. A 320 × 200 frame has 320 columns and 200 rows, so it contains **64,000 pixels**. Many DOS games used this resolution because it fit the VGA hardware and memory constraints of the era.

An image can store each pixel's full red/green/blue values (**true color**) or store a number that refers to a color in a separate table (**indexed color**). The title screen uses indexed color.

### 2. What is a palette?

A **palette** is a table of available colors. Instead of storing three color channels for every pixel, an 8-bit indexed image stores **one byte per pixel**, from 0 to 255. That number is an _index_ into a palette containing up to 256 colors.

For example:

| Pixel index | Palette entry (R, G, B) | Interpretation                |
| ----------- | ----------------------- | ----------------------------- |
| 0           | (0, 0, 0)               | Black                         |
| 1           | (63, 0, 0)              | Bright red in VGA DAC units   |
| 2           | (0, 63, 0)              | Bright green in VGA DAC units |

These are **illustrative entries**, not claims about the actual colors in `TITLE.PAL`.

A standard 256-color VGA palette contains 256 × 3 = **768 bytes**: one red, one green and one blue value per entry. The original VGA DAC typically used **6 bits per component**, meaning values from 0 to 63. Modern PNG images use 8-bit channels (0–255). A typical conversion is:

```text
modernChannel = round(vgaChannel × 255 / 63)
```

For a pixel with index `42`, the renderer reads palette entry 42 and uses its three channels. **The pixel byte is not itself a brightness value or an RGB color.**

Why does this matter? The same 64,000 indexed pixels can look completely different when paired with another palette. We must identify the correct palette for each scene; guessing one may produce wildly incorrect colors. Some games also animate colors by changing palette entries without changing the pixel indices.

### 3. How is a VGA screen stored?

A simple uncompressed 320 × 200, 8-bit indexed frame is a sequence of **64,000 bytes**, typically one byte per pixel in row-major order:

```text
offset = y × 320 + x
pixelIndex = imageBytes[offset]
rgb = palette[pixelIndex]
```

This row-major layout is the interpretation used for the extracted title image; other assets may use tiles, planes, masks, multiple frames or custom arrangements. Do **not** assume every `.MAP` or `.SPR` file is a raw 320 × 200 image.

### 4. What are RNC, RNC1 and RNC2?

**RNC** is a data compression format associated with Rob Northen Computing's ProPack tools, used by various games to reduce disk space. The bytes `RNC\x01` identify **method 1**, while `RNC\x02` identifies **method 2**. These are compression methods, **not image formats**: RNC can wrap images, maps or other arbitrary data.

A typical RNC file begins with an **18-byte header**:

| Offset | Bytes | Meaning                             |
| ------ | ----: | ----------------------------------- |
| 0      |     3 | ASCII signature `RNC`               |
| 3      |     1 | Compression method (1 or 2)         |
| 4      |     4 | Uncompressed size, big-endian       |
| 8      |     4 | Compressed payload size, big-endian |
| 12     |     2 | CRC16 of uncompressed data          |
| 14     |     2 | CRC16 of compressed data            |
| 16     |     1 | Leeway value                        |
| 17     |     1 | Number of chunks/blocks             |

**Big-endian** means the most significant byte comes first. For example, `00 00 FA 00` is hexadecimal `0xFA00`, or **64,000** in decimal.

RNC1 uses Huffman-coded values and back-references: frequently occurring patterns can be represented using fewer bits, and repeated byte sequences can refer back to data already decoded. RNC2 uses a different bitstream; it requires a separate decoder.

**CRC16** is a 16-bit checksum used to detect accidental corruption. The packed CRC checks that the compressed bytes match the header; the unpacked CRC checks the reconstructed output. A matching CRC is a useful integrity check, **not proof that a file is a valid image or that its interpretation is correct**.

### 5. Worked example: `DATA/TITLE.DAT` and `DATA/TITLE.PAL`

These values were inspected from the supplied original title files:

| Property                    | Observed value       |
| --------------------------- | -------------------- |
| Signature                   | `RNC\x01` (method 1) |
| Total `TITLE.DAT` file size | 47,064 bytes         |
| Compressed payload          | 47,046 bytes         |
| Decompressed payload        | 64,000 bytes         |
| Unpacked CRC16              | `51cb`               |
| Packed CRC16                | `af5f`               |
| Header chunk count          | 6                    |
| `TITLE.PAL` length          | 768 bytes            |
| Intended image dimensions   | 320 × 200 pixels     |

The 18-byte header plus 47,046 compressed bytes equals the file size of 47,064 bytes. The 64,000 decoded bytes correspond to 320 × 200 8-bit indexed pixels. Applying the 256-entry palette yields the original title image.

The processing steps are:

```text
TITLE.DAT -> inspect RNC header -> verify packed CRC
          -> RNC1 decompression -> verify unpacked CRC
          -> 64,000 palette indices --+
                                       +-> indexed PNG (320 × 200)
TITLE.PAL -> 256 RGB triples ---------+
```

PNG is a modern image container supported by image tools and game engines. Our converter writes an **indexed PNG** (PNG color type 3) with a `PLTE` palette chunk. PNG also compresses its image data, but this is **not the same compression format as RNC**.

### 6. What are `.MAP`, `.SPR`, `.BRD` and `.SFX`?

The original game contains files with these extensions. Their precise internal layouts **have not yet been fully documented** in this project.

| Extension | Working hypothesis                               | What still needs verifying                           |
| --------- | ------------------------------------------------ | ---------------------------------------------------- |
| `.MAP`    | Scene/background or map data                     | Compression, dimensions, layers, palette association |
| `.SPR`    | Sprites or sprite collections                    | Frame boundaries, offsets, transparency, palette     |
| `.BRD`    | Possibly animation or other structured resources | Signature, records, purpose and decoder              |
| `.SFX`    | Sound effects                                    | Encoding, sample rate, channels and playback format  |
| `.DAT`    | General-purpose game data                        | May be compressed or contain arbitrary structures    |
| `.PAL`    | Palette data                                     | Which resource uses which palette; channel encoding  |

**Important:** file extensions are clues, not specifications. We will verify formats by inspecting headers, byte patterns, known visual output and the original executable where necessary. The extractor must report unsupported formats honestly rather than produce misleading images.

### 7. What is reverse engineering in this project?

We work from original files and observed behavior to reconstruct the data structures and game logic. A reproducible workflow is:

1. Inventory files, sizes, hashes and signatures.
2. Identify compression or container headers.
3. Decompress without changing the originals; verify checksums.
4. Identify internal structures such as dimensions, frame tables, offsets, masks and palettes.
5. Export validated PNG, audio or structured JSON.
6. Compare results against original gameplay and document findings.
7. Build a modern runtime that loads the reconstructed resources.

Every new decoder should handle truncated or malformed input safely and preserve a clear distinction between **verified** and **inferred** format details.

### 8. How will PixiJS render the game?

PixiJS 8 is the modern 2D renderer used by the new game. It will draw backgrounds, characters, UI and visual effects using assets produced by our extraction pipeline. The **engine** will separately manage verbs, hotspots, scene transitions, interaction rules and game state.

For the original mode, **nearest-neighbor** scaling preserves hard pixel edges. To preserve the intended composition, we will handle aspect ratio and window resizing deliberately; original DOS VGA pixels were not necessarily displayed as square pixels on CRT monitors.

### 9. Why not upscale immediately?

Upscaling changes how an image is displayed or creates new pixels; it does **not** recover missing original information. Applying it before extraction is complete would complicate verification.

Our planned options:

- **Original:** unmodified extracted art, integer/nearest-neighbor scaling.
- **Enhanced:** deterministic pixel-art scaling such as xBRZ or ScaleFX, subject to visual review.
- **Remastered HD:** offline AI-assisted upscaling and manual cleanup, with no replacement of the original files.

Backgrounds and animated sprites require different treatment. Every frame in a character animation must stay consistent, and transparency and hotspots must remain aligned. AI may invent visual details, so its output is an optional artistic reinterpretation, not a faithful recovery of missing pixels.

### 10. Glossary

| Term           | Meaning                                                         |
| -------------- | --------------------------------------------------------------- |
| Asset          | A game resource such as an image, sprite, sound or map          |
| Byte           | Eight bits of data; can represent a palette index from 0 to 255 |
| Bit            | A single binary digit (0 or 1)                                  |
| Hexadecimal    | Base-16 notation used to inspect bytes; `0xFA00` = 64,000       |
| Indexed color  | Pixels store palette indices rather than full RGB values        |
| Palette        | Lookup table mapping pixel indices to RGB colors                |
| RGB            | Red, green and blue color channels                              |
| VGA DAC        | Hardware palette converter used in classic VGA displays         |
| RNC            | Compressed data container/bitstream format                      |
| Huffman coding | Variable-length coding used in RNC1                             |
| Back-reference | Instruction to reuse bytes previously decompressed              |
| CRC            | Checksum for detecting corruption                               |
| PNG            | Modern lossless image format                                    |
| Sprite         | Image or animation frame representing an object/character       |
| Hotspot        | Interactive region in a scene                                   |
| Upscaling      | Enlarging an image by generating or interpolating pixels        |

## Extraction run: 2026-10-15

The first user-provided `reports/extracted/manifest.json` reports **192 eligible game data files** scanned: **3 RNC1 extracted**, **16 RNC2 unsupported**, **173 raw/unrecognized**. These are **extraction status counts**, not a measure of the fraction of game content decoded. The earlier whole-directory inventory counted more files because it included non-resource extensions.

Verified from the manifest:

- RNC1: `DATA/TITLE.DAT` (64,000 decoded bytes), `DATA/CORE.DAT` (64,000), `DATA/MENU.DAT` (10,240). The batch extractor reports valid packed CRCs for these; the RNC1 decoder also checks unpacked CRC before writing.
- RNC2: 16 files, including `BALCONY1`–`BALCONY5`, `BASEBAL1`–`BASEBAL6`, `BASEBAT`, and `CAULDRN1`–`CAULDRN4`. All declare 64,000 unpacked bytes and have valid packed CRCs. **Likely** 320×200 indexed screens or frames; not yet visually confirmed.
- Raw/unrecognized: 173 files. These include `.MAP`, `.SPR`, `.BRD`, `.SFX`, `.PAL` and other files. `raw` means the current tool has **not recognized an RNC wrapper**, not that the file is uncompressed or corrupt.

### Next investigation steps

1. Implement and CRC-validate **RNC2**. Export the 16 recovered 64,000-byte buffers, then determine the correct palette associations and visually inspect the resulting frames.
2. Investigate **`.MAP`** binary headers and scene representation; collect several representative files and compare byte patterns and sizes.
3. Decode **`.SPR`** frame tables, masks and transparency, starting with `MOUSE.SPR`, `FONT.SPR` and `ICONS.SPR`.
4. Reverse-engineer `.BRD` animation/other structures and `.SFX` audio only after inspecting actual bytes.
5. Keep adding validated findings, examples and commands here. Never commit original or extracted copyrighted data.
