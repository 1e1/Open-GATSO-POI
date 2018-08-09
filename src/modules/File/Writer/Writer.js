const BOUND_FIRST_PREFIX = '⚑ ';
const BOUND_MIDDLE_PREFIX = '↕︎ ';
const BOUND_LAST_PREFIX = '⚐ ';

const FILE_ENCODING = 'utf8';


String.prototype.format = function(opts) { return this.replace(/\{([^\}]+)\}/g, (match, name) => opts[name]) }
String.prototype.escapeCsv = function() { return '"' + this.replace(/"/g,'\\"') + '"' }
String.prototype.escapeAttribute = function() { return '"' + this.replace(/"/g,'\\"') + '"' }
String.prototype.escapeXml = function() { return '<![CDATA[' + this.replace(/"/g,'\\"') + ']]>' }

const FS = require('fs');

module.exports = class Writer {

    static from(filePath) {
        const writer = new this();

        writer.open(filePath);

        return writer;
    }

    constructor() {
        this.header = new Buffer.alloc(0);
        this.footer = new Buffer.alloc(0);
        this.fs = null;
        this.fileEncoding = FILE_ENCODING;
    }

    open(filePath) {
        if (null === this.fs) {
            this.fs = FS.openSync(filePath, 'as');
            
            this.setHeader();

            FS.writeSync(this.fs, this.header);
        }

        return this;
    }

    addPoint(point) {
        const buffer = this.convertToBuffer(point);

        FS.writeSync(this.fs, buffer);
    }

    close() {
        if (null !== this.fs) {
            this.setFooter();

            FS.writeSync(this.fs, this.footer);
            FS.closeSync(this.fs);

            this.fs = null;
        }

        return this;
    }

    setHeader() {}

    setFooter() {}

    convertToBuffer(point) {
        throw "undefined setPoint()";
    }
}