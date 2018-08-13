String.prototype.format = function(opts) { return this.replace(/\{([^\}]+)\}/g, (match, name) => opts[name]) }
Array.prototype.concatInside = function() { return [].concat.apply([], this); }
Array.prototype.unique = function() {
    return this.filter(function (value, index, self) { 
        return self.indexOf(value) === index;
    });
}



const PATH = require('path');
const FS = require('fs');
const CONFIG = require('./config.js');
const FILE_LIST = require('./File/FileList.js');

const OUTPUT_DIR = './BUILD';
const ICON_DIR = './src/assets/icn';

const POI_NAME_PREFIX = '|';
const POI_NAME_INFO_PREFIX = '| ';
const POI_NAME_INFO_SEPARATOR = ' ';
const MANIFEST_PATH = PATH.resolve(__dirname, '../..', OUTPUT_DIR, 'manifest.txt');
const VERSION_PATH = PATH.resolve(__dirname, '../..', OUTPUT_DIR, 'version.txt');
const OUTPUT_PATH = PATH.resolve(__dirname, '../..', OUTPUT_DIR);
const ICON_PATH = PATH.resolve(__dirname, '../..', ICON_DIR);

const BASENAMES_LIST = [Object.values(CONFIG.rules), Object.values(CONFIG.services)].concatInside().map(rule => rule.basenames);
const BASENAMES = BASENAMES_LIST.concatInside().unique();



FS.mkdirRecursiveSync = function(path) {
    const paths = path.split('/');
    let fullPath = '';

    paths.forEach((filename) => {
        fullPath += filename + '/';

        if (! FS.existsSync(fullPath)) {
            FS.mkdirSync(fullPath);
        }
    });
};

FS.rmdirRecursiveSync = function(dir) {
    const list = FS.readdirSync(dir);
    
    for(let i = 0; i < list.length; i++) {
        const filename = PATH.join(dir, list[i]);
        const stat = FS.statSync(filename);

        if('.' !== filename && '..' !== filename) {
            if(stat.isDirectory()) {
                FS.rmdirRecursiveSync(filename);
            } else {
                FS.unlinkSync(filename);
            }
        }
    }
    
    FS.rmdirSync(dir);
};



module.exports = class Launcher {
    
    static from(options) {
        const launcher = new this();

        launcher.options = options;

        return launcher;
    }

    constructor() {
        this.crawlers = [];
        this.options = {};
        
        this.storage = FILE_LIST.from(OUTPUT_PATH, BASENAMES);
    }

    prepare() {
        this.resetDirectory(OUTPUT_PATH);
        
        this.options.sources.forEach(source => {
            const launcher = require(`./${source}.js`);
            const crawler = launcher.from(this.storage);

            crawler.options = this.options;

            this.crawlers.push(crawler);
        });

        return this;
    }

    async runParallel() {
        const crawlerPromises = [];
        const sources = this.crawlers.map(crawler => crawler.getCode());

        this.storage.open(sources, this.options.formats);
        
        this.crawlers.forEach(crawler => {
            const crawlerPromise = crawler.run();

            crawlerPromise.catch(err => crawler.kill(err));
            crawlerPromises.push(crawlerPromise);
        });
        
        await Promise.all(crawlerPromises);
        
        this.storage.close();

        return this;
    }

    async runSingle() {
        const sources = this.crawlers.map(crawler => crawler.getCode());

        this.storage.open(sources, this.options.formats);
        
        for (const crawler of this.crawlers) {
            await crawler.run();
        }
        
        this.storage.close();

        return this;
    }

    package() {
        const mypoisConfiguration = this.getMypoisConfiguration();
        const timestampMax = this.storage.timestampMax;
        
        this.copyAssets();
        this.generateVersion(timestampMax);
        this.generateManifest(mypoisConfiguration);

        return this;
    }
    
    resetDirectory(dir) {
        if (FS.existsSync(dir)) {
            FS.rmdirRecursiveSync(dir);
        }
    
        FS.mkdirRecursiveSync(dir);
    }

    copyAssets() {
        const basenames = this.storage.getSizedBasenames();

        basenames.forEach(basename => {
            const filename = basename + '.bmp';
            const fromBmpPath = ICON_PATH + '/' + filename;
            const toBmpPath = OUTPUT_PATH + '/' + filename;
        
            FS.copyFileSync(fromBmpPath, toBmpPath);
        });
    }

    getMypoisConfiguration() {
        const lines = [];
        const basenames = this.storage.getSizedBasenames();

        basenames.forEach(basename => {
            const file = this.storage.fileList[basename];
            let cleanFilename = basename
                .replace('GATSO_', '')
                .replace('_0', '')
                .replace('FUEL_', '')
                ;

            const countries = file.countries.sort();
            const counter = file.size;
            const timestamp = file.timestampMax;
            const date = new Date(timestamp * 1000);
            const datetimeISO = date.toISOString();
            const dateISO = datetimeISO.substring(0, 10);

            if ('ALL' === cleanFilename) {
                cleanFilename = basename.split('_', 2).join(' ');
            }
            
            const name = POI_NAME_PREFIX + cleanFilename + POI_NAME_INFO_PREFIX + countries.join(POI_NAME_INFO_SEPARATOR);
            const line = [basename, dateISO, counter, name].join('/');

            lines.push(line);
        });

        return lines.join("\n");
    }

    generateVersion(timestampMax) {
        const fs = FS.openSync(VERSION_PATH, 'a');

        FS.writeSync(fs, timestampMax + "\n");
        FS.closeSync(fs);
    }

    generateManifest(content) {
        const fs = FS.openSync(MANIFEST_PATH, 'a');

        FS.writeSync(fs, content + "\n");
        FS.closeSync(fs);
    }
}