import { executableSha256, readSceneAssociations, sha256 } from './scene-palette.js';

/** Solo contextos cuyo selector y fotogramas se han ejecutado en el código original. */
export function readVerifiedBrdScriptContexts(exe: Buffer) {
  if (sha256(exe) !== executableSha256)
    throw new Error('Unknown executable revision: unverified BRD script contexts');
  const scene = readSceneAssociations(exe).find((row) => row.resourceId === 25);
  if (!scene) throw new Error('Missing verified script scene');
  return [
    {
      source: 'CHANGE.BRD',
      resourceId: scene.resourceId,
      map: scene.map,
      frames: [0, 1, 2, 3, 4],
      status: 'original-script-frame-selection' as const,
      evidence: {
        resourceGateFileOffset: 0x450f,
        scriptInstallFileOffset: 0x453f,
        scriptFileOffset: 0xf510 + 0x1b8e,
        brdSelectorFileOffset: 0xf510 + 0x1b8f,
        interpreterFileOffset: 0x85fc,
        verificationCommand: 'python tools/reverse-engineering/trace-brd-scripts.py',
      },
    },
  ];
}
