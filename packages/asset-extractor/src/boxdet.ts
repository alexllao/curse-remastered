/** Registros originales; aún no son una malla de navegación ni un estado de partida. */
export function readBoxdet(data: Buffer, resourceId: number) {
  if (!Number.isInteger(resourceId) || resourceId < 0 || resourceId >= 78 || data.length < 156)
    throw new Error('Invalid BOXDET resource');
  const pointerOffset = resourceId * 2;
  const offset = data.readUInt16LE(pointerOffset);
  if (offset === 0) return { resourceId, pointerOffset, offset, records: [] };
  if (offset < 156 || offset + 2 > data.length) throw new Error('Invalid BOXDET pointer');
  const count = data.readUInt16LE(offset);
  if (offset + 2 + count * 10 > data.length) throw new Error('Truncated BOXDET records');
  const records = Array.from({ length: count }, (_, index) => {
    const fileOffset = offset + 2 + index * 10;
    return {
      index,
      fileOffset,
      type: data[fileOffset],
      argument: data[fileOffset + 1],
      left: data.readInt16LE(fileOffset + 2),
      top: data.readInt16LE(fileOffset + 4),
      right: data.readInt16LE(fileOffset + 6),
      bottom: data.readInt16LE(fileOffset + 8),
    };
  });
  return { resourceId, pointerOffset, offset, records };
}
