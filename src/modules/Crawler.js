const REF_TYPES = { 
    traffic_light: { label: 'Feux rouges', type: 'stop', display: 'stop' },
    instant_speed: { label: 'Fixes', type: 'fixed', display: 'max' },
    multi_instant_speed: { label: 'Discriminants', type: 'fixed+', display: 'max' },
    railroad: { label: 'Passages à niveau', type: 'stop', display: 'stop' },
    average_speed: { label: 'Vitesse Moyenne', type: 'average', display: 'average' },
    route: { label: 'Itinéraires', type: 'fixed?', display: 'max' }, 
};

const REF_RULES = { 
    car30: { label: 'Vitesse VL 30', type: 'speed', alert: 30, filter: true, basename: 'GATSO_30' },
    car50: { label: 'Vitesse VL 50', type: 'speed', alert: 50, filter: true, basename: 'GATSO_50' },
    car70: { label: 'Vitesse VL 70', type: 'speed', alert: 70, filter: true, basename: 'GATSO_70' },
    car80: { label: 'Vitesse VL 80', type: 'speed', alert: 80, filter: true, basename: 'GATSO_80' },
    car90: { label: 'Vitesse VL 90', type: 'speed', alert: 90, filter: true, basename: 'GATSO_90' },
    car110: { label: 'Vitesse VL 110', type: 'speed', alert: 110, filter: true, basename: 'GATSO_110' },
    car130: { label: 'Vitesse VL 130', type: 'speed', alert: 130, filter: true, basename: 'GATSO_130' },
    truck50: { label: 'Vitesse PL 50', type: 'speed', alert: 50, filter: false, basename: 'GATSO_50' },
    truck70: { label: 'Vitesse PL 70', type: 'speed', alert: 70, filter: false, basename: 'GATSO_70'  },
    truck80: { label: 'Vitesse PL 80', type: 'speed', alert: 80, filter: false, basename: 'GATSO_80'  },
    truck90: { label: 'Vitesse PL 90', type: 'speed', alert: 90, filter: false, basename: 'GATSO_90'  },
    traffic_light: { label: 'Franchissement de feux', type: 'traffic_light', alert: null, filter: true, basename: 'GATSO_stop'  },
    railroad: { label: 'Franchissement de voie ferrée', type: 'railway', alert: null, filter: true, basename: 'GATSO_rail'  },
 };



const PATH = require('path');
const FS = require('fs');
const OS = require('os');

const FILES = require('./File/FileList');

const NB_PARALLEL_PROCESS_PER_CORE = 1;
const NB_PARALLEL_PROCESS = OS.cpus().length * NB_PARALLEL_PROCESS_PER_CORE;

const MANIFEST_FILE = './SD_CARD/manifest.txt';
const OUTPUT_DIR = './SD_CARD';
const ASSET_DIR = './src/assets';

const MANIFEST_PATH = PATH.resolve(__dirname, '../..', MANIFEST_FILE);
const OUTPUT_PATH = PATH.resolve(__dirname, '../..', OUTPUT_DIR);
const ASSET_PATH = PATH.resolve(__dirname, '../..', ASSET_DIR);




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



String.prototype.format = function(opts) { return this.replace(/\{([^\}]+)\}/g, (match, name) => opts[name]) }



module.exports = class Crawler {

    static from(formats) {
        const crawler = new this();

        crawler.formats = formats;

        return crawler;
    }

    constructor() {
        const basenames = Object.values(REF_RULES).map(rule => rule.basename);

        this.nbParallelProcess = NB_PARALLEL_PROCESS;
        this.manifestPath = MANIFEST_PATH;
        this.outputPath = OUTPUT_PATH + '/' + this.getCode();
        this.assetPath = ASSET_PATH;

        this.isTruck = false;
        this.formats = [];
        
        this.files = FILES.from(this.outputPath, basenames);
    }

    setOptions(options) {
        if (undefined !== options.isTruck) {
            this.isTruck = !!options.isTruck;
        }
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

    resetDirectory() {
        if (FS.existsSync(this.outputPath)) {
            rmdirRecursiveSync(this.outputPath);
        }
    
        mkdirRecursiveSync(this.outputPath);
    }

    generateManifest(timestampMax) {
        const fs = FS.openSync(this.manifestPath, 'a');

        FS.writeSync(fs, timestampMax + "\n");
        FS.closeSync(fs);
    
        return timestampMax;
    }

    copyAssets() {
        const basenames = this.files.getBasenames();

        basenames.forEach(basename => {
            const filename = basename + '.bmp';
            const fromBmpPath = this.assetPath + '/' + filename;
            const toBmpPath = this.outputPath + '/' + filename;
        
            FS.copyFileSync(fromBmpPath, toBmpPath);
        });
    }

    async run() {
        const mainPromise = this.getMainPromise();

        this.resetDirectory(); 
        this.files.listen(this.formats);

        await mainPromise;

        const timestampMax = this.files.package();

        this.copyAssets();
        this.generateManifest(timestampMax);
        
        return timestampMax;
    }

    getCode() { throw "getCode() undefined" };
    getMainPromise() { throw "getMainPromise() undefined" };
}