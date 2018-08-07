(async function() {

    const COUNTRIES = [ 'FR', 'EU' ];
    const FORMATS = [ 'csv', 'ov2', 'gpx' ];

    let formats = process.argv.slice(2);
    if (0 === formats.length) {
        formats = FORMATS;
    } else {
        formats = formats.filter(format => FORMATS.includes(format));
    }

    COUNTRIES.forEach(async country => {
        const launcher = require('./modules/' + country + '.js');
        const crawler = launcher.from(formats);
        
        console.log(crawler.getCode() + ' is running');

        await crawler.run();

        console.log(crawler.getCode() + ' terminated');
        console.log();
    });

})();

