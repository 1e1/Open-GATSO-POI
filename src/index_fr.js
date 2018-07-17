const BASE_URL = 'https://radars.securite-routiere.gouv.fr';
const LIST_PATH = '/radars/all?_format=json';
const INFO_PATH = '/radars/{id}?_format=json';

const MANIFEST_FILE = './SD_CARD/manifest.txt';
const OUTPUT_DIR = './SD_CARD/FR';
const ASSET_DIR = './src/assets';

const REQUEST_RETRY = 5;

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
    '4': { label: 'Vitesse VL 30', type: 'speed', alert: 30, filter: true, basename: 'GATSO_30' },
    '5': { label: 'Vitesse VL 50', type: 'speed', alert: 50, filter: true, basename: 'GATSO_50' },
    '6': { label: 'Vitesse VL 70', type: 'speed', alert: 70, filter: true, basename: 'GATSO_70' },
    '7': { label: 'Vitesse VL 80', type: 'speed', alert: 80, filter: true, basename: 'GATSO_80' },
    '8': { label: 'Vitesse VL 90', type: 'speed', alert: 90, filter: true, basename: 'GATSO_90' },
    '9': { label: 'Vitesse VL 110', type: 'speed', alert: 110, filter: true, basename: 'GATSO_110' },
    '10': { label: 'Vitesse VL 130', type: 'speed', alert: 130, filter: true, basename: 'GATSO_130' },
    '11': { label: 'Vitesse PL 50', type: 'speed', alert: 50, filter: false, basename: 'GATSO_50' },
    '12': { label: 'Vitesse PL 70', type: 'speed', alert: 70, filter: false, basename: 'GATSO_70'  },
    '13': { label: 'Vitesse PL 80', type: 'speed', alert: 80, filter: false, basename: 'GATSO_80'  },
    '14': { label: 'Vitesse PL 90', type: 'speed', alert: 90, filter: false, basename: 'GATSO_90'  },
    '15': { label: 'Franchissement de feux', type: 'traffic_light', alert: null, filter: true, basename: 'GATSO_stop'  },
    '17': { label: 'Franchissement de voie ferrée', type: 'railway', alert: null, filter: true, basename: 'GATSO_rail'  },
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
    const files = [];

    const displayTypes = [];
    gatso.radarType.forEach(type => {
        const ref = REF_TYPES[type.tid];

        if (undefined === ref) {
            console.log("--- ERROR TYPE ---");
            console.log(gatso);
            console.log("------------------");
        } else {
            if (!displayTypes.includes(ref.display)) {
                displayTypes.push(ref.display);
            }
        }
    });

    const displayRules = [];
    gatso.rulesMesured.forEach(rule => {
        const ref = REF_RULES[rule.tid];

        if (undefined === ref) {
            console.log("--- ERROR RULE ---");
            console.log(gatso);
            console.log("------------------");
        } else {
            if (true === ref.filter) {
                if (null !== ref.alert && !displayRules.includes(rule.alert)) {
                    displayRules.push(ref.alert);
                }

                const file = FILES[ref.basename];

                files.push(file);
            }
        }
    });

    const displayType = displayTypes.join(' ');
    const displayRule = displayRules.length ? '@' + displayRules.reduce((min,val) => Math.min(min,val)) : '';

    const point = {
        geoJson: entry.geoJson,
        title: (displayType + displayRule).trim(),
        description: (gatso.radarDirection + ' ' + gatso.radarRoad).trim(),
        lastUpdateTimestamp: gatso.changed,
    };

    writePoint(files, point);
}



/* --------------------------------------------------------------------------
 * 
 * CORE CONFIG
 *
 * -------------------------------------------------------------------------- */

String.prototype.format = function(opts) { return this.replace(/\{([^\}]+)\}/g, (match, name) => opts[name]) }
String.prototype.escapeCsv = function(opts) { return '"' + this.replace(/"/g,'\\"') + '"' }
String.prototype.escapeAttribute = function(opts) { return '"' + this.replace(/"/g,'\\"') + '"' }
String.prototype.escapeXml = function(opts) { return '<![CDATA[' + this.replace(/"/g,'\\"') + ']]>' }

/* -------------------------------------------------------------------------- */


const HTTPS = require('https');
const PATH = require('path');
const FS = require('fs');
const OS = require('os');

HTTPS.globalAgent.options.rejectUnauthorized = false;

const NB_PARALLEL_PROCESS_PER_CORE = 1;
const NB_PARALLEL_PROCESS = OS.cpus().length * NB_PARALLEL_PROCESS_PER_CORE;

const MANIFEST_PATH = PATH.resolve(__dirname, '..', MANIFEST_FILE);
const OUTPUT_PATH = PATH.resolve(__dirname, '..', OUTPUT_DIR);
const ASSET_PATH = PATH.resolve(__dirname, '..', ASSET_DIR);

const FILE_ENCODING = 'utf8';

const FORMAT_CSV = 'csv';
const FORMAT_GPX = 'gpx';
const FORMAT_OV2 = 'ov2';

const FORMATS = [ FORMAT_CSV, FORMAT_GPX, FORMAT_OV2 ];

const FILES = {};

var ENTRY_LIST = [];
var CHANGED_TIMESTAMP_MAX = 0;


/* --------------------------------------------------------------------------
 * 
 * CORE WORKFLOW
 *
 * -------------------------------------------------------------------------- */


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


async function crawlPromise(entry) {
    let retryLeft = REQUEST_RETRY;

    do {
        const request = new Promise((resolve, reject) => {
            console.log(entry.url + ' #' + (1 + REQUEST_RETRY - retryLeft));

            HTTPS.get(entry.url, (request) => {
                let data = '';
        
                request.on('data', (chunk) => {
                    data += chunk;
                });

                request.on('error', (chunk) => {
                    reject();
                });

                request.on('end', () => {
                    const json = JSON.parse(data);
                    
                    retryLeft = -1;

                    parseInfo(json, entry);
                    resolve();
                });
            });
        });

        if (0 < retryLeft) {
            request.catch(ignore => null);
        }

        await request;

    } while (0 < --retryLeft);
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


function pointToCsvBuffer(point) {
    const geoJsonLength = point.geoJson.length;
    
    let lines = [];

    for (let i = 0; i < geoJsonLength; ++i) {
        const lng_lat = point.geoJson[i];

        let titleWithBounds = point.title;

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

        const data = {
            longitude: lng_lat[0],
            latitude: lng_lat[1],
            title: titleWithBounds.escapeCsv(),
            description: point.description.escapeCsv(),
        };
     
        const line = Object.values(data).join(',');

        lines.push(line + "\n");
    }

    return Buffer.from(lines.join(''), FILE_ENCODING);
}


function pointToOv2Buffer(point) {
    const geoJsonLength = point.geoJson.length;
    const buffers = [];

    for (let i = 0; i < geoJsonLength; ++i) {
        const lng_lat = point.geoJson[i];

        let titleWithBounds = point.title;

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

        const data = {
            longitude: Math.round(lng_lat[0] * 100000),
            latitude: Math.round(lng_lat[1] * 100000),
            title: titleWithBounds,
            length: titleWithBounds.length,
        };
     
        const noTitleTrameLength = 14;
        const trameLength = data.title.length + noTitleTrameLength;
        const buffer = Buffer.alloc(trameLength);

        let offset = 0;

        buffer.writeUInt8('0x02', offset);
        offset += 1;
        buffer.writeUInt32LE(trameLength, offset);
        offset += 4;
        buffer.writeInt32LE(data.longitude, offset);
        offset += 4;
        buffer.writeInt32LE(data.latitude, offset);
        offset += 4;
        buffer.write(data.title, offset, data.title.length);
        offset += data.length;
        buffer.writeUInt8('0x00', offset);
        offset += 1;

        buffers.push(buffer);
    }

    return Buffer.concat(buffers);
}


function pointToGpxBuffer(point) {
    const geoJsonLength = point.geoJson.length;
    
    let line;

    if (1 === geoJsonLength) {
        // WAYPOINT
        line = '<wpt lon="{lon}" lat="{lat}"><name>{title}</name><desc>{desc}</desc></wpt>'.format({
            lon: point.geoJson[0][0],
            lat: point.geoJson[0][1],
            title: point.title.escapeXml(),
            desc: point.description.escapeXml(),
        });
    } else {
        // ROUTE
        const points = [];
        for (let i=0; i<geoJsonLength; ++i) {
            let titleWithBounds = point.title;

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

            //const rtept = '<rtept lon="{lon}" lat="{lat}"><name>{title}</name><desc>{desc}</desc></rtept>'.format({
            const rtept = '<trkpt lon="{lon}" lat="{lat}"></trkpt>'.format({
                lon: point.geoJson[i][0],
                lat: point.geoJson[i][1],
                title: titleWithBounds.escapeXml(),
                desc: point.description.escapeXml(),
            });

            points.push(rtept);
        }

        line = '<trk><name>{title}</name><desc>{desc}</desc><trkseg>{points}</trkseg></trk>'.format({
            title: point.title.escapeXml(),
            desc: point.description.escapeXml(),
            points: points.join(''),
        });
    }

    return Buffer.from(line, FILE_ENCODING);
}


function writeHeader(files) {
    files.forEach(file => {
        file.pointers.forEach(pointer => {
            switch (pointer.format) {
                /*
                case FORMAT_CSV:
                case FORMAT_OV2:
                break;
                */
                case FORMAT_GPX:
                FS.writeSync(pointer.fs, '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>' + "\n");
                FS.writeSync(pointer.fs, '<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" creator="Oregon 400t" version="1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">');
                break;
            }
        });
    });
}


function writePoint(files, point) {
    files.forEach(file => {
        file.pointers.forEach(pointer => {
            let buffer = null;

            switch (pointer.format) {
                case FORMAT_CSV:
                buffer = pointToCsvBuffer(point);
                break;

                case FORMAT_OV2:
                buffer = pointToOv2Buffer(point);
                break;

                case FORMAT_GPX:
                buffer = pointToGpxBuffer(point);
                break;
            }

            FS.writeSync(pointer.fs, buffer);
        });

        file.size++;
        file.timestampMax = Math.max(file.timestampMax, point.lastUpdateTimestamp);
    });
}


function writeFooter(files) {
    files.forEach(file => {
        file.pointers.forEach(pointer => {
            switch (pointer.format) {
                /*
                case FORMAT_CSV:
                case FORMAT_OV2:
                break;
                */
                case FORMAT_GPX:
                FS.writeSync(pointer.fs, '</gpx>');
                break;
            }
        });
    });
}


function openFiles() {
    if (FS.existsSync(OUTPUT_PATH)) {
        rmdirRecursiveSync(OUTPUT_PATH);
    }

    mkdirRecursiveSync(OUTPUT_PATH);

    for (let id in REF_RULES) {
        const rule = REF_RULES[id];

        if (undefined === FILES[rule.basename]) {
            const file = {
                pointers: [],
                size: 0,
                timestampMax: 0,
            };

            FORMATS.forEach(format => {
                const filePath = OUTPUT_PATH + '/' + rule.basename + '.' + format;
                const fs = FS.openSync(filePath, 'as');
                const pointer = {
                    fs: fs,
                    format: format,
                };

                file.pointers.push(pointer);
            });

            FILES[rule.basename] = file;
        }
    }

    writeHeader(Object.values(FILES));
}


function closeFiles() {
    writeFooter(Object.values(FILES));

    for (let basename in FILES) {
        const file = FILES[basename];

        file.pointers.forEach(pointer => {
            FS.closeSync(pointer.fs);

            delete pointer.fs;
        });
    }
}


function copyAsset(filename) {
    const fromBmpPath = ASSET_PATH + '/' + filename;
    const toBmpPath = OUTPUT_PATH + '/' + filename;

    FS.copyFileSync(fromBmpPath, toBmpPath);
}


function packageFiles() {
    for (let basename in FILES) {
        const file = FILES[basename];

        file.pointers.forEach(pointer => {
            const filePath = OUTPUT_PATH + '/' + basename + '.' + pointer.format;

            if (FS.existsSync(filePath)) {
                if (0 === file.size) {
                    FS.unlinkSync(filePath);
                } else {
                    copyAsset(basename + '.bmp');
                }
            }
        });
    }
}


function generateManifest() {
    const fs = FS.openSync(MANIFEST_PATH, 'a');
    const timestamps = Object.values(FILES).map(file => file.timestampMax);
    const timestampMax = Math.max.apply(null, timestamps);

    FS.writeSync(fs, timestampMax);
    FS.closeSync(fs);

    return timestampMax;
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

    const timestampMax = generateManifest();

    return timestampMax;
}


/* -------------------------------------------------------------------------- */


(async function() {
    const timestampMax = await run();
    const dateMax = new Date();

    dateMax.setTime(timestampMax);

    console.log(FILES);
    console.log("timestampMax=" + dateMax.getTime());
    console.log("dateMax=" + dateMax.toISOString());
    console.log("done");
})()
