const test = require('node:test');
const assert = require('node:assert');
const POI = require('../modules/POI.js');
const Csv = require('../modules/File/Writer/Csv.js');
const Gpx = require('../modules/File/Writer/Gpx.js');
const Ov2 = require('../modules/File/Writer/Ov2.js');

function pointPOI() {
    return new POI().setCountry('FR').setCoordinates(2.35, 48.85)
        .setType('max').setRule('130').setDescription('Sud A6');
}

function sectionPOI() {
    return new POI().setCountry('FR')
        .setGeoJson([[2.30, 48.80], [2.32, 48.82], [2.34, 48.84]])
        .setType('average').setRule('130').setDescription('A6, sens Sud — péage');
}

test('CSV point unique: 1 ligne, échappement RFC', () => {
    const out = new Csv().convertToBuffer(pointPOI()).toString('utf8');
    assert.strictEqual(out, '2.35,48.85,"max @130","Sud A6"\n');
});

test('CSV tronçon: 2 lignes ponctuelles (début/fin), sans préfixe de zone', () => {
    const out = new Csv().convertToBuffer(sectionPOI()).toString('utf8');
    const lines = out.trim().split('\n');
    assert.strictEqual(lines.length, 2);
    assert.match(lines[0], /^2\.3,48\.8,"average @130","A6, sens Sud — péage \(début\)"$/);
    assert.match(lines[1], /^2\.34,48\.84,"average @130","A6, sens Sud — péage \(fin\)"$/);
    // plus aucun marqueur de zone hérité de l'ancien format
    assert.ok(!out.includes(' ! '));
    assert.ok(!out.includes(' = '));
});

test('GPX point: un <wpt>, jamais de <trk>', () => {
    const out = new Gpx().convertToBuffer(pointPOI()).toString('utf8');
    assert.ok(out.includes('<wpt '));
    assert.ok(!out.includes('<trk'));
});

test('GPX tronçon: 2 <wpt>, AUCUN <trk> (importable par garmin_gpi)', () => {
    const out = new Gpx().convertToBuffer(sectionPOI()).toString('utf8');
    const count = (out.match(/<wpt /g) || []).length;
    assert.strictEqual(count, 2);
    assert.ok(!out.includes('<trk'), 'pas de track');
    assert.ok(out.includes('(début)') && out.includes('(fin)'));
});

test('OV2: longueur d\'enregistrement comptée en OCTETS (titres multi-octets)', () => {
    const buf = new Ov2().convertToBuffer(sectionPOI());
    // 2 enregistrements concaténés; on relit le 1er.
    assert.strictEqual(buf.readUInt8(0), 0x02);
    const recLen = buf.readUInt32LE(1);
    // le 1er enregistrement = "average 130 (début)" ; 'é' compte 2 octets
    const title = 'average 130 (début)';
    assert.strictEqual(recLen, Buffer.byteLength(title, 'utf8') + 14);
    // octet nul de fin du 1er enregistrement
    assert.strictEqual(buf.readUInt8(recLen - 1), 0x00);
});
