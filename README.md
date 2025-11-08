# Forest Fire Insights

A beautiful, Apple-inspired web application for analyzing forest fire risks and weather conditions at any location on Earth.

## Features

- 🗺️ **Interactive Google Maps** - Click anywhere to analyze a location
- 🔥 **Fire Risk Assessment** - Real-time risk scoring and historical fire data
- 🌡️ **Weather Insights** - Humidity, temperature, wind speed, and visibility
- 🎨 **Elegant UI** - Apple-inspired design with glassmorphism effects
- ⚡ **Smooth Animations** - Framer Motion powered transitions
- 📱 **Manual SMS Alerts** - Send a text warning when you detect nearby fires

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables (Optional):**
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_MESSAGING_SERVICE_SID=
   ALERT_DEFAULT_PHONE=
   ```
   
   **Note:** You can also use `NEXT_PUBLIC_GEMINI_API_KEY` if you prefer, but `GEMINI_API_KEY` is more secure as it's only accessible server-side.
   
   **Note:** SMS alerts require the Twilio variables above—without them, the manual “Send text alert” button will respond with an error.
   
   **Note:** The app works without API keys! It uses:
   - **Leaflet + OpenStreetMap** (free, no API key needed) for maps
   - **Mock data** for weather and fire data
   - **Gemini API** (optional) for AI-powered insights and recommendations
   
   To get a Gemini API key (free): [Google AI Studio](https://makersuite.google.com/app/apikey)

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Leaflet + OpenStreetMap** - Free, open-source maps (no API key needed!)
- **Google Gemini API** - AI-powered insights and recommendations (optional)
- **Framer Motion** - Smooth animations
- **Tailwind CSS** - Styling
- **Lucide React** - Beautiful icons

## Usage

1. Click anywhere on the map to select a location
2. The insights panel will slide in from the right
3. View fire risk assessment, weather conditions, and recommendations
4. Click the X button or outside the panel to close

## APIs & Data Sources

- **Leaflet + OpenStreetMap** - Completely free, no API key needed for maps
- **Google Gemini API** (Optional) - AI-powered analysis and recommendations. Get your free key at [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Mock Data** - Weather and fire data are simulated. Can be extended with real APIs if needed

## Design Philosophy

This application features an **Apple-inspired UI** with:
- **Glassmorphism** - Frosted glass effects with backdrop blur
- **Smooth Animations** - Spring-based transitions using Framer Motion
- **Elegant Typography** - System fonts for native feel
- **Minimalist Layout** - Clean, focused interface
- **Dark Mode Ready** - Beautiful dark panels with transparency

## Notes

- **No API keys required!** The app works out of the box with free OpenStreetMap tiles
- Add your Gemini API key for AI-powered insights (completely optional)
- All data uses intelligent mock generation based on location
- The app gracefully handles missing API keys with fallback data
