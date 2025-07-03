// Estimating Carbon Stock Using Machine Learning (ML) Approach in Google Earth Engine

// 1. Define the point of interest for analysis
var referencePoint = [81.48231550661434,7.84892465969479];
var pointGeometry = ee.Geometry.Point(referencePoint);

// 2. Load a country boundary dataset and filter by the region of interest (ROI)
var countryBoundaries = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level1");
var studyArea = countryBoundaries.filterBounds(pointGeometry);
Map.addLayer(countryBoundaries);

// Center the map on the ROI and add it to the map
Map.centerObject(studyArea);
Map.addLayer(studyArea, {}, 'Study Area');

// 3. Load biomass carbon density data
var biomassData = ee.ImageCollection("WCMC/biomass_carbon_density/v1_0").first();
Map.addLayer(biomassData.clip(studyArea), {}, 'Biomass Carbon Density', false);
print(biomassData)

// 4. Load and process Sentinel-2 imagery, selecting only cloud-free images for the study period
var sentinel2Data = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .select('B.*')  // Select all Sentinel-2 bands
  .filterBounds(studyArea)
  .filterDate('2022', '2023')  // Define time period
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))  // Filter cloud percentage < 10%
  .median()
  .multiply(0.0001);  // Scale reflectance to match expected range

// Calculate NDVI using NIR and red bands and add it to the map
var ndviCalculation = sentinel2Data.normalizedDifference(['B8', 'B4']).rename('NDVI');
Map.addLayer(ndviCalculation.clip(studyArea), {}, 'NDVI', false);

// 5. Add a dynamic world land cover layer, masking for areas with tree cover
var landcoverData = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
  .select('label')
  .filterDate('2022', '2023')
  .filterBounds(studyArea)
  .mode()
  .eq(1);  // Filter for tree-covered areas

Map.addLayer(landcoverData.clip(studyArea), {}, 'Tree Cover Mask', false);

// 6. Define predictor variables by combining a constant, Sentinel-2 bands, NDVI, and applying tree cover mask
var predictorVariables = ee.Image.constant(1).addBands(sentinel2Data).addBands(ndviCalculation).updateMask(landcoverData);
Map.addLayer(predictorVariables.clip(studyArea), {}, 'Predictors', false);

// 7. Combine predictor variables with carbon stock data to create the dataset
var combinedDataset = predictorVariables.addBands(biomassData);
print(combinedDataset)

// 8. Perform robust linear regression to estimate carbon stock from Sentinel-2 variables
var regressionModel = combinedDataset.reduceRegion({
  reducer: ee.Reducer.robustLinearRegression(14, 1),
  geometry: studyArea,
  scale: 250,
  bestEffort: true
});
print(regressionModel)

// 9. Extract regression coefficients and use them to calculate carbon stock
var regressionCoefficients = ee.Array(regressionModel.get('coefficients')).project([0]).toList();
// .project([0]) reshapes the array by selecting the first dimension. This step organizes the coefficients into a 1D list format, 
// which is required for simpler access to individual coefficients.

var estimatedCarbon = predictorVariables.multiply(ee.Image.constant(regressionCoefficients)).reduce(ee.Reducer.sum()).rename('Estimated Carbon Stock');
// Clamp negative values to zero
var estimatedCarbon = estimatedCarbon.max(0);
Map.addLayer(estimatedCarbon.clip(studyArea), {}, 'Estimated Carbon Stock from Sentinel-2', false);


// 10. Calculate RMSE between original and estimated carbon stock
var difference = biomassData.subtract(estimatedCarbon);
var squaredDifference = difference.pow(2);
var rmse = ee.Number(squaredDifference.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: studyArea,
  scale: 250
}).values().get(0)).sqrt();

print('Root Mean Square Error (RMSE):', rmse);

// 11. Export the estimated carbon stock image
Export.image.toDrive({
  image: estimatedCarbon.float().clip(studyArea),
  description: 'Estimated_Carbon_Stock_Sentinel2',
  scale: 100,
  region: studyArea,
  folder: 'carbon_stock_estimation',
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// 12. Export the reference biomass carbon (reality)
Export.image.toDrive({
  image: biomassData.select('carbon_tonnes_per_ha').clip(studyArea),
  description: 'Reference_Carbon_Stock',
  scale: 100,
  region: studyArea,
  folder: 'carbon_stock_estimation',
  fileFormat: 'GeoTIFF',
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
