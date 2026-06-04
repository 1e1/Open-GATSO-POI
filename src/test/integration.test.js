const test = require('node:test');
const assert = require('node:assert');
const FS = require('fs');
const OS = require('os');
const PATH = require('path');
const FileList = require('../modules/File/FileList.js');
const POI = require('../modules/POI.js');

// Exerce toute la chaîne d'écriture réelle (FileList -> FileMatrix -> Writers -> package),
// i.e. exactement les fichiers qui sont copiés sur la carte SD.
test('pipeline complet: point + tronçon -> fichiers SD cohérents', () => {
    const dir = FS.mkdtempSync(PATH.join(OS.tmpdir(), 'gatso-it-'));
    const basenames = ['GATSO_ALL'];
    const source = 'gatso-FR';

    try {
        const storage = FileList.from(dir, basenames);
        storage.open([source], ['csv', 'gpx', 'ov2']);

        const point = new POI().setCountry('FR').setCoordinates(2.35, 48.85)
            .setType('max').setRule('130').setDescription('Sud A6').setLastUpdateTimestamp(1700000000);
        const section = new POI().setCountry('FR')
            .setGeoJson([[2.30, 48.80], [2.32, 48.82], [2.34, 48.84]])
            .setType('average').setRule('130').setDescription('A6 Sud').setLastUpdateTimestamp(1700000100);

        storage.addPoint(source, point, basenames);
        storage.addPoint(source, section, basenames);
        storage.close();

        const gpx = FS.readFileSync(PATH.join(dir, 'GATSO_ALL.gpx'), 'utf8');
        const csv = FS.readFileSync(PATH.join(dir, 'GATSO_ALL.csv'), 'utf8');
        const ov2 = FS.readFileSync(PATH.join(dir, 'GATSO_ALL.ov2'));

        // GPX bien formé: en-tête <gpx>...</gpx>, 3 <wpt> (1 point + 2 pour le tronçon), AUCUN <trk>
        assert.ok(gpx.startsWith('<?xml'), 'en-tête XML');
        assert.ok(gpx.includes('<gpx '), 'balise gpx');
        assert.ok(gpx.trim().endsWith('</gpx>'), 'pied gpx');
        assert.strictEqual((gpx.match(/<wpt /g) || []).length, 3, '3 waypoints');
        assert.ok(!gpx.includes('<trk'), 'aucun track (importable garmin_gpi)');

        // CSV: 3 lignes (1 + 2), aucun préfixe de zone hérité
        const csvLines = csv.trim().split('\n');
        assert.strictEqual(csvLines.length, 3, '3 lignes CSV');
        assert.ok(!csv.includes(' ! ') && !csv.includes(' = '), 'pas de marqueur de zone');

        // OV2: 3 enregistrements 0x02, longueurs cohérentes (somme = taille fichier)
        let offset = 0;
        let records = 0;
        while (offset < ov2.length) {
            assert.strictEqual(ov2.readUInt8(offset), 0x02, 'type enregistrement OV2');
            const len = ov2.readUInt32LE(offset + 1);
            offset += len;
            records++;
        }
        assert.strictEqual(offset, ov2.length, 'enregistrements OV2 alignés sur la taille du fichier');
        assert.strictEqual(records, 3, '3 enregistrements OV2');
    } finally {
        FS.rmSync(dir, { recursive: true, force: true });
    }
});
