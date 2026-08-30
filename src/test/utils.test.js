const test = require('node:test');
const assert = require('node:assert');
const { format, flatten, unique, unescapeCsv, escapeCsv, escapeXml, escapeAttribute, isPathInside } = require('../modules/utils.js');

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

test('escapeCsv neutralise l\'injection de formule (CWE-1236)', () => {
    // un champ texte commençant par = + - @ est préfixé d'une apostrophe puis quoté
    assert.strictEqual(escapeCsv('=HYPERLINK("http://evil","x")'), '"\'=HYPERLINK(""http://evil"",""x"")"');
    assert.strictEqual(escapeCsv('+1+2'), '"\'+1+2"');
    assert.strictEqual(escapeCsv('-cmd|calc'), '"\'-cmd|calc"');
    assert.strictEqual(escapeCsv('@SUM(A1)'), '"\'@SUM(A1)"');
    // un texte ordinaire n'est pas modifié (hors guillemets)
    assert.strictEqual(escapeCsv('Fixe 90'), '"Fixe 90"');
});

test('isPathInside bloque le path-traversal / zip-slip', () => {
    assert.strictEqual(isPathInside('/tmp/work', 'FR.csv'), true);
    assert.strictEqual(isPathInside('/tmp/work', 'sub/FR.csv'), true);
    assert.strictEqual(isPathInside('/tmp/work', '../../etc/passwd'), false);
    assert.strictEqual(isPathInside('/tmp/work', '/etc/passwd'), false);
    assert.strictEqual(isPathInside('/tmp/work', 'a/../../../etc/passwd'), false);
    // '....' sont des noms de dossier littéraux: resolve ne les traite pas comme '..' -> reste dedans
    assert.strictEqual(isPathInside('/tmp/work', '....//x'), true);
});

test('unescapeCsv retire les guillemets entourants et déshabille les doublons', () => {
    assert.strictEqual(unescapeCsv('"abc"'), 'abc');
    assert.strictEqual(unescapeCsv('plain'), 'plain');
});

test('escapeXml encode les entités et n\'utilise pas de CDATA cassé', () => {
    assert.strictEqual(escapeXml('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
    assert.ok(!escapeXml('x').includes('CDATA'));
});

test('escapeXml retire les caractères de contrôle interdits en XML 1.0', () => {
    // NUL, BEL, etc. supprimés ; TAB/LF/CR conservés
    assert.strictEqual(escapeXml('a\x00b\x07c'), 'abc');
    assert.strictEqual(escapeXml('ligne1\tligne1\nligne2\r'), 'ligne1\tligne1\nligne2\r');
});

test('escapeAttribute encode aussi les guillemets', () => {
    assert.strictEqual(escapeAttribute('a "b" & <c>'), 'a &quot;b&quot; &amp; &lt;c&gt;');
});
