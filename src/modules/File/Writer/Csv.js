const WRITER = require('./Writer.js');

module.exports = class Csv extends WRITER {

    convertToBuffer(point) {
        const geoJsonLength = point.geoJson.length;
        
        let lines = [];
    
        for (let i = 0; i < geoJsonLength; ++i) {
            const lng_lat = point.geoJson[i];
            const title = point.type;
        
            let extra = ' ';
    
            if (geoJsonLength > 1) {
                switch (i) {
                    case 0: 
                    extra += BOUND_FIRST_PREFIX;
                    break;
    
                    case geoJsonLength -1:
                    extra += BOUND_LAST_PREFIX;
                    break;
    
                    default:
                    extra += BOUND_MIDDLE_PREFIX;
                }
            }
    
            if (point.rule) { 
                extra += point.rule;
            }
    
            const data = {
                longitude: lng_lat[0],
                latitude: lng_lat[1],
                name: (title + extra.trim()).escapeCsv(),
                comment: point.description.escapeCsv(),
            };
         
            const line = Object.values(data).join(',');
    
            lines.push(line + "\n");
        }
    
        return Buffer.from(lines.join(''), this.fileEncoding);
    }

}