const POINTER = require('./Pointer.js');

module.exports = class File {

    static from(directory, basename) {
        const file = new this();

        file.filePath = directory + '/' + basename;
        
        return file;
    }

    constructor() {
        this.filePath = '';

        this.pointers = [];
        this.size = 0;
        this.timestampMax = 0;
    }

    setFormats(formats) {
        formats.forEach(format => {
            this.addFormat(format);
        });

        return this;
    }

    addFormat(format) {
        const filePath = this.getFullFilePath(format);
        const pointer = POINTER.from(filePath);

        this.pointers.push(pointer);

        return this;
    }

    getFilePath() {
        return this.filePath;
    }

    getSize() {
        return this.size;
    }

    getFullFilePath(format) {
        return this.filePath + '.' + format;
    }

    open() {
        this.pointers.forEach(pointer => {
            pointer.open();
        });

        return this;
    }

    addPoint(point) {
        this.pointers.forEach(pointer => {
            pointer.addPoint(point);
        });

        this.size++;
        this.timestampMax = Math.max(this.timestampMax, point.lastUpdateTimestamp);

        return this;
    }

    close() {
        this.pointers.forEach(pointer => {
            pointer.close();
        });

        return this;
    }

    delete() {
        this.pointers.forEach(pointer => {
            pointer.delete();
        });

        this.pointers = [];

        return this;
    }

    toString() {
        const formats = this.pointers.map(p=>p.toString()).join(',');
        
        return this.filePath + '[' + formats + '] x' + this.size + ' ' + this.timestampMax;
    }

}