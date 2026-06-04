// Source: jeu de données officiel "Liste des radars fixes en France" (Ministère de l'intérieur),
// publié sur data.gouv.fr (CDN static.data.gouv.fr) au format CSV. Un seul téléchargement
// remplace l'ancien crawl radar-par-radar de radars.securite-routiere.gouv.fr (qui était
// rejeté par le WAF gouv depuis un runner CI). Les radars y sont des POINTS uniques
// (y compris les vitesses moyennes / tronçons) : plus de géométrie polyligne.
const DATASET_API = 'https://www.data.gouv.fr/api/1/datasets/liste-des-radars-fixes-en-france/';
// Permalink stable de repli (redirige vers le CSV courant) si l'API est indisponible.
const FALLBACK_CSV_URL = 'https://www.data.gouv.fr/fr/datasets/r/17f7cfd9-a5fe-4b6a-9f5d-3625feaa396e';

const FS = require('fs');
const HTTPS = require('https');
const CRAWLER = require('./Crawler.js');
const POINT = require('./POI.js');

const COUNTRY_CODE = 'FR';
const REQUEST_RETRY = 5;
const WAITING_TIME_ON_ERROR = 5000;
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// "Type de radar" (CSV) -> type d'affichage (config.types) + règle.
// rule:'speed' => règle carXX dérivée de la VMA ; sinon nom direct dans config.rules.
const TYPE_MAP = {
    ETF:  { type: 'instant_speed',       rule: 'speed' },         // fixe classique
    ETT:  { type: 'instant_speed',       rule: 'speed' },         // tourelle / nouvelle génération
    ETU:  { type: 'instant_speed',       rule: 'speed' },         // urbain
    ETD:  { type: 'multi_instant_speed', rule: 'speed' },         // discriminant
    ETVM: { type: 'average_speed',       rule: 'speed' },         // vitesse moyenne (tronçon, rendu en point)
    ETFR: { type: 'traffic_light',       rule: 'traffic_light' }, // franchissement de feu rouge
    ETPN: { type: 'railroad',            rule: 'railroad' },      // passage à niveau
};


module.exports = class CrawlerGatsoFR extends CRAWLER {

    getCode() {
        return 'gatso-FR';
    }

    async prepare() {
        const csv_path = this.options.cache + '.csv';

        if (!FS.existsSync(csv_path)) {
            const url = await this.resolveCsvUrl();

            await this.download(url, csv_path);
        }

        this.csvPath = csv_path;
    }

    async start() {
        const content = FS.readFileSync(this.csvPath, 'latin1');
        const lines = content.split(/\r?\n/);

        lines.shift(); // en-tête: Numéro;Type;Date;VMA;Latitude;Longitude

        lines.forEach(line => {
            if ('' !== line.trim()) {
                this.parseRow(line);
            }
        });
    }


    // ---


    parseRow(line) {
        const cols = line.split(';');

        if (cols.length < 6) {
            return;
        }

        const typeCode = (cols[1] || '').trim().toUpperCase();
        const map = TYPE_MAP[typeCode];

        if (undefined === map) {
            // Nouveau code de type non répertorié: ignoré proprement (ne bloque pas le build).
            console.log(this.getCode() + ' type radar inconnu ignoré: ' + typeCode);
            return;
        }

        const latitude = parseFloat(cols[4]);
        const longitude = parseFloat(cols[5]);

        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return; // coordonnées inexploitables: on saute
        }

        const vma = (cols[3] || '').trim();
        const typeRef = this.getType(map.type);
        const ruleRef = ('speed' === map.rule) ? this.getCarRuleBySpeed(vma) : this.getRule(map.rule);

        const displayType = this.displayTypesToString([typeRef.display]);
        const displayRule = this.displayRulesToString(
            (null !== ruleRef.alert && undefined !== ruleRef.alert) ? [ruleRef.alert] : []
        );

        const timestamp = this.parseServiceDate((cols[2] || '').trim());

        const point = new POINT();

        point
            .setCountry(COUNTRY_CODE)
            .setCoordinates(longitude, latitude)
            .setType(displayType)
            .setRule(displayRule)
            .setDescription(typeRef.label)
            .setLastUpdateTimestamp(timestamp)
            ;

        this.storage.addPoint(this.getCode(), point, ruleRef.basenames);
        this.addTimestamp(timestamp);
    }

    // "31/10/2011 00:00" -> epoch secondes ; repli heure courante si format inattendu.
    parseServiceDate(value) {
        const m = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);

        if (null !== m) {
            const t = Date.parse(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);

            if (!Number.isNaN(t)) {
                return Math.floor(t / 1000);
            }
        }

        return Math.floor(Date.now() / 1000);
    }


    // --- réseau ---


    // Résout l'URL du CSV le plus récent via l'API data.gouv.fr ; repli sur le permalink stable.
    async resolveCsvUrl() {
        try {
            const meta = JSON.parse(await this.httpGet(DATASET_API));
            const csvs = (meta.resources || [])
                .filter(r => 'csv' === String(r.format).toLowerCase() && r.url)
                .sort((a, b) => String(b.last_modified).localeCompare(String(a.last_modified)));

            if (0 < csvs.length) {
                return csvs[0].url;
            }
        } catch (err) {
            console.error('[ERROR] résolution dataset data.gouv.fr:', (err && err.message) || err);
        }

        console.log(this.getCode() + ' repli sur le permalink CSV stable');
        return FALLBACK_CSV_URL;
    }

    async download(url, dest) {
        let retryLeft = REQUEST_RETRY;
        let ok = false;

        while (0 < retryLeft && !ok) {
            console.log(this.getCode() + ' ' + url + ' #' + (1 + REQUEST_RETRY - retryLeft));

            try {
                await this.downloadToFile(url, dest);
                ok = true;
            } catch (err) {
                console.error('[ERROR]', (err && err.message) || err);
                retryLeft--;

                if (0 < retryLeft) {
                    await this.sleep(WAITING_TIME_ON_ERROR);
                }
            }
        }

        if (!ok) {
            throw `can not get ${url}`;
        }
    }

    // Téléchargement en flux (préserve l'encodage latin1) avec suivi des redirections.
    downloadToFile(url, dest) {
        return new Promise((resolve, reject) => {
            const get = (target, redirectsLeft) => {
                const options = { headers: { 'User-Agent': USER_AGENT } };
                const req = HTTPS.get(target, options, (response) => {
                    const status = response.statusCode;

                    if ([301, 302, 303, 307, 308].includes(status) && response.headers.location && 0 < redirectsLeft) {
                        response.resume();
                        return get(new URL(response.headers.location, target).toString(), redirectsLeft - 1);
                    }

                    if (200 !== status) {
                        response.resume();
                        return reject(new Error('status: ' + status));
                    }

                    const file = FS.createWriteStream(dest);
                    file.on('error', reject);
                    response.on('error', reject);
                    response.pipe(file).on('close', resolve);
                });

                req.on('error', reject);
                req.setTimeout(60000, () => req.destroy(new Error('timeout ' + target)));
            };

            get(url, 5);
        });
    }

    // GET texte (API JSON data.gouv.fr) avec suivi des redirections.
    httpGet(url) {
        return new Promise((resolve, reject) => {
            const options = { headers: { 'User-Agent': USER_AGENT } };
            const req = HTTPS.get(url, options, (response) => {
                const status = response.statusCode;

                if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
                    response.resume();
                    return resolve(this.httpGet(new URL(response.headers.location, url).toString()));
                }

                if (200 !== status) {
                    response.resume();
                    return reject(new Error('status: ' + status));
                }

                let data = '';
                response.on('data', (chunk) => { data += chunk; });
                response.on('end', () => resolve(data));
            });

            req.on('error', reject);
            req.setTimeout(60000, () => req.destroy(new Error('timeout ' + url)));
        });
    }
}
