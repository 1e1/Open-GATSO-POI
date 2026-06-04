const BASE_URL = 'https://radars.securite-routiere.gouv.fr';
const LIST_PATH = '/radars/all?_format=json';
const INFO_PATH = '/radars/{id}?_format=json';

const FS = require('fs');
const HTTPS = require('https');
const CRAWLER = require('./Crawler.js');
const { format, flatten } = require('./utils.js');
const POINT = require('./POI.js');

const COUNTRY_CODE = 'FR';
const REQUEST_RETRY = 5;
const WAITING_TIME_ON_ERROR = 5000;



module.exports = class CrawlerGatsoFR extends CRAWLER {
    
    constructor() {
        super();

        this.entryList = [];
    }

    getCode() {
        return 'gatso-FR';
    }

    async prepare() {
        const index_path = this.options.cache + '.json';
        let entryList = null;

        if (FS.existsSync(index_path)) {
            try {
                entryList = JSON.parse(FS.readFileSync(index_path));
            } catch (err) {
                console.error('[ERROR] index en cache illisible, re-téléchargement: ' + index_path);
                entryList = null;
            }
        }

        if (null === entryList) {
            entryList = await this.downloadEntries();

            FS.writeFileSync(index_path, JSON.stringify(entryList));
        }

        this.entryList = entryList;

        if (! FS.existsSync(this.options.cache)) {
            FS.mkdirSync(this.options.cache);
        }
    }

    async downloadEntries() {
        let entryList = [];

        await new Promise((resolve, reject) => {
            const req = HTTPS.get(BASE_URL + LIST_PATH, (response) => {
                if (200 !== response.statusCode) {
                    response.resume();
                    return reject(new Error('status: ' + response.statusCode));
                }

                let data = '';

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    try {
                        entryList = this.parseList(JSON.parse(data));
                        resolve();
                    } catch (err) {
                        reject(new Error('réponse JSON invalide (liste radars): ' + err.message));
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(60000, () => req.destroy(new Error('timeout liste radars')));
        });

        return entryList;
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
                if (null !== ref.alert && !displayRules.includes(ref.alert)) {
                    displayRules.push(ref.alert);
                }
                
                basenamesList.push(ref.basenames);
            }
        });

        if (0 === basenamesList.length) {
            const ref = this.getRuleById('');
            
            if (true === ref.filter) {
                if (null !== ref.alert && !displayRules.includes(ref.alert)) {
                    displayRules.push(ref.alert);
                }
                
                basenamesList.push(ref.basenames);
            }
        }
        
        const displayType = this.displayTypesToString(displayTypes);
        const displayRule = this.displayRulesToString(displayRules);
        const basenames = flatten(basenamesList);

        const point = new POINT();

        point
            .setCountry(COUNTRY_CODE)
            .setGeoJson(entry.geoJson)
            .setType(displayType)
            .setRule(displayRule)
            .setDescription(gatso.radarDirection + ' ' + gatso.radarRoad)
            .setLastUpdateTimestamp(gatso.changed)
            ;
    
        this.storage.addPoint(this.getCode(), point, basenames);
        this.addTimestamp(gatso.changed);
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

            case '':
            return this.getRule('empty');
        }

        throw `unknown rule id=${id}`;
    }

    async crawlPromise(entry) {
        const cache_path = `${this.options.cache}/${entry.id}.json`;
        let json = null;

        if (FS.existsSync(cache_path)) {
            try {
                json = JSON.parse(FS.readFileSync(cache_path));
            } catch (err) {
                console.error('[ERROR] cache radar illisible, re-téléchargement: ' + cache_path);
                json = null;
            }
        }

        if (null === json) {
            json = await this.downloadEntry(entry);

            FS.writeFileSync(cache_path, JSON.stringify(json));
        }

        this.parseInfo(json, entry);
    }

    async downloadEntry(entry) {
        let retryLeft = REQUEST_RETRY;
        let json = null;

        while (0 < retryLeft && null === json) {
            console.log(this.getCode() + ' ' + entry.url + ' #' + (1 + REQUEST_RETRY - retryLeft));

            try {
                json = await new Promise((resolve, reject) => {
                    const req = HTTPS.get(entry.url, (response) => {
                        if (200 !== response.statusCode) {
                            response.resume();
                            return reject(new Error('status: ' + response.statusCode));
                        }

                        let data = '';

                        response.on('data', (chunk) => {
                            data += chunk;
                        });

                        response.on('end', () => {
                            try {
                                resolve(JSON.parse(data));
                            } catch (err) {
                                reject(new Error('JSON invalide ' + entry.url + ': ' + err.message));
                            }
                        });
                    });

                    req.on('error', reject);
                    req.setTimeout(60000, () => req.destroy(new Error('timeout ' + entry.url)));
                });
            } catch (err) {
                console.error('[ERROR]', (err && err.message) || err);
                retryLeft--;

                if (0 < retryLeft) {
                    await this.sleep(WAITING_TIME_ON_ERROR);
                }
            }
        }

        if (null === json) {
            throw `can not get ${entry.url}`;
        }

        return json;
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
            const path = format(INFO_PATH, {id: entry.id});

            entry.url = BASE_URL + path;

            return entry;
        }
    
        return null;
    }
}