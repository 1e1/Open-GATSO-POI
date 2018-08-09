const BUILD_DIRECTORY = 'BUILD';
const DOC_DIRECTORY = 'docs';
const README_FILENAME = 'readme.md';
const MANIFEST_FILENAME = 'manifest.txt';
const VERSION_FILENAME = 'version.txt';

const FS = require('fs');
const PATH = require('path');

const PROJECT_PATH = PATH.resolve(__dirname, '..');
const BUILD_PATH = PATH.resolve(PROJECT_PATH, BUILD_DIRECTORY);
const DOC_PATH = PATH.resolve(PROJECT_PATH, DOC_DIRECTORY);
const README_PATH = PATH.resolve(DOC_PATH, README_FILENAME);
const MANIFEST_PATH = PATH.resolve(BUILD_PATH, MANIFEST_FILENAME);
const VERSION_PATH = PATH.resolve(BUILD_PATH, VERSION_FILENAME);




String.prototype.replaceToken = function (name, content) {
    const tokenStart = `<!-- [${name}[ -->`;
    const tokenEnd = `<!-- ]${name}] -->`;
    const tokenStartLength = tokenStart.length;

    let start = this.length;
    let end = this.lastIndexOf(tokenEnd, start);

    if (-1 !== end) {
        start = this.lastIndexOf(tokenStart, end);

        if (-1 !== start) {
            return this.substring(0, start + tokenStartLength)
                .concat(content, this.substring(end));
        }
    }

    return this;
}



function getLastupdateDate(path) {
    const timestamp = FS.readFileSync(path);
    const date = new Date(timestamp * 1000);

    return date;
};

function createMatrix(path) {
    const matrix = {};
    const manifestContent = FS.readFileSync(path);
    const manifestLines = manifestContent.split(/\r?\n/);

    manifestLines.forEach(line => {
        if (0 < line.length) { 
            const matrix_entry = {};
            const [filename, counter, name] = line.split('/');
            const [shortname, countryString] = name.split(' - ');
            const countries = countryString.split(' ');

            countries.forEach(country => {
                matrix_entry[country] = parseInt(counter);
            });

            matrix[shortname] = matrix_entry;
        }
    });

    return matrix;
}

function getCounterSum(matrix) {
    let sum = 0;

    Object.values(matrix).forEach(entry => {
        sum += Object.values(entry)[0];
    });

    return sum;
}

function getCounters(matrix) {
    const counters = {};

    Object.values(matrix).forEach(entry => {
        Object.keys(entry).forEach(country => {
            const counter = entry[country];

            if (undefined === counters[country]) {
                counters[country] = counter;
            } else {
                counters[country] += counter;
            }
        });
    });

    return counters;
}

function getMatrixHTML(matrix) {
    const counters = getCounters(matrix);
    const countries = Object.keys(counters).sort();
    const shortnames = Object.keys(matrix);

    let thead = '<thead><tr><td></td>';
    let tfoot = '<thead><tr><td></td>';
    countries.forEach(country => {
        const counter = counters[country];

        thead += `<th>${country}</th>`;
        tfoot += `<th>${counter}</th>`;
    });
    thead += '<td></td></tr></thead>';
    tfoot += '<td></td></tr></thead>';

    let tbody = '<tbody>';
    shortnames.forEach(shortname => {
        const line = matrix[shortname];
        let counter = 0;

        tbody += `<tr><th>${shortname}</th>`;
        countries.forEach(country => {
            const _counter = line[country];

            if (undefined === _counter) {
                tbody += `<td></td>`;
            } else {
                tbody += `<td>✔︎</td>`;
                counter = _counter;
            }
        });

        tbody += `<th>${counter}</th></tr>`;
    });
    tbody += '</tbody>';


    const table = `<table>${thead}${tbody}${tfoot}</table>`;

    return table;
}

(async () => {
    const matrix = createMatrix(MANIFEST_PATH);
    const date = getLastupdateDate(VERSION_PATH);

    const amount = getCounterSum(matrix);
    const table = getMatrixHTML(matrix);

    let readme = FS.readFileSync(README_PATH, 'utf8');
    
    readme = readme
        .replaceToken('VERSION', date.toISOString())
        .replaceToken('AMOUNT', amount)
        .replaceToken('MATRIX', table)
        ;

    FS.writeFileSync(README_PATH, readme);

})();