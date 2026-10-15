/**
 * RNC ProPack method 1 decoder. Reads 16-bit little-endian bit words
 * interleaved with literal bytes. Never writes to the input.
 */
export function unpackRnc1(source: Uint8Array): Uint8Array {
  const data = Buffer.from(source.buffer, source.byteOffset, source.byteLength);
  if (data.length < 18 || data.toString('ascii', 0, 3) !== 'RNC' || data[3] !== 1) {
    throw new Error('Expected RNC method 1');
  }
  const unpackedSize = data.readUInt32BE(4);
  const packedSize = data.readUInt32BE(8);
  if (packedSize + 18 !== data.length) throw new Error('RNC packed size mismatch');
  if (crc16(data.subarray(18)) !== data.readUInt16BE(14)) {
    throw new Error('RNC packed CRC mismatch');
  }
  const result = Buffer.alloc(unpackedSize);
  let input = 18;
  let output = 0;
  let word = 0;
  let available = 0;

  const readBits = (count: number): number => {
    let value = 0;
    let place = 1;
    while (count-- > 0) {
      if (available === 0) {
        if (input + 1 >= data.length) throw new Error('Truncated RNC bitstream');
        const lo = data[input++];
        const hi = data[input++];
        word = (((data[input + 1] ?? 0) << 24) | ((data[input] ?? 0) << 16) | (hi << 8) | lo) >>> 0;
        available = 16;
      }
      if (word & 1) value += place;
      word >>>= 1;
      available--;
      place *= 2;
    }
    return value;
  };

  const reverse = (value: number, count: number): number => {
    let result = 0;
    while (count-- > 0) {
      result = (result << 1) | (value & 1);
      value >>>= 1;
    }
    return result;
  };

  type Code = { width: number; bits: number; symbol: number };
  const readTable = (): Code[] => {
    const count = readBits(5);
    if (count > 16) throw new Error('Unsupported RNC Huffman table');
    const lengths = Array.from({ length: count }, () => readBits(4));
    const entries: Code[] = [];
    let nextCode = 0;
    for (let width = 1; width <= 16; width++) {
      for (let symbol = 0; symbol < count; symbol++) {
        if (lengths[symbol] === width) {
          entries.push({ width, bits: reverse(nextCode++, width), symbol });
        }
      }
      nextCode *= 2;
    }
    return entries;
  };

  const readValue = (entries: Code[]): number => {
    for (const entry of entries) {
      if ((word & ((1 << entry.width) - 1)) === entry.bits) {
        readBits(entry.width);
        const symbol = entry.symbol;
        return symbol < 2 ? symbol : (1 << (symbol - 1)) | readBits(symbol - 1);
      }
    }
    throw new Error('Invalid RNC Huffman code');
  };

  readBits(2); // Header flags
  while (output < result.length) {
    const literals = readTable();
    const distances = readTable();
    const lengths = readTable();
    const chunks = readBits(16);
    if (chunks === 0) throw new Error('Empty RNC block');

    for (let chunk = 0; chunk < chunks; chunk++) {
      const literalCount = readValue(literals);
      if (input + literalCount > data.length || output + literalCount > result.length) {
        throw new Error('RNC literal overflow');
      }
      if (literalCount > 0) {
        data.copy(result, output, input, input + literalCount);
        input += literalCount;
        output += literalCount;
        const lookahead =
          ((data[input] ?? 0) | ((data[input + 1] ?? 0) << 8) | ((data[input + 2] ?? 0) << 16)) >>>
          0;
        word = ((lookahead << available) | (word & ((1 << available) - 1))) >>> 0;
      }
      if (chunk + 1 < chunks) {
        const distance = readValue(distances) + 1;
        let count = readValue(lengths) + 2;
        if (distance > output || output + count > result.length) {
          throw new Error('Invalid RNC back-reference');
        }
        while (count-- > 0) {
          result[output] = result[output - distance];
          output++;
        }
      }
    }
  }
  if (crc16(result) !== data.readUInt16BE(12)) {
    throw new Error('RNC unpacked CRC mismatch');
  }
  return result;
}

export function crc16(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc;
}
