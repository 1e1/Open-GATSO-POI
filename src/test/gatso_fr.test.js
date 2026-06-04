const test = require('node:test');
const assert = require('node:assert');
const CrawlerGatsoFR = require('../modules/CNX_GATSO_FR.js');

const crawler = CrawlerGatsoFR.from({ addPoint() {} });

// Parse une ligne CSV via un storage stub qui capture le point émis.
function parseRow(line) {
    let captured = null;
    const c = CrawlerGatsoFR.from({ addPoint(code, point, basenames) { captured = { code, point, basenames }; } });
    c.parseRow(line);
    return captured;
}

// Format CSV officiel: Numéro;Type;Date;VMA;Latitude;Longitude

test('parseRow ETT (fixe) -> type max + carXX, coords normalisées [lng,lat]', () => {
    const got = parseRow('12345;ETT;31/10/2011 00:00;90;+45.361;+4.2526');
    assert.ok(got, 'un point doit être émis');
    assert.strictEqual(got.point.type, 'max');
    assert.strictEqual(got.point.rule, '90');
    assert.deepStrictEqual(got.point.geoJson, [[4.2526, 45.361]]); // [lng, lat]
    assert.ok(got.basenames.includes('GATSO_90'));
    assert.ok(got.basenames.includes('GATSO_speed_0'));
});

test('parseRow ETVM (vitesse moyenne / tronçon) -> type average, POINT unique', () => {
    const got = parseRow('12346;ETVM;01/01/2020 00:00;110;+46.0;+5.0');
    assert.strictEqual(got.point.type, 'average');
    assert.strictEqual(got.point.rule, '110');
    assert.strictEqual(got.point.geoJson.length, 1); // point unique -> plus de bug d'import tronçon
});

test('parseRow ETFR (feu rouge) -> type stop, basenames feu rouge, sans vitesse', () => {
    const got = parseRow('12347;ETFR;01/01/2020 00:00;NA;+48.85;+2.35');
    assert.strictEqual(got.point.type, 'stop');
    assert.strictEqual(got.point.rule, '');
    assert.ok(got.basenames.includes('GATSO_redlight_0'));
});

test('parseRow ETPN (passage à niveau) -> basenames voie ferrée', () => {
    const got = parseRow('12348;ETPN;01/01/2020 00:00;NA;+47.0;+1.0');
    assert.strictEqual(got.point.type, 'stop');
    assert.ok(got.basenames.includes('GATSO_railway_0'));
});

test('parseRow type inconnu -> ignoré proprement (aucun point, pas de crash)', () => {
    assert.strictEqual(parseRow('12349;ZZZ;01/01/2020 00:00;50;+47.0;+1.0'), null);
});

test('parseRow coordonnées invalides -> ignoré', () => {
    assert.strictEqual(parseRow('12350;ETF;01/01/2020 00:00;90;NA;NA'), null);
});

test('getCarRuleBySpeed (hérité de Crawler)', () => {
    assert.strictEqual(crawler.getCarRuleBySpeed('90').alert, 90);
    assert.strictEqual(crawler.getCarRuleBySpeed('200').alert, 130); // plafond
    assert.strictEqual(crawler.getCarRuleBySpeed('NA').alert, null);  // -> car générique
    assert.strictEqual(crawler.getCarRuleBySpeed('').alert, null);
});

test('parseServiceDate -> epoch secondes (et repli si format inattendu)', () => {
    assert.strictEqual(
        crawler.parseServiceDate('31/10/2011 00:00'),
        Math.floor(Date.parse('2011-10-31T00:00:00Z') / 1000),
    );
    const fb = crawler.parseServiceDate('???');
    assert.ok(Number.isFinite(fb) && fb > 1e9, 'repli en epoch secondes plausible');
});
