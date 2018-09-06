const LAUNCHER = require('./modules/Launcher.js');

const SOURCES = [ 'CNX_FUEL_FR', 'CNX_GATSO_EU', 'CNX_GATSO_FR' ];
const FORMATS = [ 'csv', 'ov2', 'gpx' ];


(async () => {
    const formats = process.argv.slice(2);
    const options = {
        sources: SOURCES,
        formats: [],
        isTruck: false,
    };

    if (0 === formats.length) {
        options.formats = FORMATS;
    } else {
        options.formats = formats.filter(format => FORMATS.includes(format));
    }

    try {
        const launcher = LAUNCHER.from(options);

        launcher.prepare();

        await launcher.runSingle();

        launcher.package();
    } catch (err) {
        console.log('~~~~~~~~~');
        console.log(err);

        process.exit(1);
    }

    console.log("done");
 })();
