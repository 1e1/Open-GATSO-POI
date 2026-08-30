const SOURCE_URL = 'https://lufop.net/wp-content/plugins/downloads-manager/upload/Lufop-Zones-de-danger-EU-CSV.zip';
// Longer tokens first so "Troncondebut" is not parsed as "Tr" + "oncondebut…"
const FILE_PATTERN = /^([A-Z]{2})(Troncondebut|Tronconfin|FeuRouge|Fixe|Tunnel)(?:[A-Z]{2})(\d+)?\.csv$/i;
const REJECT_COUNTRIES = [ 'FR' ];

const PATH = require('path');
const FS = require('fs');
const OS = require('os');
const ZIP = require('node-stream-zip');
const HTTPS = require('https');
const CRAWLER = require('./Crawler.js');
const CONFIG = require('./config.js');
const { flatten, unescapeCsv, isPathInside } = require('./utils.js');
const POINT = require('./POI.js');

const WORKSPACE = FS.mkdtempSync(PATH.join(OS.tmpdir(), 'lufop-'));


module.exports = class CrawlerGatsoEU extends CRAWLER {
    
    constructor() {
        super();

        this.entryList = [];
    }

    getCode() {
        return 'gatso-EU';
    }

    async prepare() {
        const lastUpdateTimestamps = await this.getLastUpdateTimestamps();
        let lastUpdateTimestamp = lastUpdateTimestamps.reduce((max, val) => Math.max(max, val), 0);

        if (0 === lastUpdateTimestamp) {
            // Le scraping de la page lufop n'a renvoyé aucune date (page modifiée, indispo...):
            // on retombe sur l'heure courante plutôt que de planter (reduce sur tableau vide)
            // ou de dater tous les POI à epoch 0.
            console.warn('[WARN] date de mise à jour introuvable (Last-Modified sur ' + SOURCE_URL + '), fallback heure courante');
            lastUpdateTimestamp = Math.floor(Date.now() / 1000);
        }

        const zip_path = this.options.cache + '.zip';

        if (!FS.existsSync(zip_path)) {
            await this.downloadSource(zip_path);
        }

        await this.unzip(zip_path, lastUpdateTimestamp);
    }

    async downloadSource(zip_path) {
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };

        console.log(zip_path);
        console.log(SOURCE_URL);

        await new Promise((resolve, reject) => {
            const zip_file = FS.createWriteStream(zip_path);

            // Sur erreur: on coupe, on supprime l'archive partielle (callback obligatoire) puis on rejette.
            const fail = (err) => {
                zip_file.destroy();
                FS.unlink(zip_path, () => reject(err));
            };

            zip_file.on('error', fail);

            const req = HTTPS.get(SOURCE_URL, options, (response) => {
                if (200 !== response.statusCode) {
                    response.resume();
                    return fail(new Error('status: ' + response.statusCode));
                }

                response.on('error', fail);
                response.pipe(zip_file).on('close', resolve);
            });

            req.on('error', fail);
            req.setTimeout(120000, () => req.destroy(new Error('timeout téléchargement EU')));
        });
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


    parseInfo(gatso, entry) {
        const basenamesList = [];

        const type = this.getTypeByEntry(entry);
        const rule = this.getRuleByEntry(entry, entry.speedLimit);

        const displayTypes = [ type.display ];
        const displayRules = [];

        if (true === rule.filter) {
            if (null !== rule.alert) {
                displayRules.push(rule.alert);
            }

            basenamesList.push(rule.basenames);
        }
    
        const displayType = this.displayTypesToString(displayTypes);
        const displayRule = this.displayRulesToString(displayRules);
        const basenames = flatten(basenamesList);

        const point = new POINT();

        point
            .setCountry(entry.country)
            .setCoordinates(gatso.longitude, gatso.latitude)
            .setType(displayType)
            .setRule(displayRule)
            .setDescription(gatso.comment)
            .setLastUpdateTimestamp(entry.lastUpdateTimestamp)
            ;
    
        this.storage.addPoint(this.getCode(), point, basenames);
        this.addTimestamp(entry.lastUpdateTimestamp);
    }


    getTypeByEntry(entry) {
        const typeName = entry.type.toLowerCase();

        switch (typeName) {
            case 'fixe':
            case 'mobile':
            case 'chantier':
            case 'zone_temporaire':
            case 'troncondebut':
            // Section start: treat as a normal fixed speed camera (same basenames as fixe). If Lufop
            // duplicates the section for both travel directions, you get one troncondebut per direction.
            return this.getType('instant_speed');

            // case 'tronconfin':
            // Section end: not emitted as a POI for now. If the dataset lists both ends separately for
            // the same segment, troncondebut alone can be enough; re-enable if you need the far end for
            // one-way systems. See getCarRuleBySpeed for speed handling (cap > 130 -> car130).

            case 'feurouge':
            return this.getType('traffic_light');

            case 'tunnel':
            return this.getType('tunnel');

            case 'passageniveau':
            return this.getType('railroad');

            case '':
            if (entry.speedLimit !== null) {
                return this.getType('instant_speed');
            }
        }

        throw `unknown type ${typeName}`;
    }


    // getCarRuleBySpeed est désormais fourni par la classe de base Crawler (mutualisé avec le connecteur FR).


    getRuleByEntry(entry, speedLimit) {
        const typeName = entry.type.toLowerCase();

        switch (typeName) {
            case 'fixe':
            case 'troncondebut':
            return this.getCarRuleBySpeed(speedLimit);

            case 'feurouge':
            return this.getRule('traffic_light');

            case 'tunnel':
            return this.getRule('tunnel');

            case 'passageniveau':
            return this.getRule('railroad');

            case 'mobile':
            case 'chantier':
            case 'zone_temporaire':
            return this.getRule('empty');

            case '':
            if (speedLimit != null && speedLimit !== '') {
                return this.getCarRuleBySpeed(speedLimit);
            }
            return this.getRule('empty');
        }

        throw `unknown rule ${typeName}`;
    }


    async unzip(zip_path, timestamp) {
        let hasUnsafeEntry = false;
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
                // Zip-slip: un nom d'entrée qui s'échappe du WORKSPACE est rejeté et fera
                // avorter l'extraction (archive amont compromise / MITM sur lufop.net).
                if (!isPathInside(WORKSPACE, entry.name)) {
                    console.error('[ERROR] entrée zip hors WORKSPACE, extraction annulée:', entry.name);
                    hasUnsafeEntry = true;
                    return;
                }

                const infos = entry.name.match(FILE_PATTERN);

                if (null === infos) {
                    console.log('REJECT', entry.name);
                } else {
                    let type = infos[2];
                    let extra;

                    if (isNaN(infos[3])) {
                        if (undefined !== infos[3]) {
                            type = infos[3];
                        }
                        extra = null;
                    } else {
                        extra = infos[3];
                    }

                    const file = {
                        filename: entry.name,
                        country: infos[1].toUpperCase(),
                        type: type,
                        speedLimit: extra,
                        lastUpdateTimestamp: timestamp,
                    };

                    if (!REJECT_COUNTRIES.includes(file.country)) {
                        this.entryList.push(file);
                    }
                }
            });
            
            unzip.on('ready', () => {
                if (hasUnsafeEntry) {
                    unzip.close();
                    reject(new Error('archive zip refusée: entrée hors WORKSPACE (zip-slip)'));
                    return;
                }

                unzip.extract(null, WORKSPACE, async (err, count) => {
                    console.log(err ? 'Extract error' : `Extracted ${count} entries`);
                    unzip.close();

                    resolve();
                });
            });
        });

        await unzipPromise;
    }


    async crawlPromise(entry) {
        const typeLower = entry.type.toLowerCase();
        if (typeLower === 'tronconfin') {
            // Do not import section-end points yet: same physical zone may already be covered by
            // troncondebut (or the opposite direction’s troncondebut if Lufop mirrors the segment).
            console.log(this.getCode() + ' SKIP tronconfin ' + entry.filename);
            return;
        }

        console.log(this.getCode() + ' ' + entry.filename);

        const csv_path = entry.path;
        const content = FS.readFileSync(csv_path, 'utf8');
        const lines = content.split(/\r?\n/);
        // One row = one WGS84 point + free-text comment (Lufop style). This cannot represent a polyline
        // as a single POI; only one marker per row is written.
        const line_pattern = /^(?:(-?\d*(?:\.\d*))\s*,\s*)(?:(-?\d*(?:\.\d*))\s*,\s*)(.*)$/;

        // A full section (average-speed zone) in WKT would look like:
        //   LINESTRING (lon1 lat1, lon2 lat2, ...)  or  MULTIPOINT (...)
        // We do not parse that here; each CSV line remains an independent point for Garmin / VAG pipelines.

        lines.forEach(line => {
            const lon_lat_comments = line.match(line_pattern);

            if (null !== lon_lat_comments) {
                // One POI per valid line: keep coordinates and Lufop comment for device display.
                const longitude = lon_lat_comments[1];
                const latitude = lon_lat_comments[2];
                const comment = lon_lat_comments[3];

                const json = {
                    longitude: longitude.trim(),
                    latitude: latitude.trim(),
                    comment: unescapeCsv(comment.trim()),
                };

                this.parseInfo(json, entry);
            }
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
            // Défense en profondeur: on ne lit jamais un fichier hors du WORKSPACE,
            // même si une entrée non fiable avait franchi le filtre d'extraction.
            if (!isPathInside(WORKSPACE, entry.filename)) {
                console.error('[ERROR] chemin d\'entrée hors WORKSPACE, ignoré:', entry.filename);
                return this.getEntry();
            }

            const path = PATH.resolve(WORKSPACE, entry.filename);

            entry.path = path;

            return entry;
        }

        return null;
    }


    async getLastUpdateTimestamps() {
        // Source de vérité: l'en-tête HTTP Last-Modified du fichier RÉELLEMENT téléchargé
        // (SOURCE_URL). Choix délibéré: on ne scrape PLUS le HTML de la page (META_URL),
        // dont le libellé change régulièrement (ex: "Dernière Mise à jours ok le" ->
        // "Fichier du ..."), ce qui cassait silencieusement la datation. Le header décrit
        // le fichier lui-même: pas de dépendance à la mise en page, et date exacte du ZIP EU.
        // La date n'est qu'informative (datation des POI): tout échec -> [] (fallback amont).
        const options = {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0' },
        };

        try {
            const lastModified = await new Promise((resolve, reject) => {
                const req = HTTPS.request(SOURCE_URL, options, (response) => {
                    response.resume(); // draine/ignore le corps éventuel

                    if (200 !== response.statusCode) {
                        reject(new Error('HTTP ' + response.statusCode));
                        return;
                    }

                    resolve(response.headers['last-modified']);
                });

                req.on('error', reject);
                req.setTimeout(60000, () => req.destroy(new Error('timeout HEAD lufop')));
                req.end();
            });

            if (lastModified) {
                const timestamp = Math.round(new Date(lastModified).getTime() / 1000);

                if (Number.isFinite(timestamp) && timestamp > 0) {
                    return [ timestamp ];
                }
            }
        } catch (err) {
            console.warn('[WARN] lecture de Last-Modified sur ' + SOURCE_URL + ' échouée: ' + ((err && err.message) || err));
        }

        return [];
    }
}