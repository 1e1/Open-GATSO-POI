const FS = require('fs');
const CSV = require('./Writer/Csv.js');
const OV2 = require('./Writer/Ov2.js');
const GPX = require('./Writer/Gpx.js');

module.exports = class Pointer {

    static from(filePath) {
        const pointer = new this();
        pointer.setFilePath(filePath);

        return pointer;
    }

    constructor() {
        this.filePath = '';
        this.writer = null;
        this.format = '';
    }

    setFilePath(filePath) {
        const p = filePath.lastIndexOf('.');
        
        this.format = filePath.substring(p+1).toLowerCase();
        this.filePath = filePath;

        return this;
    }

    open() {
        if (null === this.writer) {
            switch (this.format) {
                case 'csv':
                this.writer = new CSV();
                break;

                case 'ov2':
                this.writer = new OV2();
                break;

                case 'gpx':
                this.writer = new GPX();
                break;

                default:
                throw 'unkown writer for ' + this.format;
            }

            this.writer.open(this.filePath);
        }

        return this;
    }

    addPoint(point) {
        this.writer.addPoint(point);

        return this;
    }

    close() {
        if (null !== this.writer) {
            this.writer.close();
        }

        return this;
    }

    delete() {
        this.close();

        FS.unlinkSync(this.filePath);

        return this;
    }

    toString() {
        return this.format;
    }
}