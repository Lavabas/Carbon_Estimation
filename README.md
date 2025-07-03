# Carbon_Estimation
How can remote sensing and machine learning help in estimating carbon stock over large areas? 
.

🌍 Estimating and Visualizing Carbon Stock Using Sentinel-2 Imagery and Machine Learning

Overview
This project demonstrates how to estimate aboveground biomass carbon stock in the Eastern Province of Sri Lanka using Sentinel-2 imagery, biomass data, and a Random Forest regression model in Google Earth Engine (GEE). The outputs are exported and visualized in R Studio with high-resolution side-by-side maps.

![carbon_stock_comparison](https://github.com/user-attachments/assets/f9b31fbd-7294-47c4-adda-411d737b923c)


🧮 Accuracy Evaluation
To evaluate the effectiveness of carbon stock estimation, three different modeling approaches were implemented and compared in Google Earth Engine (GEE):

| Code Variant              | Approach                                | RMSE (t/ha) |
| ------------------------- | --------------------------------------- | ----------- |
| `CarbonStock_Estimation`  | Linear Regression                       | **24.13**   |
| `CarbonStock_Alternative` | Random Forest (basic)                   | **25.56**   |
| `Reduced_RMSE`            | Optimized Random Forest (feature-tuned) | **20.40**   |

Reference Data: WCMC Global Biomass Carbon Density dataset (carbon_tonnes_per_ha)
Lowest RMSE Achieved: 20.40 t/ha using the optimized Random Forest approach.
Improvements were achieved by refining the training data, applying more precise masks (e.g., Dynamic World land cover), and tuning model parameters.

These files are included as separate GEE scripts in the repository to show the iterative process of model refinement.

![image](https://github.com/user-attachments/assets/45703944-c5d3-44b0-b4c6-dbcde942cbcf)

![image](https://github.com/user-attachments/assets/dcd36628-9067-4fc7-b43f-c8b15bdb9ae2)

![image](https://github.com/user-attachments/assets/b4ce02f3-8878-4798-8347-45752ea22183)




