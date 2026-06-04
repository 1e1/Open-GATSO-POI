const test = require('node:test');
const assert = require('node:assert');
const POI = require('../modules/POI.js');

test('timestamp par défaut en secondes Unix (pas en millisecondes)', () => {
    const p = new POI();
    const nowSec = Math.floor(Date.now() / 1000);
    // doit être proche de "maintenant" en secondes (et donc PAS en ms, qui serait ~1e3 plus grand)
    assert.ok(Math.abs(p.lastUpdateTimestamp - nowSec) < 5, 'timestamp ~ secondes');
    assert.ok(p.lastUpdateTimestamp < 1e11, 'pas en millisecondes');
});

test('getRenderPoints: point unique', () => {
    const p = new POI().setCoordinates(2.35, 48.85);
    assert.deepStrictEqual(p.getRenderPoints(), [
        { longitude: 2.35, latitude: 48.85, suffix: '' },
    ]);
});

test('getRenderPoints: tronçon -> début + fin (entrée + sortie)', () => {
    const p = new POI().setGeoJson([[2.30, 48.80], [2.32, 48.82], [2.34, 48.84]]);
    const rp = p.getRenderPoints();
    assert.strictEqual(rp.length, 2);
    assert.deepStrictEqual(rp[0], { longitude: 2.30, latitude: 48.80, suffix: ' (début)' });
    assert.deepStrictEqual(rp[1], { longitude: 2.34, latitude: 48.84, suffix: ' (fin)' });
});

test('getRenderPoints: tronçon dégénéré (début == fin) -> un seul point', () => {
    const p = new POI().setGeoJson([[2.30, 48.80], [2.30, 48.80]]);
    assert.deepStrictEqual(p.getRenderPoints(), [
        { longitude: 2.30, latitude: 48.80, suffix: '' },
    ]);
});

test('getRenderPoints: géométrie vide -> aucun point', () => {
    const p = new POI();
    assert.deepStrictEqual(p.getRenderPoints(), []);
});
