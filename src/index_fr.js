const BASE_URL = 'https://radars.securite-routiere.gouv.fr';
const LIST_PATH = '/radars/all?_format=json';
const INFO_PATH = '/radars/{id}?_format=json';

const OUTPUT_DIR = './SD_CARD/FR';
const ASSET_DIR = './src/assets';

const BOUND_FIRST_PREFIX = '⚑ ';
const BOUND_MIDDLE_PREFIX = '↕︎ ';
const BOUND_LAST_PREFIX = '⚐ ';

const REF_TYPES = { 
    '1': { label: 'Feux rouges', type: 'stop', display: 'stop' },
    '2': { label: 'Fixes', type: 'fixed', display: 'max' },
    '3': { label: 'Discriminants', type: 'fixed+', display: 'max' },
    '16': { label: 'Passages à niveau', type: 'stop', display: 'stop' },
    '18': { label: 'Vitesse Moyenne', type: 'average', display: 'average' },
    '19': { label: 'Itinéraires', type: 'fixed?', display: 'max' }, 
};

const REF_RULES = { 
    '4': { label: 'Vitesse VL 30', type: 'speed', alert: 30, filter: true, filename: 'GATSO_30.csv' },
    '5': { label: 'Vitesse VL 50', type: 'speed', alert: 50, filter: true, filename: 'GATSO_50.csv' },
    '6': { label: 'Vitesse VL 70', type: 'speed', alert: 70, filter: true, filename: 'GATSO_70.csv' },
    '7': { label: 'Vitesse VL 80', type: 'speed', alert: 80, filter: true, filename: 'GATSO_80.csv' },
    '8': { label: 'Vitesse VL 90', type: 'speed', alert: 90, filter: true, filename: 'GATSO_90.csv' },
    '9': { label: 'Vitesse VL 110', type: 'speed', alert: 110, filter: true, filename: 'GATSO_110.csv' },
    '10': { label: 'Vitesse VL 130', type: 'speed', alert: 130, filter: true, filename: 'GATSO_130.csv' },
    '11': { label: 'Vitesse PL 50', type: 'speed', alert: 50, filter: false, filename: 'GATSO_50.csv' },
    '12': { label: 'Vitesse PL 70', type: 'speed', alert: 70, filter: false, filename: 'GATSO_70.csv'  },
    '13': { label: 'Vitesse PL 80', type: 'speed', alert: 80, filter: false, filename: 'GATSO_80.csv'  },
    '14': { label: 'Vitesse PL 90', type: 'speed', alert: 90, filter: false, filename: 'GATSO_90.csv'  },
    '15': { label: 'Franchissement de feux', type: 'traffic_light', alert: null, filter: true, filename: 'GATSO_red.csv'  },
    '17': { label: 'Franchissement de voie ferrée', type: 'railway', alert: null, filter: true, filename: 'GATSO_rail.csv'  },
 };


/* --------------------------------------------------------------------------
 * 
 * CUSTOM PARSER SPECIFIC TO THE TARGET
 *
 * -------------------------------------------------------------------------- */

function parseList(gatsoList) {
    const ids = [];
    gatsoList.forEach(item => {
        const entry = { id: item.id };
        if (item.geoJson) {
            entry.geoJson = item.geoJson;
        } else {
            entry.geoJson = [[ item.lng, item.lat ]];
        }

        ids.push(entry);
    });

    return ids;
}

function parseInfo(gatso, entry) {
    const points = [];
    const files = [];

    const displayTypes = [];
    gatso.radarType.forEach(type => {
        const info = REF_TYPES[type.tid];

        if (! info) {
            console.log("--- ERROR TYPE ---");
            console.log(gatso);
            console.log("------------------");
        }

        if (!displayTypes.includes(info.display)) {
            displayTypes.push(info.display);
        }
    });

    const displayRules = [];
    gatso.rulesMesured.forEach(rule => {
        const info = REF_RULES[rule.tid];

        if (! info) {
            console.log("--- ERROR RULE ---");
            console.log(gatso);
            console.log("------------------");
        }

        if (info.filter) {
            if (null !== info.alert && !displayRules.includes(info.alert)) {
                displayRules.push(info.alert);
            }
            files.push(info.fs);
        }
    });

    const displayType = displayTypes.join(' ');
    const displayRule = displayRules.length ? '@' + displayRules.reduce((min,val) => Math.min(min,val)) : '';

    const title = '"' + (displayType + displayRule).trim().replace(/"/g,'\\"') + '"';
    const description = '"' + (gatso.radarDirection + ' ' + gatso.radarRoad).trim().replace(/"/g,'\\"') + '"';

    const geoJsonLength = entry.geoJson.length;
    for (let i = 0; i < geoJsonLength; ++i) {
        const lng_lat = entry.geoJson[i];

        let titleWithBounds = title;

        if (geoJsonLength > 1) {
            switch (i) {
                case 0: 
                titleWithBounds = BOUND_FIRST_PREFIX + titleWithBounds;
                break;

                case geoJsonLength -1:
                titleWithBounds = BOUND_LAST_PREFIX + titleWithBounds;
                break;

                default:
                titleWithBounds = BOUND_MIDDLE_PREFIX + titleWithBounds;
            }
        }

        const info = {
            longitude: lng_lat[0],
            latitude: lng_lat[1],
            title: titleWithBounds,
            description: description,
        };

        const csvLine = Object.values(info).join(',');

        files.forEach(fs => {
            FS.writeSync(fs, csvLine + "\n");
        });

        points.push(info);
    }

    return points;
}



/* --------------------------------------------------------------------------
 * 
 * CORE CONFIG
 *
 * -------------------------------------------------------------------------- */

String.prototype.format = function(opts) { return this.replace(/\{([^\}]+)\}/g, (match, name) => opts[name]) }

/* -------------------------------------------------------------------------- */


const HTTPS = require('https');
const PATH = require('path');
const FS = require('fs');
const OS = require('os');

HTTPS.globalAgent.options.rejectUnauthorized = false;

const NB_PARALLEL_PROCESS_PER_CORE = 1;
const NB_PARALLEL_PROCESS = OS.cpus().length * NB_PARALLEL_PROCESS_PER_CORE;

const OUTPUT_PATH = PATH.resolve(__dirname, '..', OUTPUT_DIR);
const ASSET_PATH = PATH.resolve(__dirname, '..', ASSET_DIR);

var ENTRY_LIST = [];
var GATSO_LIST = [];


/* --------------------------------------------------------------------------
 * 
 * CORE WORKFLOW
 *
 * -------------------------------------------------------------------------- */


function appendToGatsoList(transactionList) {
    GATSO_LIST = GATSO_LIST.concat(transactionList);
}

function rmdirSyncForce(dir) {
    const list = FS.readdirSync(dir);
    
    for(let i = 0; i < list.length; i++) {
        const filename = PATH.join(dir, list[i]);
        const stat = FS.statSync(filename);

        if('.' !== filename && '..' !== filename) {
            if(stat.isDirectory()) {
                rmdirSyncForce(filename);
            } else {
                FS.unlinkSync(filename);
            }
        }
    }
    
    FS.rmdirSync(dir);
};


async function crawlPromise(entry) {
    return new Promise((resolve, reject) => {
        console.log(entry.url);

        HTTPS.get(entry.url, (request) => {
            let data = '';
    
            request.on('data', (chunk) => {
                data += chunk;
            });
            request.on('end', () => {
                const gatso = parseInfo(JSON.parse(data), entry);

                appendToGatsoList(gatso);

                resolve();
            });
        });
    });
}

async function crawlLoopPromise() {
    let entry = getEntry();

    while (null !== entry) {
        await crawlPromise(entry);

        entry = getEntry();
    }
}


function getEntry() {
    const entry = ENTRY_LIST.pop();

    if (entry) {
        const path = INFO_PATH.format({id: entry.id});
    
        entry.url = BASE_URL + path;

        return entry;
    }

    return null;
}


async function start() {
    const crawlerPromises = [];

    for (processIndex = 0; processIndex < NB_PARALLEL_PROCESS; ++processIndex) {
        const crawlerPromise = crawlLoopPromise();

        crawlerPromises.push(crawlerPromise);
    }

    await Promise.all(crawlerPromises);
}


function openFiles() {
    if (FS.existsSync(OUTPUT_PATH)) {
        rmdirSyncForce(OUTPUT_PATH);
    }

    FS.mkdirSync(OUTPUT_PATH);

    for (let id in REF_RULES) {
        const filePath = OUTPUT_PATH + '/' + REF_RULES[id].filename;
        const fs = FS.openSync(filePath, 'as');
        
        REF_RULES[id].fs = fs;
    }
}


function closeFiles() {
    for (let id in REF_RULES) {
        const rule = REF_RULES[id];
        
        FS.closeSync(rule.fs);
        delete rule.fs;
    }
}


function packageFiles() {
    for (let id in REF_RULES) {
        const rule = REF_RULES[id];
        const filePath = OUTPUT_PATH + '/' + rule.filename;

        if (FS.existsSync(filePath)) {
            const stat = FS.statSync(filePath);

            if (0 === stat.size) {
                FS.unlinkSync(filePath);
            } else {
                const filename = rule.filename.replace(/\.csv$/, '.bmp');;
                const fromBmpPath = ASSET_PATH + '/' + filename;
                const toBmpPath = OUTPUT_PATH + '/' + filename;

                FS.copyFileSync(fromBmpPath, toBmpPath);
            }
        }
    }
}


async function run() {
    openFiles();

    const mainPromise = new Promise((resolve, reject) => {
        HTTPS.get(BASE_URL + LIST_PATH, (request) => {
            let data = '';

            request.on('data', (chunk) => {
                data += chunk;
            });
            request.on('end', async () => {
                ENTRY_LIST = parseList(JSON.parse(data));
                await start();
                resolve();
            });
        });
    });

    await mainPromise;

    closeFiles();
    packageFiles();
}


/* -------------------------------------------------------------------------- */


(async function() {
    await run();

    //const theFinalResultForTheChallenge = JSON.stringify(GATSO_LIST);

    //console.log(theFinalResultForTheChallenge);

    // be carefull it floods the JSON response
    //console.debug(GATSO_LIST.length + " transactions");
})()
