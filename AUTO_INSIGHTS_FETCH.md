# Auto-Fetch Insights on Location Change

## Implementation Summary

Successfully implemented automatic insights refetching when the user changes location.

## Changes Made

### 1. **app/page.tsx**
- ✅ Already had `useEffect` that watches `selectedLocation` and automatically fetches insights
- ✅ Added `isInsightsLoading` prop to `<Header>` component

### 2. **components/Header.tsx**

#### Added Props:
- `isInsightsLoading?: boolean` - Indicates when insights are being fetched

#### New Auto-Expand Feature:
```typescript
useEffect(() => {
  if (isInsightsLoading) {
    setIsInsightsExpanded(true)
  }
}, [isInsightsLoading, selectedLocation])
```
- Automatically expands the insights dropdown when fetching new data
- Ensures user sees loading state when changing locations

#### Loading State Updates:
- **Dropdown Button**: Shows spinner when `isInsightsLoading || !insights`
- **Loading Skeleton**: Displays when `(isInsightsLoading || !insights) && isInsightsExpanded`
- **Insights Content**: Only shows when `insights && !isInsightsLoading && isInsightsExpanded`

## How It Works

1. **User Changes Location**:
   - Clicks on map
   - Searches for a new location
   - Selects a suggestion

2. **Automatic Fetch Triggered**:
   - `selectedLocation` state updates in `app/page.tsx`
   - `useEffect` detects change and sets `isInsightsLoading = true`
   - Fetches new insights from `/api/insights` with new coordinates

3. **Visual Feedback**:
   - Insights dropdown automatically expands
   - Loading spinner appears in dropdown header
   - Animated skeleton cards show while fetching
   - Badge count "4" is hidden during load

4. **Data Received**:
   - `insights` state updates with new data
   - `isInsightsLoading` set to `false`
   - Loading skeleton fades out with 500ms animation
   - New insights cards fade in with staggered 50ms delays
   - Each card slides in from top with smooth animation

## User Experience

- ✅ **No Manual Refresh Needed**: Insights automatically update on location change
- ✅ **Clear Loading State**: Spinner and skeleton cards show progress
- ✅ **Auto-Expand**: Dropdown opens automatically to show new data
- ✅ **Smooth Transitions**: All animations are fluid and professional
- ✅ **Prevents Stale Data**: Old insights cleared before new fetch starts

## Technical Details

### Fetch Flow:
```
Location Change → useEffect triggers → 
setInsightsLoading(true) → 
POST /api/insights → 
Gemini API + Weather API + Fire Data → 
setInsights(newData) → 
setInsightsLoading(false) → 
Animate in new cards
```

### Error Handling:
- Network errors display in red error message
- Failed fetches don't crash the UI
- Previous insights remain visible if fetch fails
- User can retry by changing location again

### Performance:
- Fetch cancellation on component unmount
- Debounced suggestion fetching (250ms)
- Abort controllers prevent memory leaks
- Smooth animations don't block UI

## Testing

To test the feature:
1. Open the app and search for a location (e.g., "Los Angeles")
2. Watch insights dropdown automatically expand with loading state
3. Wait for insights to load with staggered card animations
4. Change to another location (e.g., "New York")
5. Observe automatic refetch with loading spinner
6. Verify old data is cleared before new data appears

## Notes

- Insights include: Weather, AI Analysis, Recommendations, Fire Risk
- Each section animates independently with 50ms stagger
- Loading state respects user's collapse/expand preference
- Auto-expand only happens during initial load per location change
