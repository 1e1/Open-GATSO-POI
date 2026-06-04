const WRITER = require('./Writer.js');

// Format OV2 (TomTom) : enregistrement "Extended" type 0x02
//   [1] type (0x02) | [4] longueur totale (LE) | [4] lon (LE) | [4] lat (LE) | [n] titre | [1] 0x00
// La longueur totale vaut donc (octets du titre) + 14.
const HEADER_BYTES = 1 + 4 + 4 + 4; // type + longueur + lon + lat
const FOOTER_BYTES = 1;             // octet nul de fin
const OVERHEAD_BYTES = HEADER_BYTES + FOOTER_BYTES;

module.exports = class Ov2 extends WRITER {

    convertToBuffer(point) {
        const ruleSuffix = point.rule ? ' ' + point.rule : '';
        const baseName = (point.type + ruleSuffix).trim();

        const buffers = point.getRenderPoints().map(rp => {
            const title = (baseName + rp.suffix).trim();
            // Dimensionnement en OCTETS (et non en code units JS) pour ne pas
            // tronquer/corrompre les titres contenant des caractères multi-octets.
            const titleBytes = Buffer.byteLength(title, 'utf8');
            const trameLength = titleBytes + OVERHEAD_BYTES;
            const buffer = Buffer.alloc(trameLength);

            let offset = 0;

            buffer.writeUInt8(0x02, offset);
            offset += 1;
            buffer.writeUInt32LE(trameLength, offset);
            offset += 4;
            buffer.writeInt32LE(Math.round(rp.longitude * 100000), offset);
            offset += 4;
            buffer.writeInt32LE(Math.round(rp.latitude * 100000), offset);
            offset += 4;
            buffer.write(title, offset, titleBytes, 'utf8');
            offset += titleBytes;
            buffer.writeUInt8(0x00, offset);

            return buffer;
        });

        return Buffer.concat(buffers);
    }
}
