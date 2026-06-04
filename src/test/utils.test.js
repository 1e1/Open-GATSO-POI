const test = require('node:test');
const assert = require('node:assert');
const { format, flatten, unique, unescapeCsv, escapeCsv, escapeXml, escapeAttribute } = require('../modules/utils.js');

test('format remplace les jetons {clé}', () => {
    assert.strictEqual(format('/radars/{id}?_format=json', { id: 42 }), '/radars/42?_format=json');
    assert.strictEqual(format('{a}-{b}', { a: 'x', b: 'y' }), 'x-y');
});

test('flatten aplatit un niveau', () => {
    assert.deepStrictEqual(flatten([['a', 'b'], ['c'], []]), ['a', 'b', 'c']);
});

test('unique déduplique en conservant l\'ordre', () => {
    assert.deepStrictEqual(unique(['a', 'b', 'a', 'c', 'b']), ['a', 'b', 'c']);
});

test('escapeCsv suit RFC 4180 (guillemets doublés, pas backslash)', () => {
    assert.strictEqual(escapeCsv('Sud A6'), '"Sud A6"');
    assert.strictEqual(escapeCsv('A6, sens Sud'), '"A6, sens Sud"');
    // un guillemet interne doit être DOUBLÉ, pas échappé en \"
    assert.strictEqual(escapeCsv('rue "du" centre'), '"rue ""du"" centre"');
    assert.ok(!escapeCsv('rue "du" centre').includes('\\"'));
});

test('unescapeCsv retire les guillemets entourants et déshabille les doublons', () => {
    assert.strictEqual(unescapeCsv('"abc"'), 'abc');
    assert.strictEqual(unescapeCsv('plain'), 'plain');
});

test('escapeXml encode les entités et n\'utilise pas de CDATA cassé', () => {
    assert.strictEqual(escapeXml('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
    assert.ok(!escapeXml('x').includes('CDATA'));
});

test('escapeAttribute encode aussi les guillemets', () => {
    assert.strictEqual(escapeAttribute('a "b" & <c>'), 'a &quot;b&quot; &amp; &lt;c&gt;');
});
