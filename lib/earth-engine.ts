import ee from '@google/earthengine';

export interface EarthEngineData {
  ndvi: number; // Normalized Difference Vegetation Index (-1 to 1)
  evi: number; // Enhanced Vegetation Index
  soilMoisture: number; // Soil moisture (%)
  landSurfaceTemp: number; // Land surface temperature (Celsius)
  burnedArea: number; // Count of burned pixels
  drought: number; // Drought severity index (0-1)
}

let isInitialized = false;

// Initialize Earth Engine (do this once at app startup)
export const initializeEarthEngine = async (): Promise<boolean> => {
  if (isInitialized) {
    return true;
  }

  try {
    const privateKey = process.env.EARTH_ENGINE_PRIVATE_KEY;
    const clientEmail = process.env.EARTH_ENGINE_CLIENT_EMAIL;
    
    if (!privateKey || !clientEmail) {
      console.warn('⚠️ Earth Engine credentials not found - skipping Earth Engine data');
      return false;
    }

    return new Promise((resolve) => {
      ee.data.authenticateViaPrivateKey(
        JSON.parse(privateKey),
        () => {
          ee.initialize(
            null,
            null,
            () => {
              console.log('✅ Earth Engine initialized successfully');
              isInitialized = true;
              resolve(true);
            },
            (error: Error) => {
              console.error('❌ Earth Engine initialization failed:', error);
              resolve(false);
            }
          );
        },
        (error: Error) => {
          console.error('❌ Earth Engine authentication failed:', error);
          resolve(false);
        }
      );
    });
  } catch (error) {
    console.error('❌ Earth Engine setup error:', error);
    return false;
  }
};

const calculateDroughtIndex = (
  ndvi: number,
  soilMoisture: number,
  temp: number
): number => {
  // Simple drought index calculation
  // Lower NDVI = less vegetation = higher drought risk
  const ndviScore = (1 - ndvi) * 0.3;
  // Lower soil moisture = higher drought risk
  const moistureScore = (1 - (soilMoisture / 100)) * 0.4;
  // Higher temperature = higher drought risk
  const tempScore = Math.min(temp / 50, 1) * 0.3;
  
  return Math.min(Math.max(ndviScore + moistureScore + tempScore, 0), 1);
};

export const getEarthEngineData = async (
  lat: number,
  lng: number
): Promise<EarthEngineData> => {
  // Return default values if not initialized
  if (!isInitialized) {
    console.log('⚠️ Earth Engine not initialized - using default values');
    return {
      ndvi: 0.5,
      evi: 0.5,
      soilMoisture: 50,
      landSurfaceTemp: 20,
      burnedArea: 0,
      drought: 0.3,
    };
  }

  try {
    const point = ee.Geometry.Point([lng, lat]);
    const buffer = point.buffer(5000); // 5km radius
    
    // Get NDVI (vegetation health) - 16-day composite
    const ndviCollection = ee.ImageCollection('MODIS/006/MOD13A2')
      .filterDate(ee.Date(Date.now() - 16 * 24 * 60 * 60 * 1000), ee.Date(Date.now()))
      .select('NDVI')
      .mean();
    
    const ndviResult = await ndviCollection.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: buffer,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();

    // Get EVI (enhanced vegetation index)
    const eviCollection = ee.ImageCollection('MODIS/006/MOD13A2')
      .filterDate(ee.Date(Date.now() - 16 * 24 * 60 * 60 * 1000), ee.Date(Date.now()))
      .select('EVI')
      .mean();
    
    const eviResult = await eviCollection.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: buffer,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();

    // Get soil moisture
    const soilMoistureCollection = ee.ImageCollection('NASA_USDA/HSL/SMAP10KM_soil_moisture')
      .filterDate(ee.Date(Date.now() - 7 * 24 * 60 * 60 * 1000), ee.Date(Date.now()))
      .select('ssm')
      .mean();
    
    const soilMoistureResult = await soilMoistureCollection.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: buffer,
      scale: 10000,
      maxPixels: 1e9
    }).getInfo();

    // Get land surface temperature
    const lstCollection = ee.ImageCollection('MODIS/006/MOD11A1')
      .filterDate(ee.Date(Date.now() - 7 * 24 * 60 * 60 * 1000), ee.Date(Date.now()))
      .select('LST_Day_1km')
      .mean();
    
    const lstResult = await lstCollection.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: buffer,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();

    // Get burned area (count of burned pixels in past year)
    const burnedAreaCollection = ee.ImageCollection('MODIS/006/MCD64A1')
      .filterDate(ee.Date(Date.now() - 365 * 24 * 60 * 60 * 1000), ee.Date(Date.now()))
      .select('BurnDate');
    
    const burnedAreaResult = await burnedAreaCollection.reduceRegion({
      reducer: ee.Reducer.count(),
      geometry: buffer,
      scale: 500,
      maxPixels: 1e9
    }).getInfo();

    // Process the results with scale factors
    const ndvi = (ndviResult.NDVI || 0) * 0.0001; // Scale factor for MODIS NDVI
    const evi = (eviResult.EVI || 0) * 0.0001; // Scale factor for MODIS EVI
    const soilMoisture = soilMoistureResult.ssm || 0;
    const landSurfaceTempKelvin = (lstResult.LST_Day_1km || 0) * 0.02; // Convert to Kelvin
    const landSurfaceTemp = landSurfaceTempKelvin - 273.15; // Convert to Celsius
    const burnedArea = burnedAreaResult.BurnDate || 0;

    const drought = calculateDroughtIndex(ndvi, soilMoisture, landSurfaceTemp);

    console.log('🌍 Earth Engine data retrieved:', {
      ndvi: ndvi.toFixed(3),
      evi: evi.toFixed(3),
      soilMoisture: soilMoisture.toFixed(1),
      landSurfaceTemp: landSurfaceTemp.toFixed(1),
      burnedArea,
      drought: (drought * 100).toFixed(0) + '%',
    });

    return {
      ndvi,
      evi,
      soilMoisture,
      landSurfaceTemp,
      burnedArea,
      drought,
    };
  } catch (error) {
    console.error('❌ Error fetching Earth Engine data:', error);
    // Return default values on error
    return {
      ndvi: 0.5,
      evi: 0.5,
      soilMoisture: 50,
      landSurfaceTemp: 20,
      burnedArea: 0,
      drought: 0.3,
    };
  }
};
