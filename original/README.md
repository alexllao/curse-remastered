# Original game files (local only)

Place `CURSE.EXE` and all extracted game resource files here, preserving the original folder structure.

Example:

```
original/
  CURSE.EXE
  TITLE.DAT
  ...other original files...
```

Do **not** commit or redistribute the original executable or game resources. This folder is tracked only through this README; its contents are ignored by the repository's root `.gitignore` (`original/`).

For local inspection, run:

```bash
pnpm inspect original/CURSE.EXE
```

The game will not load these resources automatically yet; decoder development comes next.
