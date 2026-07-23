const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50;

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUTF8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc: number;
}

export function createZip(files: Record<string, string>): Uint8Array {
  const entries: ZipEntry[] = [];
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encodeUTF8(name);
    const dataBytes = encodeUTF8(content);
    const crc = crc32(dataBytes);

    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const lhView = new DataView(localHeader);
    lhView.setUint32(0, LOCAL_FILE_HEADER_SIGNATURE, true);
    lhView.setUint16(4, 20, true);
    lhView.setUint16(6, 0, true);
    lhView.setUint16(8, 0, true);
    lhView.setUint16(10, 0, true);
    lhView.setUint16(12, 0, true);
    lhView.setUint32(14, crc, true);
    lhView.setUint32(18, dataBytes.length, true);
    lhView.setUint32(22, dataBytes.length, true);
    lhView.setUint16(26, nameBytes.length, true);
    lhView.setUint16(28, 0, true);
    new Uint8Array(localHeader).set(nameBytes, 30);

    localHeaders.push(new Uint8Array(localHeader), dataBytes);

    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const chView = new DataView(centralHeader);
    chView.setUint32(0, CENTRAL_DIR_SIGNATURE, true);
    chView.setUint16(4, 20, true);
    chView.setUint16(6, 20, true);
    chView.setUint16(8, 0, true);
    chView.setUint16(10, 0, true);
    chView.setUint16(12, 0, true);
    chView.setUint16(14, 0, true);
    chView.setUint32(16, crc, true);
    chView.setUint32(20, dataBytes.length, true);
    chView.setUint32(24, dataBytes.length, true);
    chView.setUint16(28, nameBytes.length, true);
    chView.setUint16(30, 0, true);
    chView.setUint16(32, 0, true);
    chView.setUint16(34, 0, true);
    chView.setUint16(36, 0, true);
    chView.setUint32(38, 0x20, true);
    chView.setUint32(42, offset, true);
    new Uint8Array(centralHeader).set(nameBytes, 46);

    centralHeaders.push(new Uint8Array(centralHeader));

    entries.push({ name, data: dataBytes, crc });
    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  const endRecord = new ArrayBuffer(22);
  const erView = new DataView(endRecord);
  erView.setUint32(0, END_OF_CENTRAL_DIR_SIGNATURE, true);
  erView.setUint16(4, 0, true);
  erView.setUint16(6, 0, true);
  erView.setUint16(8, entries.length, true);
  erView.setUint16(10, entries.length, true);
  erView.setUint32(12, centralDirSize, true);
  erView.setUint32(16, centralDirOffset, true);
  erView.setUint16(20, 0, true);

  const totalSize = offset + centralDirSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;

  for (const part of localHeaders) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralHeaders) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(new Uint8Array(endRecord), pos);

  return result;
}
