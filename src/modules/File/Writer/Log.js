const WRITER = require('./Writer.js');
const { escapeCsv } = require('../../utils.js');

module.exports = class Log extends WRITER {

    convertToBuffer(point) {
        const ruleSuffix = point.rule ? ' ' + point.rule : '';
        const name = (point.type + ruleSuffix).trim();

        const lines = point.getRenderPoints().map(rp => {
            const description = (point.description + rp.suffix).trim();

            return [
                rp.longitude,
                rp.latitude,
                escapeCsv(name),
                escapeCsv(description),
            ].join(',') + "\n";
        });

        return Buffer.from(lines.join(''), this.fileEncoding);
    }
}
