const OS = require('os');
const CONFIG = require('./config.js');

const NB_PARALLEL_PROCESS_PER_CORE = 1;
const NB_PARALLEL_PROCESS = OS.cpus().length * NB_PARALLEL_PROCESS_PER_CORE;



module.exports = class Crawler {
    
    static from(storage) {
        const crawler = new this();

        crawler.storage = storage;

        return crawler;
    }

    constructor() {
        this.nbParallelProcess = NB_PARALLEL_PROCESS;
        
        this.storage = null;
    }

    getType(name) {
        if (undefined === CONFIG.types[name]) {
            throw "undefined CONFIG.types." + name;
        }

        return CONFIG.types[name];
    }

    getRule(name) {
        if (undefined === CONFIG.rules[name]) {
            throw "undefined CONFIG.rules." + name;
        }

        return CONFIG.rules[name];
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
    
    kill(err) {
        console.log(err);

        process.exit(1);
    }

    getCode() { throw "getCode() undefined" };
    
    async prepare() { throw "start() undefined" };
    async start() { throw "start() undefined" };
}