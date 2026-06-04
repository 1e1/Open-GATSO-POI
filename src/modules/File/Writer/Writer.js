const FILE_ENCODING = 'utf8';

const FS = require('fs');

module.exports = class Writer {

    static from(filePath) {
        const p = filePath.lastIndexOf('.');
        const format = filePath.substring(p+1).toLowerCase();

        let writer;

        switch (format) {
            case 'csv':
            const CSV = require('./Csv.js');
            writer = new CSV();
            break;

            case 'log':
            const LOG = require('./Log.js');
            writer = new LOG();
            break;

            case 'ov2':
            const OV2 = require('./Ov2.js');
            writer = new OV2();
            break;

            case 'gpx':
            const GPX = require('./Gpx.js');
            writer = new GPX();
            break;

            default:
            throw `unkown writer for ${format}: ${filePath}`;
        }

        writer.filePath = filePath;

        return writer;
    }

    constructor() {
        this.filePath = '';
        this.fs = null;
        this.header = Buffer.alloc(0);
        this.footer = Buffer.alloc(0);
        this.fileEncoding = FILE_ENCODING;
    }

    open() {
        if (null === this.fs) {
            this.fs = FS.openSync(this.filePath, 'as');
        }

        return this;
    }

    addHeader() {
        this.setHeader();

        FS.writeSync(this.fs, this.header);

        return this;
    }

    addPoint(point) {
        const buffer = this.convertToBuffer(point);

        FS.writeSync(this.fs, buffer);

        return this;
    }

    addFooter() {
        this.setFooter();

        FS.writeSync(this.fs, this.footer);

        return this;
    }

    close() {
        if (null !== this.fs) {
            FS.closeSync(this.fs);

            this.fs = null;
        }

        return this;
    }

    delete() {
        this.close();

        if (FS.existsSync(this.filePath)) {
            FS.unlinkSync(this.filePath);
        }

        return this;
    }

    setHeader() { return this; }
    setFooter() { return this; }

    convertToBuffer(point) {
        throw "undefined convertToBuffer()";
    }
}
