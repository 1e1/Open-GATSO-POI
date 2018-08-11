const BUILD_DIRECTORY = 'BUILD';
const MANIFEST_FILENAME = 'manifest.txt';
const VERSION_FILENAME = 'version.txt';
const UPDATE_FILENAMES = [ './index.html', './readme.md' ];

const FS = require('fs');
const PATH = require('path');

const PROJECT_PATH = PATH.resolve(__dirname, '..');
const BUILD_PATH = PATH.resolve(PROJECT_PATH, BUILD_DIRECTORY);
const MANIFEST_PATH = PATH.resolve(BUILD_PATH, MANIFEST_FILENAME);
const VERSION_PATH = PATH.resolve(BUILD_PATH, VERSION_FILENAME);
const UPDATE_PATHS = UPDATE_FILENAMES.map(filename => PATH.resolve(PROJECT_PATH, filename));




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
    const manifestLines = manifestContent.toString().split(/\r?\n/);

    manifestLines.forEach(line => {
        if (0 < line.length) { 
            const matrix_entry = {};
            const [filename, counter, name] = line.split('/');
            const [shortname, countryString] = name.split('| ');
            const countries = countryString.split(' ');
            const shortnameClean = shortname.replace(/^[^A-Za-z0-9]*/, '');

            countries.forEach(country => {
                matrix_entry[country] = parseInt(counter);
            });

            matrix[shortnameClean] = {
                counters: matrix_entry,
                filename: filename,
            };
        }
    });

    return matrix;
}

function getCounterSum(matrix) {
    let sum = 0;

    Object.values(matrix).forEach(entry => {
        sum += Object.values(entry.counters)[0];
    });

    return sum;
}

function getCounters(matrix) {
    const counters = {};

    Object.values(matrix).forEach(entry => {
        const countries = entry.counters;

        Object.keys(countries).forEach(country => {
            const counter = countries[country];

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
        const filename = line.filename;
        const img = `<img alt="${shortname}" src="./src/assets/img/${filename}_tn.png" />`;
        let counter = 0;

        tbody += `<tr><th nowrap>${img} ${shortname}</th>`;
        countries.forEach(country => {
            const _counter = line.counters[country];

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
    const dateISO = date.toISOString();

    const amount = getCounterSum(matrix);
    const table = getMatrixHTML(matrix);

    UPDATE_PATHS.forEach(path => {
        const input = FS.readFileSync(path, 'utf8');
        const output = input
            .replaceToken('VERSION', dateISO)
            .replaceToken('AMOUNT', amount)
            .replaceToken('MATRIX', table)
            ;
    
        FS.writeFileSync(path, output);

        console.log(`updated ${path} at ${dateISO}`);
    });
})();
