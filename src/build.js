const CRAWLER = require('./modules/Crawler.js');

const COUNTRIES = [ 'FR', 'EU' ];
const FORMATS = [ 'csv', 'ov2', 'gpx' ];


(async () => {
    const formats = process.argv.slice(2);
    const options = {
        countries: COUNTRIES,
        formats: [],
        isTruck: false,
    };

    if (0 === formats.length) {
        options.formats = FORMATS;
    } else {
        options.formats = formats.filter(format => FORMATS.includes(format));
    }

    await CRAWLER.from(options);
})();

