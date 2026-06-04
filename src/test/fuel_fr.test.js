const test = require('node:test');
const assert = require('node:assert');
const CrawlerFuelFR = require('../modules/CNX_FUEL_FR.js');

const crawler = new CrawlerFuelFR();

test('getServiceByGas: carburants de l\'open-data', () => {
    assert.strictEqual(crawler.getServiceByGas('Gazole').type, 'gazo');
    assert.strictEqual(crawler.getServiceByGas('SP95').type, 'sp95');
    assert.strictEqual(crawler.getServiceByGas('SP98').type, 'sp98');
    assert.strictEqual(crawler.getServiceByGas('E10').type, 'e10');
    assert.strictEqual(crawler.getServiceByGas('E85').type, 'e85');
    assert.strictEqual(crawler.getServiceByGas('GPLc').type, 'gpl'); // synonyme
});

test('getServiceByGas: carburants déclarés en config désormais atteignables', () => {
    // b7/b10/xtl/e5/lng/h2 existaient dans config.js mais n\'étaient jamais mappés
    assert.strictEqual(crawler.getServiceByGas('B7').type, 'b7');
    assert.strictEqual(crawler.getServiceByGas('H2').type, 'h2');
});

test('REGRESSION: carburant inconnu -> null, sans ReferenceError ni crash', () => {
    assert.doesNotThrow(() => crawler.getServiceByGas('CARBURANT_DU_FUTUR'));
    assert.strictEqual(crawler.getServiceByGas('CARBURANT_DU_FUTUR'), null);
});

test('getServiceByService: services connus et inconnu', () => {
    assert.strictEqual(crawler.getServiceByService('Station de gonflage').type, 'tyre');
    assert.strictEqual(crawler.getServiceByService('Bornes électriques').type, 'elec');
    assert.strictEqual(crawler.getServiceByService('GNV').type, 'gnv');
    assert.strictEqual(crawler.getServiceByService('inconnu'), null);
});
