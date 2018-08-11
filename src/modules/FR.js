const BASE_URL = 'https://radars.securite-routiere.gouv.fr';
const LIST_PATH = '/radars/all?_format=json';
const INFO_PATH = '/radars/{id}?_format=json';

const HTTPS = require('https');
const CRAWLER = require('./Crawler.js');
const POINT = require('./POI.js');

HTTPS.globalAgent.options.rejectUnauthorized = false;

const REQUEST_RETRY = 5;



module.exports = class CrawlerFr extends CRAWLER {
    
    constructor() {
        super();

        this.entryList = [];
    }

    getCode() {
        return 'FR';
    }

    async prepare() {
        this.entryList = [];

        const mainPromise = new Promise((resolve, reject) => {
            HTTPS.get(BASE_URL + LIST_PATH, (request) => {
                if (200 === request.statusCode) {
                    let data = '';
            
                    request.on('data', (chunk) => {
                        data += chunk;
                    });
        
                    request.on('end', async () => {
                        this.entryList = this.parseList(JSON.parse(data));
                        
                        resolve();
                    });
                } else {
                    console.log('status: ' + request.statusCode);

                    reject();
                }
            });
        });

        mainPromise.catch(err => this.kill(err));

        await mainPromise;
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


    parseList(gatsoList) {
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

    parseInfo(gatso, entry) {
        const basenamesList = [];
        const displayTypes = [];
        const displayRules = [];

        gatso.radarType.forEach(type => {
            const ref = this.getTypeById(type.tid);
    
            if (!displayTypes.includes(ref.display)) {
                displayTypes.push(ref.display);
            }
        });
    
        gatso.rulesMesured.forEach(rule => {
            const ref = this.getRuleById(rule.tid);
            
            if (true === ref.filter) {
                if (null !== ref.alert && !displayRules.includes(rule.alert)) {
                    displayRules.push(ref.alert);
                }
                
                basenamesList.push(ref.basenames);
            }
        });
        
        const displayType = this.displayTypesToString(displayTypes);
        const displayRule = this.displayRulesToString(displayRules);
        const basenames = basenamesList.concatInside();
    
        const point = new POINT();

        point
            .setCountry(this.getCode())
            .setGeoJson(entry.geoJson)
            .setType(displayType)
            .setRule(displayRule)
            .setDescription(gatso.radarDirection + ' ' + gatso.radarRoad)
            .setLastUpdateTimestamp(gatso.changed)
            ;
    
        this.storage.addPoint(this.getCode(), point, basenames);
    }

    getTypeById(id) {
        switch (id) {
            case '1':
            return this.getType('traffic_light');

            case '2':
            return this.getType('instant_speed');

            case '3':
            return this.getType('multi_instant_speed');

            case '16':
            return this.getType('railroad');

            case '18':
            return this.getType('average_speed');

            case '19':
            return this.getType('route');
        }

        throw `unknown type id=${id}`;
    }

    getRuleById(id) {
        switch (id) {
            case '4':
            return this.getRule('car30');

            case '5':
            return this.getRule('car50');

            case '6':
            return this.getRule('car70');

            case '7':
            return this.getRule('car80');

            case '8':
            return this.getRule('car90');

            case '9':
            return this.getRule('car110');

            case '10':
            return this.getRule('car130');

            case '11':
            return this.getRule('truck50');

            case '12':
            return this.getRule('truck70');

            case '13':
            return this.getRule('truck80');

            case '14':
            return this.getRule('truck90');

            case '15':
            return this.getRule('traffic_light');

            case '17':
            return this.getRule('railroad');
        }

        throw `unknown rule id=${id}`;
    }

    async crawlPromise(entry) {
        let retryLeft = REQUEST_RETRY;
    
        do {
            const request = new Promise((resolve, reject) => {
                console.log(this.getCode() + ' ' + entry.url + ' #' + (1 + REQUEST_RETRY - retryLeft));
    
                HTTPS.get(entry.url, (request) => {
                    if (200 === request.statusCode) {
                        let data = '';
                
                        request.on('data', (chunk) => {
                            data += chunk;
                        });
        
                        request.on('end', () => {
                            const json = JSON.parse(data);
                            
                            retryLeft = -1;
        
                            this.parseInfo(json, entry);
                            resolve();
                        });
                    } else {
                        console.log('status: ' + request.statusCode);
    
                        resolve();
                    }
                });
            });

            request.catch(ignore => null);
    
            await request;
    
        } while (0 < --retryLeft);

        if (0 === retryLeft) {
            throw `can not get ${entry.url}`;
        }
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
            const path = INFO_PATH.format({id: entry.id});
        
            entry.url = BASE_URL + path;
    
            return entry;
        }
    
        return null;
    }
}