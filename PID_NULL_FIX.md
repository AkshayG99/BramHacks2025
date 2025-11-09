# Fix: "Cannot read properties of null (reading 'pid')" Error

## Problem
The streaming control API was trying to access `streamingProcess.pid` without null-checking, causing a runtime error when the process was null or didn't have a PID yet.

## Root Cause
In `/app/api/stream/control/route.ts`, line 53:
```typescript
pid: streamingProcess.pid  // ❌ No null check
```

The `streamingProcess` could be:
- `null` if the process creation failed
- Without a `pid` if the process spawn failed
- Killed or terminated unexpectedly

## Solution Applied

### 1. **Fixed PID Access with Optional Chaining**
```typescript
// Before
pid: streamingProcess.pid

// After
pid: streamingProcess?.pid || null
```

### 2. **Added Process Creation Validation**
Added a check immediately after spawning:
```typescript
streamingProcess = spawn('bash', [scriptPath], { ... })

// Check if process was created successfully
if (!streamingProcess || !streamingProcess.pid) {
  streamingProcess = null
  return NextResponse.json({ 
    success: false, 
    message: 'Failed to start streaming server',
    status: 'stopped'
  }, { status: 500 })
}
```

### 3. **Added Error Event Handler**
Added proper error handling for process errors:
```typescript
streamingProcess.on('error', (error) => {
  console.error(`[Stream Server Process Error]:`, error)
  streamingProcess = null
})
```

## Files Modified
- `/app/api/stream/control/route.ts`

## Changes Summary
1. ✅ Line 53: Changed `streamingProcess.pid` to `streamingProcess?.pid || null`
2. ✅ Lines 30-37: Added process creation validation
3. ✅ Lines 44-47: Added error event handler
4. ✅ Line 80: Already had optional chaining (no change needed)
5. ✅ Line 104: Already had optional chaining (no change needed)

## Testing
To verify the fix:

1. **Start the dev server**:
```bash
npm run dev
```

2. **Navigate to live stream page**:
```
http://localhost:3000/live-fire-watch
```

3. **Test scenarios**:
   - Click "Start Stream" - should work without errors
   - Click "Stop Stream" - should work without errors
   - Check browser console - no null/undefined errors
   - Check terminal logs - proper error messages if spawn fails

## Error Prevention
The fix prevents errors in these scenarios:
- ✅ Process spawn failure
- ✅ Process terminated unexpectedly
- ✅ PID not assigned yet
- ✅ Null process reference
- ✅ Multiple rapid start/stop clicks

## Additional Improvements
- Added `error` event listener for better debugging
- Added validation after process creation
- Consistent null checking across all endpoints (POST and GET)
- Better error messages for failed process creation

## Related Files
- `/app/api/stream/control/route.ts` - Fixed file
- `/app/live-fire-watch/page.tsx` - Client code (no changes needed)
- `/stream_server.py` - Backend server (no changes needed)
- `/start_streaming.sh` - Shell script (no changes needed)

## Status
✅ **FIXED** - All null reference errors resolved with proper optional chaining and validation.
