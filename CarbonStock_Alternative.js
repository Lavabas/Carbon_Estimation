// Estimating Carbon Stock Using Machine Learning (Random Forest) in Google Earth Engine

// 1. Define Region of Interest (ROI)
var point = ee.Geometry.Point([81.4823, 7.8489]);
var boundaries = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level1");
var roi = boundaries.filterBounds(point);

Map.centerObject(roi, 10);
Map.addLayer(roi, {}, 'Study Area');

// 2. Load Biomass Carbon Density Dataset
var biomass = ee.ImageCollection("WCMC/biomass_carbon_density/v1_0").first()
              .clip(roi).select('carbon_tonnes_per_ha');
Map.addLayer(biomass, {min: 0, max: 100, palette: ['white', 'green']}, 'Carbon Density');

// 3. Load Sentinel-2 Data
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
          .filterBounds(roi)
          .filterDate('2022-01-01', '2023-01-01')
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
          .median()
          .multiply(0.0001);

// Select relevant bands and compute indices
var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
var evi = s2.expression(
  '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
    'NIR': s2.select('B8'),
    'RED': s2.select('B4'),
    'BLUE': s2.select('B2')
  }).rename('EVI');

var predictors = s2.select(['B2','B3','B4','B5','B6','B7','B8','B11','B12'])
                   .addBands([ndvi, evi]);

// 4. Mask for forest/tree areas using Dynamic World
var treeMask = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                .filterDate('2022-01-01', '2023-01-01')
                .select('label')
                .mode()
                .eq(1);  // 1 = Trees
predictors = predictors.updateMask(treeMask);

// 5. Combine predictors with carbon stock data
var stack = predictors.addBands(biomass).rename(predictors.bandNames().cat(['carbon_tonnes_per_ha']));

// 6. Sample training data
var samples = stack.sample({
  region: roi,
  scale: 100,
  numPixels: 1000,
  seed: 42,
  geometries: true
});

// Split into training and validation
var withRandom = samples.randomColumn();
var train = withRandom.filter(ee.Filter.lt('random', 0.7));
var test = withRandom.filter(ee.Filter.gte('random', 0.7));

// 7. Train Random Forest Regressor
var bands = predictors.bandNames();
var rf = ee.Classifier.smileRandomForest(50)
          .setOutputMode('REGRESSION')
          .train({
            features: train,
            classProperty: 'carbon_tonnes_per_ha',
            inputProperties: bands
          });

// 8. Apply Model
var estimated = predictors.classify(rf).rename('Estimated_Carbon');
Map.addLayer(estimated.clip(roi), {min: 0, max: 100, palette: ['white', 'darkgreen']}, 'Estimated Carbon Stock');

// 9. Accuracy - Compute RMSE on test set
var validated = test.classify(rf).map(function(f) {
  var actual = f.get('carbon_tonnes_per_ha');
  var predicted = f.get('classification');
  var error = ee.Number(actual).subtract(predicted);
  return f.set('error', error.pow(2));
});

var rmse = validated.reduceColumns({
  reducer: ee.Reducer.mean(),
  selectors: ['error']
}).get('mean');

print('RMSE (Random Forest):', ee.Number(rmse).sqrt());

// 10. Export Image
Export.image.toDrive({
  image: estimated.clip(roi).float(),
  description: 'Improved_Carbon_Stock_RF',
  folder: 'carbon_estimation',
  region: roi.geometry(),
  scale: 100,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
