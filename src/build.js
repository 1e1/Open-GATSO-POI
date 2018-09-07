const LAUNCHER = require('./modules/Launcher.js');

const DEFAULTS = {
    sources: [ 'CNX_FUEL_FR', 'CNX_GATSO_EU', 'CNX_GATSO_FR' ],
    formats: [ 'csv', 'ov2', 'gpx' ],
};



(async () => {
    const arguments = process.argv.slice(2);
    const options = {
        sources: [],
        formats: [],
        isTruck: false,
    };

    for (let optionName in DEFAULTS) {
        const optionValues = DEFAULTS[optionName];

        if (Array.isArray(optionValues)) {
            options[optionName] = arguments.filter(argument => optionValues.includes(argument));

            if (0 === options[optionName].length) {
                options[optionName] = optionValues;
            }
        }
    }

    console.log(options);

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
