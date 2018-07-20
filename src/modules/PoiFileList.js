const FILE = require('./PoiFile.js');

module.exports = class PoiFileList {

    constructor(directory, basenames) {
        this.files = {};

        basenames.forEach(basename => {
            if (undefined === this.files[basename]) {
                const file = new FILE(directory, basename);

                this.files[basename] = file;
            }
        });
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