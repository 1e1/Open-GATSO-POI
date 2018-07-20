(async function() {

    const countries = [
        require('./modules/LauncherFr.js'),
    ];

    countries.forEach(async country => {
        const launcher = new country();
        console.log(launcher.getCode() + ' is running');

        await launcher.run();

        console.log(launcher.getCode() + ' terminated');
        console.log();
    });

})();

