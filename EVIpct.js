var geometry = /* color: #0b4a8b */ee.Geometry.Point([-83.40733422448726, 9.813071375868239]),
    world = ee.FeatureCollection("FAO/GAUL/2015/level0");

//import latest Landsat 8 data (GEE often update data source)
var L8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");

//select study area

var country = world.filterMetadata('ADM0_NAME', 'equals', 'Costa Rica');

// EVI2 Expressions
var f_evi = '2.5 * ((nir - red) / (nir + 2.4 * red + 1))';// # EVI2 formula (two-band version)

// VegIndex calculator. Calculate the EVI2 index (two-band versiob)
// # https://www.usgs.gov/faqs/how-do-i-use-a-scale-factor-landsat-level-2-science-products?qt-news_science_products=0#qt-news_science_products
// # band names were updated
function calcIndex(image) {
    var evi = image.expression(
      f_evi,
        {
          'red': image.select('SR_B4').multiply(0.0000275).subtract(0.2), //#RED; applied scale and offset
          'nir': image.select('SR_B5').multiply(0.0000275).subtract(0.2) //#NIR; applied scale and offset
         });
    return image.addBands((evi.rename('EVI2')).multiply(10000).int16());
}


// # Function to mask clouds in Landsat imagery
// # need updated if data scource got updated including band names and bits
function maskClouds(image) {
  //# bit positions: find by raising 2 to the bit flag code
    var cloudBit = Math.pow(2, 3);
    var shadowBit = Math.pow(2, 4);
    var snowBit = Math.pow(2, 5);
    var fillBit = Math.pow(2,0);
    //# extract pixel quality band
    var qa = image.select('QA_PIXEL');
    //# create and apply mask
    var mask = qa.bitwiseAnd(cloudBit).eq(0).and(
              qa.bitwiseAnd(shadowBit).eq(0)).and(
              qa.bitwiseAnd(snowBit).eq(0)).and(
              qa.bitwiseAnd(fillBit).eq(0));
    return image.updateMask(mask);
}

// Function to mask excess EVI2 values defined as > 10000 and < 0
function  maskExcess(image) {
    var hi = image.lte(10000);
    var lo = image.gte(0);
    var masked = image.mask(hi.and(lo));
    return image.mask(masked);
}



//14-19
for (var year=2019; year<=2019; year++) {
  var start_date = String(year)+'-01-01';
  var end_date = String(year)+'-12-31';

    var landsat = L8.filter(ee.Filter.date(start_date, end_date))
                          .map(maskClouds).filterBounds(country);

    var landsat_evi2 = landsat.map(calcIndex).map(maskExcess).select('EVI2');

    var landsat_jan_mar = L8.filter(ee.Filter.date(String(year)+'-01-01', String(year)+'-03-31'))
                          .filterBounds(country);


    for (var p=1; p<=50; p+=10) {
      var evi2_min = (landsat_evi2.reduce(ee.Reducer.percentile([p])));
      Map.addLayer(
        evi2_min,
        {
          min: 0,
          max: 10000,
          palette: ['blue', 'yellow', 'green']
        },
        String(year) + ' percentile: ' + String(p));
      var evi_desc = 'evi2_' + String(p) + '_percentile';
      Export.image.toCloudStorage({
        image: evi2_min,
        description: evi_desc,
        'bucket': 'ecoshard-root',
        fileNamePrefix: 'gee_export/'+ evi_desc,
        crs: "EPSG:4326",
        scale: 30,
        maxPixels: 1e13,
        region: country.geometry()});
      var stats = evi2_min.reduceRegions({
        collection: geometry,
        reducer: ee.Reducer.median(),
        scale: 30
      });
    }
  // Applies scaling factors.
  function applyScaleFactors(image) {
    var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
    var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
    return image.addBands(opticalBands, null, true)
                .addBands(thermalBands, null, true);
  }

  landsat_jan_mar = landsat_jan_mar.map(applyScaleFactors);

  var landsat_vis = {
    bands: ['SR_B4', 'SR_B3', 'SR_B2'],
    min: 0.0,
    max: 0.3,
  };

    Map.addLayer(landsat_jan_mar, landsat_vis, 'True Color '+String(year));


  print(stats.first().get('median'));
}

//Export.image.toCloudStorage({
//  image: landsat_jan_mar,
//  description: 'landsat_jan_mar',
//  'bucket': 'ecoshard-root',
//  fileNamePrefix: 'gee_export/'+'landsat_jan_mar',
//  crs: "EPSG:4326",
//  scale: 30,
//  maxPixels: 1e13,
//  region: country.geometry()});
