module.exports = class POI {

    constructor() {
        this.country = '';
        this.geoJson = [];
        this.type = '';
        this.rule = '';
        this.description = '',
        // Secondes Unix, comme les valeurs posées ensuite par les crawlers
        // (gatso.changed, timestamp/1000). Évite un défaut en millisecondes incohérent.
        this.lastUpdateTimestamp = Math.floor(Date.now() / 1000);
    }

    setCountry(country) {
        this.country = country;

        return this;
    }

    setCoordinates(longitude, latitude) {
        this.geoJson = [[longitude, latitude]];

        return this;
    }

    addCoordinates(longitude, latitude) {
        this.geoJson.push([longitude, latitude]);

        return this;
    }

    setGeoJson(geoJson) {
        this.geoJson = geoJson;

        return this;
    }

    setType(type) {
        this.type = type.trim();

        return this;
    }

    setRule(rule) {
        this.rule = rule.trim();

        return this;
    }

    setDescription(description) {
        this.description = description.trim();

        return this;
    }

    setLastUpdateTimestamp(timestamp) {
        this.lastUpdateTimestamp = timestamp;

        return this;
    }

    /**
     * Décompose le POI en points ponctuels à écrire (waypoints).
     * - 0 sommet  -> aucun point.
     * - 1 sommet  -> un point simple.
     * - N sommets (tronçon / itinéraire) -> deux points: début + fin de la zone.
     *   Cela garantit un import propre côté MIB (mypois/CSV) et Garmin (garmin_gpi,
     *   qui ignore les <trk>), là où l'ancien format polyligne (zone/track) cassait.
     * Chaque point porte un `suffix` de description (' (début)' / ' (fin)' / '').
     */
    getRenderPoints() {
        const points = this.geoJson;

        if (0 === points.length) {
            return [];
        }

        if (1 === points.length) {
            return [{ longitude: points[0][0], latitude: points[0][1], suffix: '' }];
        }

        const first = points[0];
        const last = points[points.length - 1];

        if (first[0] === last[0] && first[1] === last[1]) {
            return [{ longitude: first[0], latitude: first[1], suffix: '' }];
        }

        return [
            { longitude: first[0], latitude: first[1], suffix: ' (début)' },
            { longitude: last[0], latitude: last[1], suffix: ' (fin)' },
        ];
    }

    toString() {
        const geoJson = this.geoJson.map(ll=>ll.join(',')).join('|');

        return this.type + ' ' + this.rule + ' (' + this.description + ') ' + geoJson;
    }
}