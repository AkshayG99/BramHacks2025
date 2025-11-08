# Google Earth Engine Integration

## Overview

This project now includes Google Earth Engine integration to provide enhanced satellite data for wildfire risk assessment, including:

- **Vegetation Health (NDVI/EVI)**: Tracks dryness and vegetation stress
- **Soil Moisture**: Monitors drought conditions
- **Land Surface Temperature**: Identifies heat accumulation
- **Burned Area Index**: Historical burn patterns
- **Drought Index**: Composite drought severity metric

## Setup Instructions

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Earth Engine API for your project

### 2. Create a Service Account

1. Navigate to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Give it a name (e.g., "earth-engine-service")
4. Grant it the **Earth Engine Resource Viewer** role
5. Click **Done**

### 3. Generate Key File

1. Click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Choose **JSON** format
5. Download the key file

### 4. Configure Environment Variables

1. Open the downloaded JSON key file
2. Copy the entire contents
3. Add to your `.env.local` file:

```bash
EARTH_ENGINE_PRIVATE_KEY={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"your-service-account@your-project.iam.gserviceaccount.com",...}
EARTH_ENGINE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
```

**Important**: The `EARTH_ENGINE_PRIVATE_KEY` should be the entire JSON object as a single line.

### 5. Register for Earth Engine

1. Go to [Earth Engine](https://earthengine.google.com/)
2. Sign up for Earth Engine access with your Google account
3. Wait for approval (usually instant for standard access)

### 6. Restart Your Development Server

```bash
npm run dev
```

## Features

Once configured, the application will:

- Fetch real-time satellite data for each location query
- Display vegetation health, soil moisture, and temperature data
- Include satellite data in AI risk assessment
- Show drought index and burned area history

## Data Sources

- **MODIS MOD13A2**: 16-day vegetation indices (NDVI/EVI)
- **MODIS MOD11A1**: Daily land surface temperature
- **SMAP Soil Moisture**: 10km resolution soil moisture
- **MODIS MCD64A1**: Monthly burned area product

## Fallback Behavior

If Earth Engine credentials are not configured:
- The application will continue to work normally
- Default values will be used for satellite data
- A warning will be logged in the console
- Risk assessment will rely on weather and historical fire data only

## Troubleshooting

### "Earth Engine credentials not found"
- Ensure `EARTH_ENGINE_PRIVATE_KEY` and `EARTH_ENGINE_CLIENT_EMAIL` are set in `.env.local`
- Verify the JSON format is correct (no line breaks in the private key value)

### "Earth Engine initialization failed"
- Check that Earth Engine API is enabled in Google Cloud Console
- Verify service account has Earth Engine Resource Viewer role
- Ensure you have signed up for Earth Engine access

### "Earth Engine authentication failed"
- The private key format might be incorrect
- Try copying the JSON again, ensuring it's a single line
- Check that the client email matches your service account

## Cost

Earth Engine is free for:
- Non-commercial research
- Education
- Small-scale commercial use

For larger commercial applications, check [Earth Engine pricing](https://earthengine.google.com/pricing/).
