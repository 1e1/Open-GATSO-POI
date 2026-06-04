const WRITER = require('./Writer.js');
const { format, escapeXml } = require('../../utils.js');

module.exports = class Gpx extends WRITER {

    setHeader() {
        const header = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>' + "\n"
            + '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">'
            ;

        this.header = Buffer.from(header, this.fileEncoding);

        return this;
    }

    setFooter() {
        const footer = '</gpx>';

        this.footer = Buffer.from(footer, this.fileEncoding);

        return this;
    }

    convertToBuffer(point) {
        // Uniquement des waypoints (<wpt>) : garmin_gpi ignore les <trk>, et le MIB
        // n'importe que des points. Les tronçons sont rendus en 2 waypoints (début/fin)
        // via POI.getRenderPoints().
        const ruleSuffix = point.rule ? (isNaN(point.rule) ? '#' : '@' + point.rule) : '';
        const name = (point.type + ruleSuffix).trim();

        const lines = point.getRenderPoints().map(rp => {
            const description = (point.description + rp.suffix).trim();

            return format('<wpt lon="{lon}" lat="{lat}"><name>{name}</name><desc>{desc}</desc></wpt>', {
                lon: rp.longitude,
                lat: rp.latitude,
                name: escapeXml(name),
                desc: escapeXml(description),
            });
        });

        return Buffer.from(lines.join(''), this.fileEncoding);
    }
}
