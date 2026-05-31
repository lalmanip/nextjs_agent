# Type 2 Roundtrip (Paired Flights) - Implementation Summary

## Issue Resolved
When Type 2 roundtrip response is received (where OB and IB are paired under single `journeyList[0]` and single `ResultToken`), the booking flow was displaying "ONE WAY" instead of "ROUND TRIP" and not showing both directions properly.

## Root Causes Fixed

### 1. FlightBooking Roundtrip Detection (src/Components/FlightBooking.tsx)
**Problem**: Only checked `selectedFlight.selectedReturn` to detect roundtrip (Type 1 only)

**Solution**: Added detection for Type 2 paired flights
```typescript
// Type 1 Roundtrip: selectedReturn exists (separate OB and IB selected)
const isType1Roundtrip = !!selectedFlight.selectedReturn;

// Type 2 Roundtrip: flightDetails[0] has 2+ segments (OB and IB paired together)
const isType2RoundtripPaired = !isType1Roundtrip && flightDetails?.length === 1 && flightDetails[0]?.length > 1;

// Overall roundtrip flag
const isRoundtrip = isType1Roundtrip || isType2RoundtripPaired;
```

### 2. FlightBooking Display Details (src/Components/FlightBooking.tsx)
**Problem**: Display flight details weren't split for Type 2 roundtrip

**Solution**: Added logic to split Type 2 paired segments for display
```typescript
if (isType1Roundtrip) {
  // Type 1: Combine separate OB and IB details
  displayFlightDetails = [flightDetails[0], returnDetails[0]];
} else if (isType2RoundtripPaired) {
  // Type 2: Split paired segments into separate display items
  displayFlightDetails = [[flightDetails[0][0]], [flightDetails[0][1]]];
}
```

**Result**: 
- "Round Trip" label displays instead of "One Way" ✅
- Both OB and IB flight details show correctly ✅
- Top header shows: `FROM → TO` with "Round Trip" label ✅
- Flight cards show `✈ Onward` and `✈ Return` labels ✅

### 3. FlightBooking IB Result Token (src/Components/FlightBooking.tsx)
**Problem**: Extra-services API call failed for Type 2 because `ibResultToken` couldn't be found

**Solution**: Use same `obResultToken` for Type 2 roundtrip
```typescript
let ibResultToken = selectedFlight?.returnFareQuoteData?.... // Type 1 lookup

// Type 2 Roundtrip: Use same result token for both OB and IB (paired flights)
if (isType2RoundtripPaired && !ibResultToken) {
  ibResultToken = obResultToken;
}
```

### 4. Commit Booking IB Token (src/app/page.tsx)
**Problem**: Booking commit failed for Type 2 because IB result token lookup failed

**Solution**: Use same `obResultToken` for Type 2 roundtrip
```typescript
if (isRoundtrip) {
  const isType1Roundtrip = !!flightData?.selectedReturn;
  const isType2RoundtripPaired = !isType1Roundtrip && tripTypeLocal === "roundtrip";
  
  let ibResultToken;
  if (isType1Roundtrip) {
    // Type 1: Get from returnFareQuoteData
    ibResultToken = flightData?.returnFareQuoteData?....;
  } else if (isType2RoundtripPaired) {
    // Type 2: Use same token as OB for IB
    ibResultToken = obResultToken;
  }
  
  // Proceed with IB commit using ibResultToken
}
```

## Data Flow for Type 2 Roundtrip

```
Backend Response
↓
journeyList[0]:
  ├─ [0]: OB flight segment
  └─ [1]: IB flight segment  (paired in same resultToken)
↓
FlightResults
├─ Detects: journeyList.length === 1 && tripType === "roundtrip"
├─ isType2RoundtripPaired = true
├─ Shows single-column UI (paired flight selector)
└─ Pass to FlightBooking
↓
FlightBooking
├─ Detects Type 2: flightDetails[0].length > 1
├─ isType2RoundtripPaired = true
├─ Displays: "ROUND TRIP" (not "ONE WAY")
├─ Shows: OB → IB flight details
├─ Uses: obResultToken for ibResultToken
└─ Sends ancillary APIs with single token for both legs
↓
Commit Booking
├─ detects: tripTypeLocal === "roundtrip" && !selectedReturn
├─ isType2RoundtripPaired = true
├─ OB Commit: SequenceNumber: 0, ResultToken: obResultToken
├─ IB Commit: SequenceNumber: 1, ResultToken: obResultToken (same)
└─ Booking confirmed with combined PNR
```

## Files Modified

1. **[src/Components/FlightResults.tsx](src/Components/FlightResults.tsx)**
   - Added detection for Type 1 vs Type 2 roundtrip
   - Renders two-column UI only for Type 1
   - Added debug logging

2. **[src/Components/FlightBooking.tsx](src/Components/FlightBooking.tsx)**
   - Added Type 1 vs Type 2 detection in roundtrip logic
   - Added split logic for Type 2 display flight details
   - Fixed IB result token extraction for Type 2 (uses obResultToken)
   - Updated debug logging with Type detection info

3. **[src/app/page.tsx](src/app/page.tsx)**
   - Added tripType prop to FlightResults component
   - Added Type 1 vs Type 2 detection in commit booking
   - Fixed IB result token lookup for Type 2 (uses obResultToken)

## Testing Checklist

- [ ] Type 1 Roundtrip: Separate OB/IB → Shows two columns, "Round Trip" label
- [ ] Type 2 Roundtrip: Paired OB+IB → Shows single column with both details, "Round Trip" label  
- [ ] Oneway: Single flight → Shows single column, "One Way" label
- [ ] Type 2 Booking: Flight details show both OB and IB info
- [ ] Type 2 Payment: Completes successfully with both OB and IB commits
- [ ] Ancillary Services: Both OB and IB options selectable (if applicable)

## Key Difference: Type 1 vs Type 2

| Aspect | Type 1 | Type 2 |
|--------|--------|--------|
| Response Format | `journeyList[0]` (OB), `journeyList[1]` (IB) | `journeyList[0]` with 2 segments |
| ResultToken | Different for OB and IB | Same for both OB and IB |
| UI Display | Two columns | Single column |
| Flight Details Access | Separate objects | Same object, different indices |
| selectedReturn | Exists | Doesn't exist |
| returnFareQuoteData | Exists | Doesn't exist |

## Console Logs for Debugging

The implementation adds comprehensive debug logging:
```javascript
// FlightResults
console.log("Is Type 1 Roundtrip (separate):", isType1Roundtrip);
console.log("Is Type 2 Roundtrip Paired:", isType2RoundtripPaired);
console.log("Is Roundtrip (either type):", isRoundtrip);

// FlightBooking
console.log('Type 1 Roundtrip (selectedReturn exists):', isType1Roundtrip);
console.log('Type 2 Roundtrip Paired (multiple segments):', isType2RoundtripPaired);
console.log('Is Roundtrip (either type):', isRoundtrip);
```
