const SOURCE_URL = 'https://donnees.roulez-eco.fr/opendata/instantane';
// doc: https://www.prix-carburants.gouv.fr/rubrique/opendata/

const PATH = require('path');
const FS = require('fs');
const OS = require('os');
const AXIOS = require('axios');
const ZIP = require('node-stream-zip');
const HTTPS = require('https');
const CRAWLER = require('./Crawler.js');
const POINT = require('./POI.js');

HTTPS.globalAgent.options.rejectUnauthorized = false;

const COUNTRY_CODE = 'FR';
const WORKSPACE = FS.mkdtempSync(PATH.join(OS.tmpdir(), 'roulez-eco-'));


module.exports = class CrawlerFuelFR extends CRAWLER {
    
    constructor() {
        super();

        this.entryList = [];
    }

    getCode() {
        return 'fuel-FR';
    }

    async prepare() {
        const zip_path = PATH.join(WORKSPACE, 'source.zip');
        const zip_file = FS.createWriteStream(zip_path, { encoding: null });
        
        zip_file.on('error', function(err) {
            console.error('[ERROR]', err); 
            FS.unlink(zip_path);
        });

        console.log(zip_path);
        console.log(SOURCE_URL);
        
        const mainPromise = new Promise((resolve, reject) => {
            AXIOS
                .get(SOURCE_URL, {responseType:'stream'})
                .then(function(response) {
                    response.data.pipe(zip_file).on('close', resolve);
                });
        });

        mainPromise.catch(err => this.kill(err));

        await mainPromise;

        await this.unzip(zip_path);
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
        const basenames = basenamesList.concatInside();
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
    }


    getServiceByGas(gas) {
        const gasName = gas.toLowerCase();

        switch (gasName) {
            case 'gazole':
            return this.getService('gazole');

            case 'sp95':
            return this.getService('sp95');

            case 'sp98':
            return this.getService('sp98');

            case 'e10':
            return this.getService('e10');

            case 'gplc':
            return this.getService('gpl');

            case 'e85':
            return this.getService('e85');
        }

        throw `unknown service ${serviceName}`;
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
            const longitudes = pdv.match(longitude_pattern);
            const latitudes = pdv.match(latitude_pattern);
            const serviceNames = pdv.match(serviceName_pattern) || [];
            const gasNodes = pdv.match(gasName_pattern) || [];

            const longitude = longitudes[1] / 100000;
            const latitude = latitudes[1] / 100000;
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