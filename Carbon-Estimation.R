# Install if not already
install.packages(c("terra", "tmap", "ggplot2"))
install.packages("leaflet.providers")
install.packages("terra", dependencies = TRUE)
install.packages("lwgeom")


# Load libraries

library(tmap)
library(terra)
library(leaflet.providers)

# Set tmap to static plotting mode
tmap_mode("plot")


# Load estimated and reference carbon stock rasters
estimated <- rast("Estimated_Carbon_Stock_Sentinel2.tif")
reference <- rast("Reference_Carbon_Stock.tif")

# Create side-by-side maps
tm1 <- tm_shape(estimated) + 
  tm_raster(title = "Estimated Carbon (t/ha)", palette = "YlGn", style = "cont") +
  tm_basemap(server = "Esri.WorldImagery") +  # Satellite basemap
  tm_layout(main.title = "Estimated Carbon Stock", legend.outside = TRUE)

tm2 <- tm_shape(reference) + 
  tm_raster(title = "Reference Carbon (t/ha)", palette = "YlOrBr", style = "cont") +
  tm_basemap(server = "Esri.WorldImagery") +  # Satellite basemap
  tm_layout(main.title = "Reference (Reality)", legend.outside = TRUE)

tmap_arrange(tm1, tm2, ncol = 2)

# Save each map as PNG
tmap_save(tm1, filename = "estimated_carbon_stock.png", width = 10, height = 8, units = "in", dpi = 300)
tmap_save(tm2, filename = "reference_carbon_stock.png", width = 10, height = 8, units = "in", dpi = 300)

# Optional: combine into a single PNG image
combined <- tmap_arrange(tm1, tm2, ncol = 2)
tmap_save(combined, filename = "carbon_stock_comparison.png", width = 16, height = 8, units = "in", dpi = 300)


