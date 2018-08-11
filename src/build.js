const LAUNCHER = require('./modules/Launcher.js');

const SOURCES = [ 'FR', 'EU' ];
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

    const launcher = LAUNCHER.from(options);

    launcher.prepare();

    await launcher.runSingle();

    launcher.package();
})();
