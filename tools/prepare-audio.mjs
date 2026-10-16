import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(
  process.env.CURSE_PYTHON || 'python',
  ['tools/render-mt32.py', ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHONPATH: [join(root, 'reports/tool-build-deps'), process.env.PYTHONPATH]
        .filter(Boolean)
        .join(delimiter),
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
