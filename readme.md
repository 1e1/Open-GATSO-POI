# Open GATSO

It gives a set of speed cameras on the EU. 

![preview](./readme.img/map.png)

* GPX (accurate)
    - Garmin (embeded into VolksWagen, MAN, Skoda, Seat, etc.)
    - Mercedes
    - Volvo
* CSV (verbose): 
    - Garmin (embeded into VolksWagen, MAN, Skoda, Seat, etc.)
    - Navman
* OV2 (minimalist):
    - TomTom (embeded into Fiat, Peugeot, etc.)


## installation

![VW website](./readme.img/ScreenShot2018-08-01at11.10.13.png)
3 methods:

1. Quick (on SD Card)
    - download the lastest [⤓](https://github.com/1e1/Garmin-Open-GATSO/releases/download/travis_master/sd_image.iso.zip)`sd_image.iso.zip` from the [releases page](https://github.com/1e1/Garmin-Open-GATSO/releases)
    - unzip it
    - burn it on a SD Card
    - insert the SD Card in your GPS
    - you should manually import the POI (see [howto for VW](#explanations)) 

2. Official on SD Card
    - download the lastest [⤓](https://github.com/1e1/Garmin-Open-GATSO/releases/download/travis_master/all_files.zip)`all_files.zip` from the [releases page](https://github.com/1e1/Garmin-Open-GATSO/releases)
    - unzip it
    - download [Garmin POI Loader](https://www8.garmin.com/support/collection.jsp?product=999-99999-12)
    - run Garmin POI Loader and let the wizard lead you
    - insert the SD Card in your GPS
    - you should manually import the POI (see [howto for VW](#explanations)) 

3. Official online
    - download the lastest [⤓](https://github.com/1e1/Garmin-Open-GATSO/releases/download/travis_master/all_files.zip)`all_files.zip` from the [releases page](https://github.com/1e1/Garmin-Open-GATSO/releases)
    - unzip it
    - go to the website of your car maker (eg VW: https://www.volkswagen-car-net.com) (please, contact me for others links)
    - upload every CSV as new POIs
    - connect your car to the Internet
    - update your GPS


## DIY usage

### first run

```bash
# git clone ...
cd ./src
npm install
# export only csv and gpx
node ./index.js csv gpx
```

### batch 

require [cdrtools](http://cdrtools.sourceforge.net/private/cdrecord.html) and [mypois](https://github.com/jimmyH/mypois)

```bash
# get latest GATSO
node ./src/index.js csv
# append headers to CSV
./csv_h.sh
# make SD_CARD structure
python ./mypois-master/mypois.py ./config.ini
# create disk image
mkisofs -o sd_image.iso SD_CARD
# archive it
zip -r sd_image.iso.zip sd_image.iso
```


## documentation

### Speed Camera
REST service from:
* https://radars.securite-routiere.gouv.fr/radars/all?_format=json
* https://radars.securite-routiere.gouv.fr/radars/{id}?_format=json
* https://lufop.net/wp-content/plugins/downloads-manager/upload/Lufop-Zones-de-danger-EU-CSV.zip

### GFX tool
* draw icons 24x24 icons on https://www.piskelapp.com/
* export as animated GIF 
* get every frame: `$ convert -coalesce ./src/assets/New\ Piskel.gif  frame_%02d.bmp`

### CSV structure
* https://www8.garmin.com/products/poiloader/creating-custom-poi-files/ <- best doc! 
* http://www.poi-factory.com/garmin-csv-file-format
* https://www.poieditor.com/poi_convert/garmin-csv-to-ov2/

### Gamin POI Loader
* https://www8.garmin.com/support/collection.jsp?product=999-99999-12
* save image: `dd if=/dev/disk2 of=./sd_image.img`

### TomTom POI ov2
* https://www.tomtom.com/lib/doc/ttnavsdk3_manual.pdf

### explanations

#### VW Discover Media

> - press the **NAV** button
> - insert the SD Card into the second card connector of your GPS
> - select *Configuration*
> - select *Gérer la mémoire*
> - select *Mise à jour my POI*
> - waiting for *Logiciel de mise à jour disponible* then press *mise à jour* then press *suivant*
> - while it terminated, press the **NAV** button
> - select *Carte*
> - select *Afficher les POI*
> - select *Afficher les catégories*
> - scroll down to GATSO and check which POI you want
> - enjoy

#### others

[SpeedCamUpdates](http://www.speedcamupdates.fr) helps for a lot of configurations

---

![Travis CI](https://api.travis-ci.org/1e1/Garmin-Open-GATSO.svg?branch=master)