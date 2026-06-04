// Helpers partagés, importés explicitement.
// Remplace l'ancien monkey-patching de String.prototype / Array.prototype
// (qui était dispersé sur Launcher.js, Writer.js et CNX_GATSO_EU.js et
//  dépendait de l'ordre de require).

/** Remplace {clé} par opts[clé] dans un template. */
function format(template, opts) {
    return template.replace(/\{([^\}]+)\}/g, (match, name) => opts[name]);
}

/** Aplatit un tableau de tableaux d'un seul niveau (ex-Array.prototype.concatInside). */
function flatten(arrays) {
    return [].concat.apply([], arrays);
}

/** Déduplique un tableau en conservant l'ordre (ex-Array.prototype.unique). */
function unique(array) {
    return array.filter((value, index, self) => self.indexOf(value) === index);
}

/** Retire les guillemets entourants d'un champ CSV et déséchappe les guillemets répétés. */
function unescapeCsv(value) {
    const firstChar = value.charAt(0);

    if (['"', "'"].includes(firstChar)) {
        const pattern = new RegExp('\\' + firstChar, 'g');
        const patternLeft = new RegExp('^' + firstChar + '*', 'g');
        const patternRight = new RegExp(firstChar + '*$', 'g');

        return value
            .replace(patternLeft, '')
            .replace(patternRight, '')
            .replace(pattern, firstChar);
    }

    return value;
}

/** Échappe un champ CSV selon RFC 4180 : guillemets internes doublés, champ toujours quoté. */
function escapeCsv(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
}

/** Échappe un texte destiné au contenu d'un élément XML. */
function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Échappe une valeur d'attribut XML (guillemets compris). */
function escapeAttribute(value) {
    return escapeXml(value).replace(/"/g, '&quot;');
}

module.exports = { format, flatten, unique, unescapeCsv, escapeCsv, escapeXml, escapeAttribute };
