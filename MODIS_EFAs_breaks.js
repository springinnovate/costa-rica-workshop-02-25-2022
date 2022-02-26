var countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017"),
    MODIS_coll = ee.ImageCollection("MODIS/006/MOD13Q1"),
    GlobCover = ee.Image("ESA/GLOBCOVER_L4_200901_200912_V2_3"),
    geometry =
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-86.24792199948007, 11.241756996503387],
          [-86.24792199948007, 9.328518377096712],
          [-84.67687707760507, 9.328518377096712],
          [-84.67687707760507, 11.241756996503387]]], null, false);

// First step for preparing extracting EFT (Ecosystem Functional Types)
// Script to calculate EFAs breaks on a national or local scale
// Import a shapefile for local EFTs
// Import a collection of Images
// Calculate EFAs such as Mean, Seasonality and DMax
// Calculate EFAs breaks for a defined area
// Date: 19_apr_2018.
// Adapted the code from https://code.earthengine.google.com/af26a3cb7a4a967fa77c89f1eff30c1e
// Author: Lingling Liu Email: liu02034@umn.edu

//******************** study period and area could be changed here******************************
var FirstYear = 2001; // First year of the studied period
var LastYear = 2017;  // Last year of the studied period
//var aoi = ee.FeatureCollection(countries.filter(ee.Filter.stringContains('country_na', 'Costa')));
var aoi = geometry;
// Set the folder to save outputs
var GDriveOutputImgFolder = 'GEEOutputs';

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
  //var aoi = ee.FeatureCollection(countries.filter(ee.Filter.stringContains('country_na', 'Costa')));
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


// 2.1)  Partial EFAs including mean, SD and CV based on monthly average veggetation index over a study period

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
var Nobelowzero = Media.gt(0);
// var minValue = Media.reduceRegion({
//   reducer: ee.Reducer.min(),
//   geometry: aoi.geometry(),
//   scale: 500,
//   maxPixels: 1e9
// });
// print(minValue);

// var maxValue = Media.reduceRegion({
//   reducer: ee.Reducer.max(),
//   geometry: aoi.geometry(),
//   scale: 500,
//   maxPixels: 1e9
// });
// print(maxValue);
var mask_temp = Nobelowzero;
var Media_his = Media.updateMask(mask_temp);
var histomean = ui.Chart.image.histogram(Media_his, aoi, 500, 12, 1);
print("Mean", histomean);

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



var histoSD = ui.Chart.image.histogram(season_SD, region, 500, 12, 1);
print("SD", histoSD);

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

// Calcuate coefficient of variation (CV)
  var SD = Evi_mensual.select([SelectedVariableName]).reduce(ee.Reducer.stdDev());
  var SDabs = SD.abs();
  var Mediaabs = Media.abs();
  var CV = SDabs.divide(Mediaabs);

   Export.image.toAsset({
  image: CV,
  description: 'MODIS_CV_A'+filename_add,
  assetId: 'MODIS_CV'+filename_add,
  scale: scale,
  region: aoi,
  maxPixels: 1e13,
}) ;

Export.image.toDrive({
      image: CV,
      description: 'MODIS_CV'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });

var vizParamsCV = {"opacity":1,min: 0, max:0.1,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

Map.addLayer(CV, vizParamsCV, 'coefficient of variation', false);
//print('CV', Season);


//*****************************************************
//EFAs such as phenological metrics extraction based on 16-day NDVI composites for growing season
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
 var vizParamsMax_VI = {"opacity":1,min: 2000, max:8000,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

 Map.addLayer(Max.select(['EVI']), vizParamsMax_VI, 'Max_VI', false);
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
 Map.addLayer(DMax,vizParamsDMax, 'DMax', false);


   Export.image.toAsset({
  image: Max.select(['EVI']),
      description: 'MODIS_Max_VI_A'+filename_add,
  assetId: 'MODIS_MAX_VI'+filename_add,
  scale: scale,
  region: aoi,
  maxPixels: 1e13,
}) ;

 Export.image.toDrive({
      image: Max.select(['EVI']),
      description: 'MODIS_Max_VI'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });

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

var histoDMax = ui.Chart.image.histogram(DMax, region, 500, 12, 1)
print("histoDMax", histoDMax)

// Min 020 revise by LL
//convert to array images
 var test = Ndvi_mean_1band2.select(['EVI', 'day_of_year']).toArray();// find maximum value (row)
 var sort = test.arraySlice(1, 0, 1);
 // sort array
 var testSorted = test.arraySort(sort);
 //print('testSorted',testSorted);
 //Map.addLayer(testSorted, {}, 'array, test with times (sorted)', false);
 // convert to images
 var Min = testSorted.arraySlice(0, 0, 1)
  .arrayProject([1])
  .arrayFlatten([['NDVI_min', 't1']]);
 //print('Min',Min);


var vizParamsMin_VI = {"opacity":1,min: 0, max:5000,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

 Map.addLayer(Min.select(['NDVI_min']),vizParamsMin_VI, 'Min_VI', false);

  Export.image.toAsset({
      image: Min.select(['NDVI_min']),
      description: 'MODIS_Min_VI_A'+filename_add,
      assetId: 'MODIS_Min_VI'+filename_add,
      scale: scale,
      region: aoi,
      maxPixels: 1e13,
     }) ;
    Export.image.toDrive({
      image: Min.select(['NDVI_min']),
      description: 'MODIS_Min_VI'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });

     Export.image.toAsset({
      image: Min.select(['t1']),
      description: 'MODIS_DMin_A'+filename_add,
      assetId: 'MODIS_DMin'+filename_add,
      scale: scale,
      region: aoi,
      maxPixels: 1e13,
     }) ;
  Export.image.toDrive({
      image: Min.select(['t1']),
      description: 'MODIS_DMin'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });

 var vizParamsDMin = {"opacity":1,min: 1, max:365,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

 Map.addLayer(Min.select(['t1']),vizParamsDMin, 'DMin', false);


// convert to array images and compute diff between two adjacent image (in time)
var a = Ndvi_mean_1band2.select(['EVI', 'day_of_year']).toArray();
var a1 = a.arraySlice(0, 0, -1);
var a2 = a.arraySlice(0, 1);

var diff = a1.subtract(a2);

//Map.addLayer(diff, {}, 'array, diff', false);

// add times
var t1 = a1.arraySlice(1, 1);
var t2 = a2.arraySlice(1, 1);

diff = diff
  .arrayCat(t1, 1)
  .arrayCat(t2, 1);

//Map.addLayer(diff, {}, 'array, diff with times', false);

// sort array
var sort = diff.arraySlice(1, 0, 1);

// find maximum value (row)
var diffSorted = diff.arraySort(sort);

//Map.addLayer(diffSorted, {}, 'array, diff with times (sorted)', false);

// select min/max and convert to images
var diffMin = diffSorted.arraySlice(0, 0, 1)
  .arrayProject([1])
  .arrayFlatten([['NDVI_diff_min', 't_diff', 't1', 't2']]);

// var histo1 = ui.Chart.image.histogram(diffMin, cavm, scale, 12, {}, {})
// print(histo1)

var diffMax = diffSorted.arraySlice(0, -1, diff.arrayLength(0))
  .arrayProject([1])
  .arrayFlatten([['NDVI_diff_max', 't_diff', 't1', 't2']]);

//print(diffMax, "diffMax");

// Map.addLayer(diffMax, { bands: ['NDVI_diff_max'], min: 0, max: 5000 }, 'max(diff)')
// Map.addLayer(diffMax, { bands: ['t1'], min: 0, max: 365 }, 'max(diff) time')

// Map.addLayer(diffMin, { bands: ['NDVI_diff_min'], min: 0, max: 5000 }, 'min(diff)')
// Map.addLayer(diffMin, { bands: ['t1'], min: 0, max: 365 }, 'min(diff) time')

var vizParamsGreening = {"opacity":1, min: 1, max: 365, palette:
['#ffffff','#effcd1','#d9f0a3','#addd8e','#41ab5d',
'#006837','#0c4e38','#000000','#fefba2','#fed98e',
'#cc4c02','#662506']};

var vizParamsGreening_VI = {"opacity":1, min: -2000, max: 2000, palette:
['#ffffff','#effcd1','#d9f0a3','#addd8e','#41ab5d',
'#006837','#0c4e38','#000000','#fefba2','#fed98e',
'#cc4c02','#662506']};

var vizParamsBrowning = {"opacity":1,min: 1, max:365,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

var vizParamsBrowning_VI = {"opacity":1,min: -2000, max:1000,"palette":
["6000e8","8d00ff","3a00e6","4100af","2e00c3",
"4e0068","8000e2","5201ab","5700c2","000000","380032",
"44005c","005dff","0072ff","009dff","00b2ff",
"00dcff","00fff6","00ffcb","00ffbb",
"00ff90","00ff69","00ff3b","00ff26",
"04ff00","19ff00","2eff00","59ff00","6eff00",
"99ff00","a9ff00","bfff00","e9ff00","ffff00",
"ffd400","ffaa00","ff7f00","ff6a00",
"ff2a00","ff1500","ff0000","e90000","d40000","bf0000"]};

var browning = diffMax.select(['NDVI_diff_max'])
Map.addLayer(browning,vizParamsBrowning_VI, 'browning_VI', false);

Export.image.toAsset({
      image: browning,
      description: 'Browning_VI_A'+filename_add,
      assetId: 'MODIS_Browning_VI'+filename_add,
      scale: scale,
      region: aoi,
      maxPixels: 1e13,
     }) ;

    Export.image.toDrive({
      image: browning,
      description: 'Browning_VI'+filename_add,
      region: aoi,
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: scale
    });

var browning_time = diffMax.select(['t1']).rename('t1_1');
Map.addLayer(browning_time, vizParamsBrowning, 'browning_time', false);
//print(browning_time, "browning_time");

 Export.image.toAsset({
      image: browning_time,
      description: 'BrownTime_A'+filename_add,
      assetId: 'MODIS_BrownTime'+filename_add,
      scale: scale,
      region: aoi,
      maxPixels: 1e13,
     }) ;

    Export.image.toDrive({
      image: browning_time,
      description: 'BrownTime'+filename_add,
      region: aoi,
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: scale
    });


//var histoBRWN = ui.Chart.image.histogram(browning_time, region, 500, 12, 1)
//print("End of growing season", histoBRWN)

var greening = diffMin.select(['NDVI_diff_min'])
Map.addLayer(greening,vizParamsGreening_VI, 'greening_VI', false)

Export.image.toAsset({
       image: greening,
      description: 'Greening_VI_A'+filename_add,
      assetId: 'MODIS_Greening_VI'+filename_add,
      scale: scale,
      region: aoi,
      maxPixels: 1e13,
     }) ;
 Export.image.toDrive({
      image: greening,
      description: 'Greening_VI'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });


var greening_time = diffMin.select(['t1'])
Map.addLayer(greening_time, vizParamsGreening, 'greening_time', false)

Export.image.toAsset({
       image: greening_time,
      description: 'GreenTime_A'+filename_add,
      assetId: 'MODIS_GreenTime'+filename_add,
      scale: scale,
      region: aoi,
      maxPixels: 1e13,
     }) ;
 Export.image.toDrive({
      image: greening_time,
      description: 'GreenTime'+filename_add,
      maxPixels: 1e13,
      region: aoi,
      folder: GDriveOutputImgFolder,
      scale: scale
    });


// var histoGRN = ui.Chart.image.histogram(greening_time, region, 500, 12, 1)
// print("histoGRN", histoGRN)

//print(greening_time, "greening_time")

//Calculate the breaks

var quartM = Media.reduceRegion({
              reducer: ee.Reducer.percentile([50]),
              geometry: aoi,
              //crs:'EPSG:4326',
              scale: scale,
              bestEffort: true,
              maxPixels: 100000
              });

print ('Mean breaks: ',quartM);

var Season = season_SD ;
var quartSeason = Season.reduceRegion({
              reducer: ee.Reducer.percentile([50]),
              geometry: aoi,
              //crs:'EPSG:4326',
              scale: scale,
              bestEffort: true,
              maxPixels: 100000
              });
print ("SD breaks: ", quartSeason);

// DMaxbreaks
var Feno = DMax.where(DMax.gt(125).and(DMax.lte(300)), 1);
Feno = Feno.where((DMax.gt(300).and(DMax.lte(365))).or(DMax.gt(1).and(DMax.lte(125))), 2);
