const test = require('node:test');
const assert = require('node:assert');
const CrawlerGatsoEU = require('../modules/CNX_GATSO_EU.js');

const crawler = new CrawlerGatsoEU();

test('getCarRuleBySpeed: vitesses connues', () => {
    assert.strictEqual(crawler.getCarRuleBySpeed(30).alert, 30);
    assert.strictEqual(crawler.getCarRuleBySpeed('50').alert, 50);
    assert.strictEqual(crawler.getCarRuleBySpeed(130).alert, 130);
});

test('getCarRuleBySpeed: > 130 plafonné à car130', () => {
    assert.strictEqual(crawler.getCarRuleBySpeed(200).alert, 130);
});

test('getCarRuleBySpeed: inconnu/invalide -> car générique (alert null)', () => {
    assert.strictEqual(crawler.getCarRuleBySpeed(25).alert, null);
    assert.strictEqual(crawler.getCarRuleBySpeed(null).alert, null);
    assert.strictEqual(crawler.getCarRuleBySpeed('').alert, null);
    assert.strictEqual(crawler.getCarRuleBySpeed('abc').alert, null);
});

test('getTypeByEntry: types connus', () => {
    assert.strictEqual(crawler.getTypeByEntry({ type: 'fixe' }).display, 'max');
    assert.strictEqual(crawler.getTypeByEntry({ type: 'troncondebut' }).display, 'max');
    assert.strictEqual(crawler.getTypeByEntry({ type: 'feurouge' }).display, 'stop');
    assert.strictEqual(crawler.getTypeByEntry({ type: 'tunnel' }).display, 'tunnel');
    assert.strictEqual(crawler.getTypeByEntry({ type: 'passageniveau' }).display, 'stop');
});

test('getRuleByEntry: règles connues', () => {
    assert.strictEqual(crawler.getRuleByEntry({ type: 'fixe' }, '90').alert, 90);
    assert.strictEqual(crawler.getRuleByEntry({ type: 'troncondebut' }, '130').alert, 130);
    assert.strictEqual(crawler.getRuleByEntry({ type: 'mobile' }).type, 'unknown'); // empty
    assert.strictEqual(crawler.getRuleByEntry({ type: 'feurouge' }).type, 'redlight');
});

test('getTypeByEntry: type inconnu lève', () => {
    assert.throws(() => crawler.getTypeByEntry({ type: 'ovni' }), /unknown type/);
});
