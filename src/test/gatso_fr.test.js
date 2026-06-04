const test = require('node:test');
const assert = require('node:assert');
const CrawlerGatsoFR = require('../modules/CNX_GATSO_FR.js');

const crawler = new CrawlerGatsoFR();

test('getTypeById: tous les ids connus', () => {
    assert.strictEqual(crawler.getTypeById('1').display, 'stop');     // feux rouges
    assert.strictEqual(crawler.getTypeById('2').display, 'max');      // fixe
    assert.strictEqual(crawler.getTypeById('3').display, 'max');      // discriminant
    assert.strictEqual(crawler.getTypeById('16').display, 'stop');    // passage à niveau
    assert.strictEqual(crawler.getTypeById('18').display, 'average'); // vitesse moyenne
    assert.strictEqual(crawler.getTypeById('19').display, 'max');     // itinéraire
});

test('getTypeById: id inconnu -> null (toléré, n\'arrête pas le build)', () => {
    assert.strictEqual(crawler.getTypeById('999'), null);
    assert.strictEqual(crawler.getTypeById('20'), null); // nouveau type ajouté par l'API
});

test('getRuleById: ids connus -> bonnes limites', () => {
    assert.strictEqual(crawler.getRuleById('4').alert, 30);
    assert.strictEqual(crawler.getRuleById('5').alert, 50);
    assert.strictEqual(crawler.getRuleById('10').alert, 130);
    assert.strictEqual(crawler.getRuleById('15').type, 'redlight');
    assert.strictEqual(crawler.getRuleById('').type, 'unknown'); // empty
});

test('getRuleById: id inconnu -> null (toléré)', () => {
    assert.strictEqual(crawler.getRuleById('999'), null);
});

// --- Non-régression: nouveau schéma de l'API (champs en minuscules) ---
function parseWithStub(gatso, entry) {
    let captured = null;
    const stub = { addPoint(code, point, basenames) { captured = { code, point, basenames }; } };
    const c = CrawlerGatsoFR.from(stub);
    c.parseInfo(gatso, entry);
    return captured;
}

test('parseInfo: schéma minuscule (radartype/rulesmesured) -> point correct', () => {
    const got = parseWithStub(
        { radartype: [{ tid: '18' }], rulesmesured: [{ tid: '6' }],
          radardirection: 'A vers B', radarroad: 'D6', changed: '1760000000' },
        { geoJson: [[2.35, 48.85]] },
    );
    assert.ok(got, 'un point doit être émis');
    assert.strictEqual(got.point.type, 'average'); // tid 18 = Vitesse Moyenne
    assert.strictEqual(got.point.rule, '70');       // tid 6 = car70
    assert.ok(got.basenames.includes('GATSO_speed_0'));
});

test('parseInfo: type inconnu (tid 20) + champs absents -> pas de crash, fallback', () => {
    // radartype tid inconnu, rulesmesured absent -> doit retomber sur la règle "empty"
    const got = parseWithStub(
        { radartype: [{ tid: '20' }], radardirection: 'X', radarroad: '-', changed: '1760000000' },
        { geoJson: [[1.0, 47.0]] },
    );
    assert.ok(got, 'un point doit quand même être émis');
    assert.ok(got.basenames.includes('GATSO_ALL'));
});

test('parseList: geoJson itinéraire [lat,lng] -> normalisé en [lng,lat]', () => {
    const out = crawler.parseList([
        { id: 'X1', geoJson: [[46.18, 5.24], [46.19, 5.25]] }, // tracé fourni en [lat,lng]
        { id: 'X2', lng: 2.35, lat: 48.85 },                   // point unique
    ]);
    assert.deepStrictEqual(out[0].geoJson, [[5.24, 46.18], [5.25, 46.19]]);
    assert.deepStrictEqual(out[1].geoJson, [[2.35, 48.85]]);
});
