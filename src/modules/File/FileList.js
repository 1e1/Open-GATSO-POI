const FILE = require('./File.js');

module.exports = class FileList {

    static from(directory, basenames) {
        const files = new this();

        files.setBasenames(basenames, directory);

        return files;
    }

    constructor() {
        this.files = {};
    }

    setBasenames(basenames, directory) {
        basenames.forEach(basename => {
            if (undefined === this.files[basename]) {
                const file = FILE.from(directory, basename);

                this.files[basename] = file;
            }
        });

        return this;
    }

    listen(formats) {
        Object.values(this.files).forEach(file => {
            file
                .setFormats(formats)
                .open()
                ;
        });

        return this;
    }

    addPoint(point, basenames) {
        basenames.forEach(basename => {
            this.files[basename].addPoint(point);
        });
    }

    package() {
        let timestampMax = 0;

        for (let basename in this.files) {
            const file = this.files[basename];

            file.close();

            timestampMax = Math.max(timestampMax, file.timestampMax);

            if (0 === file.getSize()) {
                file.delete();

                delete this.files[basename];
            }

            console.log(file.toString());
        }

        return timestampMax;
    }

    getBasenames() {
        const basenames = Object.keys(this.files);

        return basenames;
    }

    toString() {
        return Object.values(this.files).join("\n");
    }

}