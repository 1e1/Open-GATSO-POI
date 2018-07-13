# Garmin Open GATSO

It aims Garmin GPS like them into VolksWagen, MAN, Skoda, Seat, etc. 


## installation

![VW website](./ScreenShot2018-07-09at18.23.50.png)
3 methods:

1. Copy SD_CARD
    - download the lastest `sd_image.img.zip` [on this page](https://github.com/1e1/Garmin-Open-GATSO/releases)
    - unzip it
    - burn it on a SD Card
    - insert the SD Card in your GPS
    - you should manually import the POI (see [howto for VW](#explanations)) 

2. Run POILoader to copy SD_CARD on a SD Card
    - download [Garmin POI Loader](https://www8.garmin.com/support/collection.jsp?product=999-99999-12)
    - download the lastest `all_files.zip` [on this page](https://github.com/1e1/Garmin-Open-GATSO/releases)
    - unzip it
    - run Garmin POI Loader and let the wizard lead you
    - insert the SD Card in your GPS

3. Go to website of your car (VW: Carnet) and add manually new POI
    - download the lastest `all_files.zip` [on this page](https://github.com/1e1/Garmin-Open-GATSO/releases)
    - unzip it
    - go to the website of your car maker
    - upload every CSV as new POIs
    - connect your car to the Internet
    - update your GPS


## usage

### first run

```bash
# git clone ...
cd ./src
npm install
./index_fr.js
```

### batch 

require cdrtools

```bash
./src/index_fr.js
mkisofs -o sd_image.iso SD_CARD
zip -r sd_image.iso.zip sd_image.iso
date +%Y-%m-%d
```


## documentation

### FR Speed Camera
REST service from:
* https://radars.securite-routiere.gouv.fr/radars/all?_format=json
* https://radars.securite-routiere.gouv.fr/radars/{id}?_format=json

### GFX tool
* draw icons 24x24 icons on https://www.piskelapp.com/
* export as animated GIF 
* get every frame: `$ convert -coalesce ./src/assets/New\ Piskel.gif  frame_%02d.bmp`

### CSV structure
* https://www8.garmin.com/products/poiloader/creating-custom-poi-files/ <- best doc! 
* http://www.poi-factory.com/garmin-csv-file-format

### Gamin POI Loader
* https://www8.garmin.com/support/collection.jsp?product=999-99999-12
* save image: `dd if=/dev/disk2 of=./sd_image.img`

### explanations

1. http://www.speedcamupdates.fr/volkswagen-discover-media-mib2-2017
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
