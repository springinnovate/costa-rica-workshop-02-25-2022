var world = ee.FeatureCollection("FAO/GAUL/2015/level0"),
    L8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
    geometry = /* color: #00ffff */ee.Geometry.Point([-83.49536956690598, 9.46957612864495]);



var year = 2019;
var percentile = 20;
// var lambda1 = 0.001;
// var alpha1 = 1;
// var lambda1 = 0.01;
// var alpha1 = 2;
var lambda1 = 0.1;
var alpha1 = 5;


//select study area

var world = ee.FeatureCollection("FAO/GAUL/2015/level0");
var country = world.filterMetadata('ADM0_NAME', 'equals', 'Costa Rica');

function calc_evi2(image) {
    var evi = image.expression(
      '2.5 * ((nir - red) / (nir + 2.4 * red + 1))',
        {
          'red': image.select('SR_B4').multiply(0.0000275).subtract(0.2), //#RED; applied scale and offset
          'nir': image.select('SR_B5').multiply(0.0000275).subtract(0.2) //#NIR; applied scale and offset
         });
    return evi.rename('EVI2');
}

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

// Function to mask values >1 or <0
function  maskExcess(image) {
    var hi = image.lte(1);
    var lo = image.gte(0);
    var masked = image.mask(hi.and(lo));
    return image.mask(masked);
}

var landsat = L8.filter(ee.Filter.date(String(year)+'-01-01', String(year)+'-12-31'))
  .map(maskClouds)
  .filterBounds(country);

var landsat_evi2 = landsat
  .map(calc_evi2)
  .map(maskExcess)
  .select('EVI2');

var evi2_percentile_reduced = (landsat_evi2.reduce(ee.Reducer.percentile([percentile])));
var evi2_percentile_label = 'EVI2_' + String(year) + '_percentile_' + String(percentile);
Map.addLayer(
  evi2_percentile_reduced,
  {
    min: 0,
    max: 1,
    palette: ['blue', 'yellow', 'green']
  },
  evi2_percentile_label);

function c_factor(evi_image, lambda, alpha) {
  var c_factor_image = ee.Image(lambda).pow(evi_image.multiply(alpha))
    .multiply(ee.Image(-lambda).exp());
  return c_factor_image;
}

var c_factor_image = c_factor(evi2_percentile_reduced, lambda1, alpha1);
var c_factor_image_label = 'C_Factor_' + String(year) + '_percentile_' + String(percentile);
Map.addLayer(
  c_factor_image,
  {
    min: 0,
    max: 1,
    palette: ['red', 'yellow', 'green']
  },
  c_factor_image_label);

 var stats = c_factor_image.reduceRegions({
      collection: geometry,
      reducer: ee.Reducer.first(),
      scale: 30
    });
  print(stats.first().get('first'));

Export.image.toCloudStorage({
  image: c_factor_image,
  description: 'c_factor',
  'bucket': 'ecoshard-root',
  fileNamePrefix: 'gee_export/'+'c_factor',
  crs: "EPSG:4326",
  scale: 30,
  maxPixels: 1e13,
  region: country.geometry()});
