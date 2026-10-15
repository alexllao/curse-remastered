import { parseSceneObjects } from './icon-context.js';
import { executableSha256, readSceneAssociations, sha256 } from './scene-palette.js';

/** Solo contextos cuyo selector y fotogramas se han ejecutado en el código original. */
export function readVerifiedBrdScriptContexts(exe: Buffer) {
  if (sha256(exe) !== executableSha256)
    throw new Error('Unknown executable revision: unverified BRD script contexts');
  const scenes = readSceneAssociations(exe);
  const scene = scenes.find((row) => row.resourceId === 25);
  const finalScene = scenes.find((row) => row.resourceId === 72);
  if (!finalScene) throw new Error('Missing final action scene');
  const base = exe.readUInt16LE(8) * 16 + 0x0f31 * 16;
  const targetLocations = scenes
    .flatMap((row) =>
      parseSceneObjects(
        exe,
        base,
        exe.readUInt16LE(base + 0x53b5 + row.resourceId * 2),
        row.resourceId,
      ),
    )
    .filter((object) => object.objectId === 177);
  if (targetLocations.length !== 1 || targetLocations[0].resourceId !== finalScene.resourceId)
    throw new Error('Unexpected initial location for final action target');
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
    {
      source: 'CASTLE.BRD',
      resourceId: finalScene.resourceId,
      map: finalScene.map,
      frames: [23, 24, 25],
      status: 'original-script-frame-selection' as const,
      evidence: {
        actionDispatchFileOffset: 0x438a,
        scriptInstallFileOffset: 0x4c1d,
        scriptFileOffset: base + 0x2ba8,
        brdSelectorFileOffset: base + 0x2bb3,
        targetObjectId: 177,
        itemObjectId: 175,
        targetRecordFileOffset: targetLocations[0].recordFileOffset,
        resourceScope:
          'initial-target-object-location; action dispatch checks object IDs, not resource ID',
        stopAfterFrame: 25,
        interpreterFileOffset: 0x85fc,
        verificationCommand: 'python tools/reverse-engineering/trace-brd-scripts.py',
      },
    },
  ];
}
