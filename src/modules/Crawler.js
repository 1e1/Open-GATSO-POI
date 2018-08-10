const REF_TYPES = { 
    traffic_light: { label: 'Feux rouges', type: 'stop', display: 'stop' },
    instant_speed: { label: 'Fixes', type: 'fixed', display: 'max' },
    multi_instant_speed: { label: 'Discriminants', type: 'fixed+', display: 'max' },
    railroad: { label: 'Passages à niveau', type: 'stop', display: 'stop' },
    average_speed: { label: 'Vitesse Moyenne', type: 'average', display: 'average' },
    route: { label: 'Itinéraires', type: 'fixed?', display: 'max' }, 
    tunnel: { label: 'Tunnel', type: 'average', display: 'tunnel' }, 
};

const REF_RULES = { 
    car30: { label: 'Vitesse VL 30', type: 'speed', alert: 30, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_30' ] },
    car40: { label: 'Vitesse VL 40', type: 'speed', alert: 50, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_40' ] },
    car50: { label: 'Vitesse VL 50', type: 'speed', alert: 50, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_50' ] },
    car60: { label: 'Vitesse VL 60', type: 'speed', alert: 70, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_60' ] },
    car70: { label: 'Vitesse VL 70', type: 'speed', alert: 70, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_70' ] },
    car80: { label: 'Vitesse VL 80', type: 'speed', alert: 80, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_80' ] },
    car90: { label: 'Vitesse VL 90', type: 'speed', alert: 90, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_90' ] },
    car100: { label: 'Vitesse VL 100', type: 'speed', alert: 100, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_100' ] },
    car110: { label: 'Vitesse VL 110', type: 'speed', alert: 110, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_110' ] },
    car120: { label: 'Vitesse VL 120', type: 'speed', alert: 120, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_120' ] },
    car130: { label: 'Vitesse VL 130', type: 'speed', alert: 130, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_130' ] },
    truck50: { label: 'Vitesse PL 50', type: 'speed', alert: 50, filter: false, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_50' ] },
    truck70: { label: 'Vitesse PL 70', type: 'speed', alert: 70, filter: false, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_70' ] },
    truck80: { label: 'Vitesse PL 80', type: 'speed', alert: 80, filter: false, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_80' ] },
    truck90: { label: 'Vitesse PL 90', type: 'speed', alert: 90, filter: false, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_90' ] },
    traffic_light: { label: 'Franchissement de feux', type: 'redlight', alert: null, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_stop_0', 'GATSO_redlight_0' ] },
    railroad: { label: 'Franchissement de voie ferrée', type: 'redlight', alert: null, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_stop_0', 'GATSO_railway_0' ] },
    tunnel: { label: 'Franchissement de tunnel', type: 'unknown', alert: null, filter: true, basenames: [ 'GATSO_ALL', 'GATSO_speed_0', 'GATSO_tunnel_0' ] },
};



String.prototype.format = function(opts) { return this.replace(/\{([^\}]+)\}/g, (match, name) => opts[name]) }
Array.prototype.concatInside = function() { return [].concat.apply([], this); }
Array.prototype.unique = function() {
    return this.filter(function (value, index, self) { 
        return self.indexOf(value) === index;
    });
}



const PATH = require('path');
const FS = require('fs');
const OS = require('os');
const FILE_LIST = require('./File/FileList');

const NB_PARALLEL_PROCESS_PER_CORE = 1;
const NB_PARALLEL_PROCESS = OS.cpus().length * NB_PARALLEL_PROCESS_PER_CORE;

const OUTPUT_DIR = './BUILD';
const ICON_DIR = './src/assets/icn';

const POI_NAME_PREFIX = '|';
const POI_NAME_INFO_PREFIX = '| ';
const POI_NAME_INFO_SEPARATOR = ' ';
const MANIFEST_PATH = PATH.resolve(__dirname, '../..', OUTPUT_DIR, 'manifest.txt');
const VERSION_PATH = PATH.resolve(__dirname, '../..', OUTPUT_DIR, 'version.txt');
const OUTPUT_PATH = PATH.resolve(__dirname, '../..', OUTPUT_DIR);
const ICON_PATH = PATH.resolve(__dirname, '../..', ICON_DIR);

const BASENAMES_LIST = Object.values(REF_RULES).map(rule => rule.basenames);
const BASENAMES = BASENAMES_LIST.concatInside().unique();
const FILES = FILE_LIST.from(OUTPUT_PATH, BASENAMES);




function mkdirRecursiveSync(path) {
    const paths = path.split('/');
    let fullPath = '';

    paths.forEach((filename) => {
        fullPath += filename + '/';

        if (! FS.existsSync(fullPath)) {
            FS.mkdirSync(fullPath);
        }
    });
};

function rmdirRecursiveSync(dir) {
    const list = FS.readdirSync(dir);
    
    for(let i = 0; i < list.length; i++) {
        const filename = PATH.join(dir, list[i]);
        const stat = FS.statSync(filename);

        if('.' !== filename && '..' !== filename) {
            if(stat.isDirectory()) {
                rmdirRecursiveSync(filename);
            } else {
                FS.unlinkSync(filename);
            }
        }
    }
    
    FS.rmdirSync(dir);
};

function resetDirectory(dir) {
    if (FS.existsSync(dir)) {
        rmdirRecursiveSync(dir);
    }

    mkdirRecursiveSync(dir);
}



module.exports = class Crawler {
    
    static async from(options) {
        const crawlerPromises = [];

        resetDirectory(OUTPUT_PATH);
        FILES.listen(options.formats);
        
        options.countries.forEach(async country => {
            const launcher = require(`./${country}.js`);
            const crawler = new launcher();

            crawler.options = options;

            const crawlerPromise = crawler.run();

            crawlerPromise.catch(err => crawler.kill(err));
            crawlerPromises.push(crawlerPromise);
        });

        await Promise.all(crawlerPromises);

        const mypoisConfiguration = this.getMypoisConfiguration();
        const timestampMax = FILES.package();

        this.copyAssets();
        this.generateVersion(timestampMax);
        this.generateManifest(mypoisConfiguration);
    }

    static copyAssets() {
        const basenames = FILES.getBasenames();

        basenames.forEach(basename => {
            const filename = basename + '.bmp';
            const fromBmpPath = ICON_PATH + '/' + filename;
            const toBmpPath = OUTPUT_PATH + '/' + filename;
        
            FS.copyFileSync(fromBmpPath, toBmpPath);
        });
    }

    static getMypoisConfiguration() {
        const lines = [];
        const files = Object.values(FILES.files);

        files.forEach(file => {
            if (file.size) {
                const filename = PATH.basename(file.filePath);
                const cleanFilename = filename.replace('GATSO_', '').replace('_0', '');
                const countries = file.countries.sort();
                const counter = file.size;

                const name = POI_NAME_PREFIX + cleanFilename + POI_NAME_INFO_PREFIX + countries.join(POI_NAME_INFO_SEPARATOR);
                const line = [filename, counter, name].join('/');

                lines.push(line);
            }
        });

        return lines.join("\n");
    }

    static generateVersion(timestampMax) {
        const fs = FS.openSync(VERSION_PATH, 'a');

        FS.writeSync(fs, timestampMax + "\n");
        FS.closeSync(fs);
    }

    static generateManifest(content) {
        const fs = FS.openSync(MANIFEST_PATH, 'a');

        FS.writeSync(fs, content + "\n");
        FS.closeSync(fs);
    }

    constructor() {
        this.nbParallelProcess = NB_PARALLEL_PROCESS;
        this.options = {};
        
        this.fileList = FILES;
    }

    getType(name) {
        if (undefined === REF_TYPES[name]) {
            throw "undefined REF_TYPES." + name;
        }

        return REF_TYPES[name];
    }

    getRule(name) {
        if (undefined === REF_RULES[name]) {
            throw "undefined REF_RULES." + name;
        }

        return REF_RULES[name];
    }

    displayTypesToString(displayTypes) {
        return displayTypes.join(' ');
    }

    displayRulesToString(displayRules) {
        if (0 === displayRules.length) {
            return '';
        }

        const min = displayRules.reduce((min,val) => Math.min(min,val));

        return '' + min;
    }

    async run() {
        await this.prepare();
        await this.start();
    }

    async sleep(ms) {
        const sleepPromise = new Promise((resolve, reject) => {
            setTimeout(resolve, ms);
        });

        await sleepPromise;
    }
    
    kill(err) {
        console.log(err);

        process.exit(1);
    }

    getCode() { throw "getCode() undefined" };
    
    async prepare() { throw "start() undefined" };
    async start() { throw "start() undefined" };
}