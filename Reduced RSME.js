// Estimating Carbon Stock Using Machine Learning (Improved Random Forest) in GEE

// 1. Define the Point of Interest
var point = ee.Geometry.Point([81.4823, 7.8489]);

// 2. Load Sri Lanka boundary
var countries = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level1");
var sriLanka = countries.filterBounds(point);
Map.centerObject(sriLanka, 8);
Map.addLayer(sriLanka, {}, 'Sri Lanka');

// 3. Load Biomass Carbon Stock Data (correct band)
var biomass = ee.ImageCollection("WCMC/biomass_carbon_density/v1_0").first();
var carbon = biomass.select("carbon_tonnes_per_ha");
Map.addLayer(carbon.clip(sriLanka), {min: 0, max: 150}, "Carbon Stock");

// 4. Load Sentinel-2 imagery (2022 only, low cloud)
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(sriLanka)
  .filterDate("2022-01-01", "2022-12-31")
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 10))
  .median()
  .multiply(0.0001);

// 5. Add NDVI and EVI
var ndvi = s2.normalizedDifference(["B8", "B4"]).rename("NDVI");
var evi = s2.expression(
  '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
  {
    'NIR': s2.select('B8'),
    'RED': s2.select('B4'),
    'BLUE': s2.select('B2')
  }).rename('EVI');

// 6. Add NDVI standard deviation (texture)
var ndvi_std = ndvi.reduceNeighborhood({
  reducer: ee.Reducer.stdDev(),
  kernel: ee.Kernel.square(3)
}).rename("NDVI_std");

// 7. Topographic features
var elev = ee.Image("USGS/SRTMGL1_003");
var slope = ee.Terrain.slope(elev);

// 8. Land cover mask (trees only)
var landcover = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
  .select("label")
  .filterDate("2022-01-01", "2022-12-31")
  .mode()
  .eq(1); // class 1 = Trees

// 9. Combine predictors
var predictors = s2
  .select(["B2", "B3", "B4", "B5", "B6", "B7", "B8", "B11", "B12"]).rename(
    ["Blue", "Green", "Red", "RE1", "RE2", "RE3", "NIR", "SWIR1", "SWIR2"])
  .addBands([ndvi, evi, ndvi_std, elev, slope])
  .updateMask(landcover);

// 10. Create training dataset by sampling predictors and carbon
var stack = predictors.addBands(carbon.rename("carbon"));
var samples = stack.sample({
  region: sriLanka,
  scale: 250,
  numPixels: 5000,
  seed: 42,
  geometries: true
});

// 11. Train Random Forest model
var rf = ee.Classifier.smileRandomForest({
  numberOfTrees: 100,
  bagFraction: 0.7,
  seed: 42
}).setOutputMode("REGRESSION");

var trained = rf.train({
  features: samples,
  classProperty: "carbon",
  inputProperties: predictors.bandNames()
});

// 12. Predict carbon stock
var estimated = predictors.classify(trained).rename("Estimated_Carbon");
Map.addLayer(estimated.clip(sriLanka), {min: 0, max: 150}, "Estimated Carbon");

// 13. Calculate RMSE
var dif = estimated.subtract(carbon).pow(2);
var rmse = ee.Number(
  dif.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: sriLanka,
    scale: 250
  }).values().get(0)).sqrt();

print("RMSE (Random Forest):", rmse);

// 14. Export results
Export.image.toDrive({
  image: estimated.float().clip(sriLanka),
  description: "Estimated_Carbon_Stock_RF",
  folder: "carbon_stock_estimation",
  scale: 100,
  region: sriLanka.geometry(),
  crs: "EPSG:4326",
  maxPixels: 1e13
});