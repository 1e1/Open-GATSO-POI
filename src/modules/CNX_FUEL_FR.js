const BASE_URL = 'https://donnees.roulez-eco.fr/opendata';
const INFO_PATH = '/instantane';
// doc: https://www.prix-carburants.gouv.fr/rubrique/opendata/

const PATH = require('path');
const FS = require('fs');
const OS = require('os');
const AXIOS = require('axios');
const ZIP = require('node-stream-zip');
const HTTPS = require('https');
const CRAWLER = require('./Crawler.js');
const CONFIG = require('./config.js');
const { flatten } = require('./utils.js');
const POINT = require('./POI.js');

const COUNTRY_CODE = 'FR';
const REQUEST_RETRY = 5;
const WAITING_TIME_ON_ERROR = 5000;
const WORKSPACE = FS.mkdtempSync(PATH.join(OS.tmpdir(), 'roulez-eco-'));

// Noms de carburant de l'open-data roulez-eco -> clé de CONFIG.services.
// Tout nom absent ici est cherché tel quel dans CONFIG.services (insensible à la casse),
// puis ignoré proprement s'il reste inconnu (au lieu de planter tout le run).
const GAS_SYNONYMS = {
    gazole: 'gazole',
    sp95: 'sp95',
    sp98: 'sp98',
    e10: 'e10',
    e85: 'e85',
    gplc: 'gpl',
};


module.exports = class CrawlerFuelFR extends CRAWLER {
    
    constructor() {
        super();

        this.entryList = [];
    }

    getCode() {
        return 'fuel-FR';
    }

    async prepare() {
        const zip_path = this.options.cache + '.zip';

        if (!FS.existsSync(zip_path)) {
            await this.downloadSource(zip_path);
        }
        
        await this.unzip(zip_path);
    }

    async downloadSource(zip_path) {
        const axios = AXIOS.create({
            baseURL: BASE_URL,
            responseType: 'stream',
            maxRedirects: 6,
            timeout: 60000,
            httpsAgent: new HTTPS.Agent({ keepAlive: true }),
        });

        let retryLeft = REQUEST_RETRY;
        let success = false;

        do {
            if (retryLeft !== REQUEST_RETRY) {
                await this.sleep(WAITING_TIME_ON_ERROR);
            }

            console.log(zip_path);
            console.log(BASE_URL + INFO_PATH + ' #' + (1 + REQUEST_RETRY - retryLeft));

            try {
                // axios rejette par défaut hors 2xx -> géré par le catch et un nouvel essai.
                await new Promise((resolve, reject) => {
                    axios
                        .get(INFO_PATH)
                        .then(response => {
                            const zip_file = FS.createWriteStream(zip_path);

                            zip_file.on('error', reject);
                            response.data.on('error', reject);
                            response.data.pipe(zip_file).on('close', resolve);
                        })
                        .catch(reject);
                });

                success = true;
            } catch (err) {
                console.error('[ERROR]', (err && err.message) || err);
            }

        } while (!success && 0 < --retryLeft);

        if (!success) {
            throw `can not get ${BASE_URL + INFO_PATH}`;
        }
    }
    
    
    async start() {
        const crawlerPromises = [];
        
        for (let processIndex = 0; processIndex < this.nbParallelProcess; ++processIndex) {
            const crawlerPromise = this.crawlLoopPromise();
    
            crawlerPromise.catch(err => this.kill(err));

            crawlerPromises.push(crawlerPromise);
        }
    
        await Promise.all(crawlerPromises);
    }


    // ---


    parseInfo(station, entry) {
        const basenamesList = [];
        const gasTypeList = [];
        const serviceTypeList = [];

        let lastUpdateTimestamp = 0;

        for (const gasName in station.gas) {
            const gas = station.gas[gasName];
            const service = this.getServiceByGas(gasName);

            if (null === service) {
                continue;
            }

            lastUpdateTimestamp = Math.max(lastUpdateTimestamp, gas.timestamp);

            gasTypeList.push(service.type);
            basenamesList.push(service.basenames);
        }

        for (const serviceName of station.services) {
            const service = this.getServiceByService(serviceName);

            if (null !== service) {
                serviceTypeList.push(service.type);
                basenamesList.push(service.basenames);
            }
        }
        
        const displayType = this.displayServicesToString(gasTypeList);
        const displayRule = this.displayServicesToString(serviceTypeList);
        const basenames = flatten(basenamesList);
        const description = station.services.join("\n");

        const point = new POINT();

        point
            .setCountry(COUNTRY_CODE)
            .setCoordinates(station.longitude, station.latitude)
            .setType(displayType)
            .setRule(displayRule)
            .setDescription(description)
            .setLastUpdateTimestamp(lastUpdateTimestamp)
            ;
    
        this.storage.addPoint(this.getCode(), point, basenames);
        this.addTimestamp(lastUpdateTimestamp);
    }


    getServiceByGas(gas) {
        const gasName = gas.toLowerCase();
        const key = GAS_SYNONYMS[gasName] || gasName;

        if (undefined !== CONFIG.services[key]) {
            return this.getService(key);
        }

        // Carburant non répertorié (ex: nouveau nom dans l'open-data): on l'ignore proprement.
        console.log(this.getCode() + ' carburant inconnu ignoré: ' + gas);

        return null;
    }


    getServiceByService(service) {
        const serviceName = service.toLowerCase();

        switch (serviceName) {
            case 'carburant additivé':
            return this.getService('adblue');

            case 'station de gonflage':
            return this.getService('pressure');

            case 'bornes électriques':
            return this.getService('electricity');

            case 'gnv':
            return this.getService('gnv');
        }

        return null;
    }


    async unzip(zip_path) {
        const unzipPromise = new Promise((resolve, reject) => {
            const unzip = new ZIP({
                file: zip_path,
                storeEntries: true,
            });

            unzip.on('error', (err) => {
                console.error('[ERROR]', err); 
                reject();
            });
            
            unzip.on('entry', (entry) => {
                const file = {
                    filename: entry.name,
                };

                this.entryList.push(file);
            });
            
            unzip.on('ready', () => {
                unzip.extract(null, WORKSPACE, async (err, count) => {
                    console.log(err ? 'Extract error' : `Extracted ${count} entries`);
                    unzip.close();

                    resolve();
                });
            });
        });

        await unzipPromise;
    }


    extractAttribute(text, name) {
        const attribute = name + '=';
        const index = text.lastIndexOf(attribute);
        const open = index + name.length + 1;
        const quote = text.charAt(open);
        const end = text.indexOf(quote, open + 1);

        return text.substring(open +1, end);
    }


    async crawlPromise(entry) {
        console.log(this.getCode() + ' ' + entry.filename);

        const xml_path = entry.path;
        const content = FS.readFileSync(xml_path, 'latin1');
        const pdvs = content.split(/<pdv\b/msi);

        // remove the XML header
        pdvs.shift();

        const longitude_pattern = /\blongitude=['"](-?\d+(?:\.\d*)?)['"]/mi;
        const latitude_pattern = /\blatitude=['"](-?\d+(?:\.\d*)?)['"]/mi;
        const serviceName_pattern = /<service>([^<>]+)/gmi;
        const gasName_pattern = /<prix\b([^>]*)>/gmi;

        pdvs.forEach(pdv => {
            const longitudes = pdv.match(longitude_pattern) || [ 0 ];
            const latitudes = pdv.match(latitude_pattern) || [ 0 ];
            const serviceNames = pdv.match(serviceName_pattern) || [];
            const gasNodes = pdv.match(gasName_pattern) || [];

            const longitude = parseFloat(longitudes[1]) / 100000;
            const latitude = parseFloat(latitudes[1]) / 100000;

            // Station sans coordonnées exploitables: on saute (évite des POI à coordonnées NaN).
            if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
                return;
            }

            const services = serviceNames.map(service => {
                return service.substring('<service>'.length);
            });
            const gas = {}
            
            gasNodes.forEach(gasNode => {
                const name = this.extractAttribute(gasNode, 'nom');
                const price = this.extractAttribute(gasNode, 'valeur');
                const update = this.extractAttribute(gasNode, 'maj');
                
                const amount = parseFloat(price);
                const date = new Date(update);
                const timestamp = Math.round(date.getTime() / 1000);
                
                gas[name] = {
                    price: amount,
                    timestamp: timestamp,
                }
            });

            const json = {
                longitude: longitude, 
                latitude: latitude, 
                services: services,
                gas: gas,
            };

            this.parseInfo(json, entry);
        });
    }

    
    async crawlLoopPromise() {
        let entry = this.getEntry();
    
        while (null !== entry) {
            await this.crawlPromise(entry);
    
            entry = this.getEntry();
        }
    }
    
    
    getEntry() {
        const entry = this.entryList.pop();
    
        if (entry) {
            const path = PATH.resolve(WORKSPACE, entry.filename);
        
            entry.path = path;
    
            return entry;
        }
    
        return null;
    }
}