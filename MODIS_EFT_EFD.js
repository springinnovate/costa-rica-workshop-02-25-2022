var countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017"),
    MODIS_coll = ee.ImageCollection("MODIS/006/MOD13Q1"),
    GlobCover = ee.Image("ESA/GLOBCOVER_L4_200901_200912_V2_3"),
    EFD_CR = ee.Image("users/liu02034/EFD_MODIS_CR"),
    EFD_local = ee.Image("users/liu02034/EFT_MODIS_local");

// First step for preparing extracting EFT (Ecosystem Functional Types)
// Script to calculate EFAs breaks on a national or local scale
// Import a shapefile for local EFTs
// Import a collection of Images
// Calculate EFAs such as Mean, Seasonality and DMax
// Calculate EFAs breaks for a defined area
// Date: 19_apr_2018.
// Adapted the code from https://code.earthengine.google.com/af26a3cb7a4a967fa77c89f1eff30c1e
// Author: Lingling Liu Email: liu02034@umn.edu

// var geometry =
//     /* color: #d63000 */
//     /* shown: false */
//     /* displayProperties: [
//       {
//         "type": "rectangle"
//       }
//     ] */
//     ee.Geometry.Polygon(
//         [[[-86.24792199948007, 11.241756996503387],
//           [-86.24792199948007, 9.328518377096712],
//           [-84.67687707760507, 9.328518377096712],
//           [-84.67687707760507, 11.241756996503387]]], null, false);


// Set the folder to save outputs
var GDriveOutputImgFolder = 'GEEOutputs';

//******************** study period, area and window_size could be changed here******************************
var FirstYear = 2001; // First year of the studied period
var LastYear = 2017;  // Last year of the studied period
var aoi = ee.FeatureCollection(countries.filter(ee.Filter.stringContains('country_na', 'Costa')));
//var aoi = geometry;
var win_size = 3;// window size for calculating ecosystem fuctional diversity

// 1.0) Set breaks from EFAs script (if desired)
  //These are the breaks predefined for the national scale, full time period 2001-2017:
  var quartM = 4784.05361199752;
  var quartSeason = 467.9567862406827;
  var season_break1 = 125;
  var season_break2 = 300;

  // var quartM = 5744.617147671563;
  // var quartSeason = 247.12581792854266;
  // var season_break1 = 220;
  // var season_break2 = 320;


// 1.1 ) Definition of the studied period
  var TimeFrame = ee.List.sequence(FirstYear, LastYear);
  var NumberYears = LastYear - FirstYear + 1;
  var doy = ee.List.sequence(1,365,16);
  var months = ee.List.sequence(1,12);
  var filename_add = '_'+FirstYear.toString() +'_'+ LastYear.toString();
  //print(filename_add)

// 1.2) Select Image Collection // Do not modify this section

  var coll1 = MODIS_coll.filterDate(String(FirstYear)+'-01-01', String(LastYear)+'-12-31'); // EVI y NDVI
  //print('coll1',coll1)

// 1.3) Select the target variable/spectral index //
  var SelectedVariableName = 'EVI' //'EVI' or 'NDVI'
  var SelectedVariable = coll1.select([SelectedVariableName]); // EVI index, selected from the "MODIS/006/MOD13Q1" collection
  var scale = 231.65635826395825 // spatial resolution of MODIS data


// 1.4) Study area  // Be CAREFUL the whole world must be visualized before exportation of a particular region!!!!!!
  // See https://developers.google.com/earth-engine/importing for more information about hot to create and importe Feature Collections
  Map.setCenter (-84, 10); //Centers the map view at study area
  var UseRegion = 1; // Set to 0 to compute the Globe
  if (UseRegion == 1){

  var region = aoi;// Shape o Rectangle o Geometry
  //Map.addLayer(region, {}, 'region', false);
  }


//////////////////////////////////
///2) COMPUTATION OF Ecosystem functional attributes (EFAs)  ///
//////////////////////////////////

//Create LAND MASK from  GLOBCOVER
var GlobCoverLandCover = GlobCover.select('landcover');
// Create a binary mask.
var NoWaterNoIceNoSnow = GlobCoverLandCover.lt(210);
var mask = NoWaterNoIceNoSnow;
//Map.addLayer(mask, {min:0, max:1}, 'GLOBCOVERmask', false);


// 2.1)  Calculate EFAs including mean and SD based on monthly average veggetation index over a study period

// caculate monthly average VI over a study period
var Evi_mensual = months.map(function(m) {
  // Filter to 1 month.
  var Evi_men = SelectedVariable.filter(ee.Filter.calendarRange(m, m, 'month')).mean();
  // add month band for DMax
  var Evi_men2 = Evi_men.updateMask(mask);

return  Evi_men2.addBands(ee.Image.constant(m).select([0],['month']).int8());
});

// clip monthly average VI into study area
var Evi_mensual = ee.ImageCollection(Evi_mensual);
    if (UseRegion == 1){
    var Evi_mensual = ee.ImageCollection(Evi_mensual
    .map(function(image){
      var xx = image.clip(region);
      return xx;
    }));
      }
//print(Evi_mensual, 'Evi_mensual');
// Calcuate mean
var Media = Evi_mensual.select(SelectedVariableName).mean();

// show histogram of mean in the study area
// var histomean = ui.Chart.image.histogram(Media, region, 500, 12, 1);
// print("Mean", histomean);

// Export images into Asset or Drive
Export.image.toAsset({
  image: Media,
  description: 'MODIS_mean_A'+filename_add,
  assetId: 'MODIS_mean'+filename_add,
  scale: scale,
  region: aoi,
  maxPixels: 1e13,
}) ;

Export.image.toDrive({
      image: Media,
      description: 'MODIS_mean'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });

var vizParamsMedia = {"opacity":1,min: 2500, max:7000,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

Map.addLayer(Media, vizParamsMedia, 'mean', false);

// Calculate Standard deviation
  var Season = Evi_mensual.select([SelectedVariableName]).reduce(ee.Reducer.stdDev());
  //print('SD', Season)
  var season_SD = Season;

// var histoSD = ui.Chart.image.histogram(season_SD, region, 500, 12, 1);
// print("SD", histoSD);

  Export.image.toAsset({
  image: Season,
  description: 'MODIS_SD_A'+filename_add,
  assetId: 'MODIS_SD'+filename_add,
  scale: scale,
  region: aoi,
  maxPixels: 1e13,
}) ;

Export.image.toDrive({
      image: Season,
      description: 'MODIS_SD'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });

var vizParamsSD = {"opacity":1,min: 0, max:1200,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

Map.addLayer(Season, vizParamsSD, 'Standard_Deviation', false);


//*****************************************************
// Calculate DMax (EFA) based on 16-day EVI composites for the growing season
//*****************************************************

// caculate 16-day composite average vegetation index
var Ndvi_mean2 = doy.map(function(m) {
var forcenum2 = ee.Number(m);
  // Filter to 1 month.
  var ndvi_mean2 = SelectedVariable.filter(ee.Filter.dayOfYear(forcenum2, forcenum2.add(16))).mean();
  // add month band for DMax
  var ndvi_mean3 = ndvi_mean2.updateMask(mask);
return  ndvi_mean3.addBands(ee.Image.constant(forcenum2).int16());
});


// clip 16-day composite average vegetation index into study area
var Ndvi_mean2 = ee.ImageCollection(Ndvi_mean2);
    if (UseRegion == 1){
    var Ndvi_mean2 = ee.ImageCollection(Ndvi_mean2
    .map(function(image){
      var xx = image.clip(region);
      return xx;
    }));
      }

//print('NDVI_mean2', Ndvi_mean2);

var Ndvi_mean_1band2 = doy.map(function(m) {
  var forcenum2 = ee.Number(m);
  // Filter to 16 day.
  var ndvi_mean_1band2 = SelectedVariable.filter(ee.Filter.dayOfYear(forcenum2, forcenum2.add(16))).mean();
  //look for calendar day of year function
  // add month band for DMax
  var ndvi_mean1_1band2 = ndvi_mean_1band2.updateMask(mask);
  var ndvi_mean2_1band2 = ndvi_mean1_1band2.addBands(ee.Image.constant(m).select([0],['day_of_year']).int16());
  return  ndvi_mean2_1band2;
});


//this clips collection to study area//
var Ndvi_mean_1band2 = ee.ImageCollection(Ndvi_mean_1band2);
    if (UseRegion == 1){
    var Ndvi_mean_1band2 = ee.ImageCollection(Ndvi_mean_1band2
    .map(function(image){
      var xx = image.clip(region);
      return xx;
    }));
    }

//print('EVI', Ndvi_mean_1band2);
//Map.addLayer(Ndvi_mean_1band2, {}, '23_band', false);

// var Mean = Ndvi_mean2.select(SelectedVariableName).mean();
// print('Mean',Mean);

// Max
 var Max = Ndvi_mean_1band2.qualityMosaic(SelectedVariableName);
 //print('Max',Max);
 //Map.addLayer(Max, {}, 'Max', false);
 var DMax = Max.select(['day_of_year']);
 //print ('DMax', DMax);
 var vizParamsDMax = {"opacity":1,min: 1, max:365,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};
 Map.addLayer(DMax, vizParamsDMax, 'DMax', false);

      Export.image.toAsset({
      image: DMax,
      description: 'MODIS_DMax_A'+filename_add,
      assetId: 'MODIS_DMax'+filename_add,
      scale: scale,
      region: aoi,
      maxPixels: 1e13,
     }) ;
  Export.image.toDrive({
      image: DMax,
      description: 'MODIS_DMax'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });

// var histoDMax = ui.Chart.image.histogram(DMax, region, 500, 12, 1)
// print("histoDMax", histoDMax)

//Mean, SD and DMax breaks from the perivious script
//var quartM = 4784.05361199752;
//print(quartM);

var Mp50 = ee.Image.constant(quartM);
var PPN = Media.where(Media.lte(Mp50), 100);
PPN = PPN.where(Media.gt(Mp50), 200);

//var quartSeason = 467.9567862406827
//print (quartSeason);

var Season50 = ee.Image.constant(quartSeason);
var Seasonality = Season.where(Season.lte(Season50), 10);
Seasonality = Seasonality.where(Season.gt(Season50), 20);

// DMax breaks
var Feno = DMax.where(DMax.gt(season_break1).and(DMax.lte(season_break2)), 1);
Feno = Feno.where((DMax.gt(season_break2).and(DMax.lte(365))).or(DMax.gt(1).and(DMax.lte(season_break1))), 2); //



var TFEcat = PPN.int().addBands([Seasonality,Feno]).int();
var TFEunib = TFEcat.reduce(ee.Reducer.sum());


//EFTs from 1 to 8
var clasInpt = ([111, 112, 121, 122,
211, 212,  221, 222
]);

var clasesF = ee.List.sequence(1, 8);

var TFEclas = TFEunib.remap(clasInpt, clasesF);

var TFEunib = TFEunib.toUint16();

//print('TFE111-222',TFEunib);
//print('TFE1-8',TFEclas);

//EFTs from 111 to 222. Show the EFTs on the map, you can clip to the study area
// clip to the study area shape
var clipped = TFEclas.clip(region);

//var vizParams = { min: 1, max:64,'palette':"6000E8, 8D00FF, A400D3, 3A00E6, 4100AF, 3900B9, 2E00C3, 5500DC, 4E0068, 55007C, 51008E, 4B00A6, 000000, 380032, 450052, 44005C, 005DFF, 0072FF, 0087FF, 009DFF, 00B2FF, 00C7FF, 00DCFF, 00F2FF, 00FFF6, 00FFE1, 00FFCB, 00FFBB, 00FFA5,   00FF90, 00FF7B, 00FF69, 00FF4E, 00FF3B, 00FF26, 00FF10, 04FF00, 19FF00, 2EFF00, 43FF00, 59FF00, 6EFF00, 83FF00, 99FF00, A9FF00, BFFF00, D4FF00, E9FF00, FFFF00, FFE900, FFD400, FFBF00, FFAA00, FF9400, FF7F00, FF6A00, FF5500, FF3F00, FF2A00, FF1500, FF0000, E90000, D40000, BF0000"};
//var vizParamsTFEunib = { min: 111, max:444,'palette':"6000E8, 8D00FF, A400D3, 3A00E6, 4100AF, 3900B9, 2E00C3, 5500DC, 4E0068, 55007C, 51008E, 4B00A6, 000000, 380032, 450052, 44005C, 005DFF, 0072FF, 0087FF, 009DFF, 00B2FF, 00C7FF, 00DCFF, 00F2FF, 00FFF6, 00FFE1, 00FFCB, 00FFBB, 00FFA5, 00FF90, 00FF7B, 00FF69, 00FF4E, 00FF3B, 00FF26, 00FF10, 04FF00, 19FF00, 2EFF00, 43FF00, 59FF00, 6EFF00, 83FF00, 99FF00, A9FF00, BFFF00, D4FF00, E9FF00, FFFF00, FFE900, FFD400, FFBF00, FFAA00, FF9400, FF7F00, FF6A00, FF5500, FF3F00, FF2A00, FF1500, FF0000, E90000, D40000, BF0000"};
var vizParamsTFEunib45 = {"opacity":1,min: 111, max:222,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

var vizParamsTFEclasArctic = {"opacity":1,min: 1, max:8,"palette":
["6000e8","8d00ff","4100af","3900b9","2e00c3",
"5500dc","4e0068","8000e2","5201ab","5700c2","380032",
"005dff","0072ff","0087ff","009dff","00b2ff",
"00f2ff","00fff6","00ffe1","00ffcb","00ffbb",
"00ff7b","00ff69","00ff4e","00ff3b","00ff26",
"00ff10","04ff00","43ff00","59ff00","6eff00",
"bfff00","d4ff00","e9ff00","ffff00",
"ffe900","ffd400","ffbf00","ff6a00",
"ff5500","ff3f00","ff2a00","ff1500","ff0000","e90000","d40000",]};

//Map.addLayer(TFEunib, vizParamsTFEunib45, 'EFT111-222');
Map.addLayer(TFEclas, vizParamsTFEclasArctic, 'EFT1-8');

    Export.image.toDrive({
      image: TFEclas,
      description: 'EFT_MODIS_EVI_2_2'+filename_add,
      region: aoi,
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: scale
      //crs: 'EPSG:3571'
    });

//*********generate ecosystem functional diversity (EFD) based on window size*********
var weights = ee.List.repeat(ee.List.repeat(1,win_size),win_size);
var kernel = ee.Kernel.fixed(win_size,win_size, weights, 1, 1, false);

var EFD = TFEclas.reduceNeighborhood(ee.Reducer.countDistinctNonNull(), kernel);

var vizParamsEFD = {"opacity":1,min: 1, max:8,"palette":
["6000e8","8d00ff","4100af","3900b9","2e00c3",
"5500dc","4e0068","8000e2","5201ab","5700c2","380032",
"005dff","0072ff","0087ff","009dff","00b2ff",
"00f2ff","00fff6","00ffe1","00ffcb","00ffbb",
"00ff7b","00ff69","00ff4e","00ff3b","00ff26",
"00ff10","04ff00","43ff00","59ff00","6eff00",
"bfff00","d4ff00","e9ff00","ffff00",
"ffe900","ffd400","ffbf00","ff6a00",
"ff5500","ff3f00","ff2a00","ff1500","ff0000","e90000","d40000",]};

//Map.addLayer(TFEunib, vizParamsTFEunib45, 'EFT111-222');
Map.addLayer(EFD, vizParamsEFD, 'EFD');

 Export.image.toDrive({
      image: EFD,
      description: 'EFD_MODIS_EVI_2_2_win_3'+filename_add,
      region: aoi,
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: scale
      //crs: 'EPSG:3571'
    });

Map.addLayer(EFD_CR, vizParamsEFD, 'EFD_CR');
Map.addLayer(EFD_local, vizParamsEFD, 'EFD_local');
