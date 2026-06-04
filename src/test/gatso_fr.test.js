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

test('getTypeById: id inconnu lève', () => {
    assert.throws(() => crawler.getTypeById('999'), /unknown type/);
});

test('getRuleById: ids connus -> bonnes limites', () => {
    assert.strictEqual(crawler.getRuleById('4').alert, 30);
    assert.strictEqual(crawler.getRuleById('5').alert, 50);
    assert.strictEqual(crawler.getRuleById('10').alert, 130);
    assert.strictEqual(crawler.getRuleById('15').type, 'redlight');
    assert.strictEqual(crawler.getRuleById('').type, 'unknown'); // empty
});

test('getRuleById: id inconnu lève', () => {
    assert.throws(() => crawler.getRuleById('999'), /unknown rule/);
});
