# Draft France-Radars

A first offline try to add French GATSO. 
It aims Garmin GPS like them into VW, MAN, Skoda, Seat, etc. 


## Usage

![VW website](./ScreenShot2018-07-09at18.23.50.png)
* Go to website of your car (VW: Carnet) and add manually new POI. 
* Run POILoader to copy SD_CARD on a SD Card. 


## documentation

### FR Speed Camera
REST service from:
* https://radars.securite-routiere.gouv.fr/radars/all?_format=json
* https://radars.securite-routiere.gouv.fr/radars/{id}?_format=json

### GFX tool
* https://www.piskelapp.com/
* export as animated GIF 
* get every frame: `$ convert -coalesce ./src/assets/New\ Piskel.gif  out%05d.bmp`

### CSV structure
* http://www.poi-factory.com/garmin-csv-file-format
* https://www8.garmin.com/products/poiloader/creating-custom-poi-files/

### Gamin POI Loader
* https://www8.garmin.com/support/collection.jsp?product=999-99999-12

