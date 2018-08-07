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
        this.countries = [];
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

    getCountries() {
        return this.countries;
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
        this.addCountry(point.country);

        return this;
    }

    addCountry(country) {
        if (!this.countries.includes(country)) {
            this.countries.push(country);
        }

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
        const countries = this.countries.join(',');
        
        return this.filename + '[' + formats + '][' + countries + '] x' + this.size + ' ' + this.timestampMax;
    }

}