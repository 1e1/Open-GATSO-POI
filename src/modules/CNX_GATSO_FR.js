const BASE_URL = 'https://radars.securite-routiere.gouv.fr';
const LIST_PATH = '/radars/all?_format=json';
const INFO_PATH = '/radars/{id}?_format=json';

const FS = require('fs');
const HTTPS = require('https');
const CRAWLER = require('./Crawler.js');
const { format, flatten } = require('./utils.js');
const POINT = require('./POI.js');

const COUNTRY_CODE = 'FR';
// Le connecteur n'envoyait aucun User-Agent (≠ EU/FUEL) ; un WAF gouv bloque souvent
// les requêtes sans UA, en particulier depuis une IP datacenter (runner CI).
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_RETRY = 5;
const WAITING_TIME_ON_ERROR = 5000;
const REQUEST_DELAY = 200;        // ms entre 2 téléchargements: politesse anti rate-limit (API gouv)
const MAX_PARALLEL_PROCESS = 3;   // concurrence plafonnée pour ne pas marteler l'API



module.exports = class CrawlerGatsoFR extends CRAWLER {

    constructor() {
        super();

        this.entryList = [];
        // L'API securite-routiere rate-limite le crawl agressif (échec net en CI sinon):
        // on plafonne la concurrence pour ne pas déclencher la limite nous-mêmes.
        this.nbParallelProcess = Math.min(this.nbParallelProcess, MAX_PARALLEL_PROCESS);
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

    // GET unique renvoyant le corps (string). Rejette avec statusCode/retryAfter sur erreur HTTP.
    httpGet(url) {
        const options = { headers: { 'User-Agent': USER_AGENT } };

        return new Promise((resolve, reject) => {
            const req = HTTPS.get(url, options, (response) => {
                const status = response.statusCode;

                if (200 !== status) {
                    response.resume();

                    const err = new Error('status: ' + status);
                    err.statusCode = status;
                    err.retryAfter = response.headers['retry-after'];

                    return reject(err);
                }

                let data = '';
                response.on('data', (chunk) => { data += chunk; });
                response.on('end', () => resolve(data));
            });

            req.on('error', reject);
            req.setTimeout(60000, () => req.destroy(new Error('timeout ' + url)));
        });
    }

    // Délai avant nouvel essai: respecte Retry-After (429/503) si présent, plafonné à 60 s.
    backoffDelay(err) {
        const sec = parseInt((err && err.retryAfter) || '', 10);

        if (Number.isFinite(sec) && sec > 0) {
            return Math.min(sec * 1000, 60000);
        }

        return WAITING_TIME_ON_ERROR;
    }

    async downloadEntries() {
        let retryLeft = REQUEST_RETRY;
        let entryList = null;

        while (0 < retryLeft && null === entryList) {
            try {
                entryList = this.parseList(JSON.parse(await this.httpGet(BASE_URL + LIST_PATH)));
            } catch (err) {
                console.error('[ERROR] liste radars:', (err && err.message) || err);
                retryLeft--;

                if (0 < retryLeft) {
                    await this.sleep(this.backoffDelay(err));
                }
            }
        }

        if (null === entryList) {
            throw 'can not get ' + BASE_URL + LIST_PATH;
        }

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
                // L'index fournit le tracé des itinéraires en [lat, lng] ; on normalise
                // en [lng, lat] (ordre attendu partout ailleurs, et par le fallback
                // point unique ci-dessous). Sinon les tronçons sortent à des coordonnées inversées.
                entry.geoJson = item.geoJson.map(pair => [pair[1], pair[0]]);
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

        // L'API securite-routiere sert désormais ses champs en minuscules
        // (radartype/rulesmesured) ; on garde un fallback camelCase par sécurité.
        (gatso.radartype || gatso.radarType || []).forEach(type => {
            const ref = this.getTypeById(type.tid);

            if (null !== ref && !displayTypes.includes(ref.display)) {
                displayTypes.push(ref.display);
            }
        });

        (gatso.rulesmesured || gatso.rulesMesured || []).forEach(rule => {
            const ref = this.getRuleById(rule.tid);

            if (null !== ref && true === ref.filter) {
                if (null !== ref.alert && !displayRules.includes(ref.alert)) {
                    displayRules.push(ref.alert);
                }

                basenamesList.push(ref.basenames);
            }
        });

        if (0 === basenamesList.length) {
            const ref = this.getRuleById('');

            if (null !== ref && true === ref.filter) {
                if (null !== ref.alert && !displayRules.includes(ref.alert)) {
                    displayRules.push(ref.alert);
                }
                
                basenamesList.push(ref.basenames);
            }
        }
        
        const displayType = this.displayTypesToString(displayTypes);
        const displayRule = this.displayRulesToString(displayRules);
        const basenames = flatten(basenamesList);

        // 'changed' est un epoch (string) ; on le force en nombre valide. Un champ manquant
        // donnerait NaN -> version.txt = "NaN" -> tag de release CI cassé.
        const changed = Number(gatso.changed) || Math.floor(Date.now() / 1000);

        const point = new POINT();

        point
            .setCountry(COUNTRY_CODE)
            .setGeoJson(entry.geoJson)
            .setType(displayType)
            .setRule(displayRule)
            .setDescription((gatso.radardirection || gatso.radarDirection || '') + ' ' + (gatso.radarroad || gatso.radarRoad || ''))
            .setLastUpdateTimestamp(changed)
            ;

        this.storage.addPoint(this.getCode(), point, basenames);
        this.addTimestamp(changed);
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

        // Nouveau type non répertorié (l'API en a ajouté, ex. tid 20): on l'ignore proprement
        // au lieu de planter tout le build (le radar retombe sur la règle 'empty' si besoin).
        console.log(this.getCode() + ' type radar inconnu ignoré: tid=' + id);

        return null;
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

        // Règle non répertoriée: on l'ignore proprement plutôt que de planter le build.
        console.log(this.getCode() + ' règle radar inconnue ignorée: tid=' + id);

        return null;
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

            // Politesse: on ne temporise que sur un vrai téléchargement (lecture cache = instantanée).
            await this.sleep(REQUEST_DELAY);
        }

        this.parseInfo(json, entry);
    }

    async downloadEntry(entry) {
        let retryLeft = REQUEST_RETRY;
        let json = null;

        while (0 < retryLeft && null === json) {
            console.log(this.getCode() + ' ' + entry.url + ' #' + (1 + REQUEST_RETRY - retryLeft));

            try {
                json = JSON.parse(await this.httpGet(entry.url));
            } catch (err) {
                console.error('[ERROR]', (err && err.message) || err);
                retryLeft--;

                if (0 < retryLeft) {
                    await this.sleep(this.backoffDelay(err));
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