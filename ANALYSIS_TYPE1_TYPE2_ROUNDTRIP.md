# Analysis: Type 1 vs Type 2 Roundtrip Response Handling

## Current Implementation Status

### ❌ **ISSUE FOUND: Type 2 Roundtrip NOT Properly Supported**

The codebase currently does **NOT** properly distinguish between:
- **Type 1 Roundtrip**: `journeyList.length === 2` (OB and IB separate) ✅ Handled
- **Type 2 Roundtrip**: `journeyList.length === 1` (OB and IB paired) ❌ **NOT Handled Correctly**

---

## Root Cause Analysis

### Problem 1: Missing `tripType` Prop in FlightResults
**Location**: [src/app/page.tsx](src/app/page.tsx#L286)

```typescript
// Current (line 286-293):
<FlightResults
  results={searchResults}
  passengers={searchPassengers}
  domainToken={domainToken}
  onBack={() => setScreen("home")}
  onSelectFlight={handleSelectFlight}
  // ❌ Missing: tripType={tripType}
/>
```

**Impact**: FlightResults has no way to know if the trip was a roundtrip or oneway search, so it ONLY relies on `journeyList.length` to determine the display mode.

### Problem 2: Incomplete Logic in FlightResults
**Location**: [src/Components/FlightResults.tsx](src/Components/FlightResults.tsx#L26-27)

```typescript
// Current logic (line 26-27):
const journeyList = results?.search?.flightDataList?.journeyList || results?.Search?.FlightDataList?.JourneyList || [];
const isRoundtrip = journeyList.length > 1;  // ❌ WRONG

// What it should be:
// - Type 1: journeyList.length > 1 AND tripType === "roundtrip" → Separate OB/IB UI
// - Type 2: journeyList.length === 1 AND tripType === "roundtrip" → Paired flights UI (like oneway)
// - Oneway: journeyList.length === 1 AND tripType === "oneway" → Normal oneway UI
```

**Current Behavior**:
- ✅ If `journeyList.length > 1`: Shows two-column UI (OB | IB) — **Type 1 Correct**
- ❌ If `journeyList.length === 1`: Shows single-column UI (oneway style) — **Type 2 Treated as Oneway**

---

## Requirements vs Implementation

| Scenario | Backend Response | Required UI | Current Behavior | Status |
|----------|-----------------|-----------|----------------|--------|
| **Type 1: Roundtrip Separate** | `journeyList[0]` (OB), `journeyList[1]` (IB) | Two columns: Select OB and IB separately | Shows two columns ✅ | ✅ Correct |
| **Type 2: Roundtrip Paired** | `journeyList[0]` (paired OB+IB flights) | Single column (like oneway): Select paired flight | Shows single column ❌ | ❌ Wrong Detection |
| **Oneway** | `journeyList[0]` (simple flights) | Single column: Select flight | Shows single column ✅ | ✅ Correct Display (but Type 2 confused with Oneway) |

---

## What Needs to be Fixed

### Fix 1: Pass `tripType` to FlightResults Component ✅
**File**: [src/app/page.tsx](src/app/page.tsx)

Add `tripType` prop when rendering FlightResults.

### Fix 2: Update FlightResults Interface ✅
**File**: [src/Components/FlightResults.tsx](src/Components/FlightResults.tsx)

Update `FlightResultsProps` to receive `tripType`.

### Fix 3: Update Detection Logic ✅
**File**: [src/Components/FlightResults.tsx](src/Components/FlightResults.tsx)

Replace:
```typescript
const isRoundtrip = journeyList.length > 1;
```

With:
```typescript
const isRoundtrip = journeyList.length > 1 || tripType === "roundtrip";
const isType1Roundtrip = journeyList.length > 1;
const isType2RoundtripPaired = journeyList.length === 1 && tripType === "roundtrip";
```

### Fix 4: Update Rendering Logic ✅
**File**: [src/Components/FlightResults.tsx](src/Components/FlightResults.tsx)

Currently around line 726 (in the conditional):
```typescript
if (isRoundtrip) {
  // Renders two-column UI
}
```

Should differentiate:
```typescript
if (isType1Roundtrip) {
  // Render two-column UI for separate OB/IB selection
} else if (isType2RoundtripPaired) {
  // Render single-column UI (like oneway) for paired flights
  // BUT: Remember it's a roundtrip when processing selections
} else {
  // Render normal oneway UI
}
```

---

## Data Flow Illustration

### Current (Broken for Type 2):
```
Backend Response with Type 2 (paired roundtrip)
  ↓
FlightResults receives results only
  ↓
Checks journeyList.length === 1
  ↓
Assumes ONEWAY and renders single-column UI
  ↓
❌ User thinks it's oneway but it's actually roundtrip paired
```

### After Fix:
```
Backend Response with Type 2 (paired roundtrip)
  ↓
FlightResults receives results AND tripType="roundtrip"
  ↓
Checks: journeyList.length === 1 AND tripType === "roundtrip"
  ↓
Recognizes as Type 2 Roundtrip Paired
  ↓
Renders paired-flight UI (single-column, oneway-style)
  ↓
✅ On selection: Treats as roundtrip (both flights in pair)
```

---

## Impact on User Experience

### Before Fix:
- **Type 2 Scenario**: User sees single-column flight list but it's actually a roundtrip with paired flights
- Booking confirmation page would need to handle this specially

### After Fix:
- **Type 2 Scenario**: User sees single-column flight list and system knows it's a Type 2 roundtrip
- Paired flights are processed correctly as a roundtrip

---

## Files to Modify

1. **[src/app/page.tsx](src/app/page.tsx#L286-L293)** - Add `tripType` prop
2. **[src/Components/FlightResults.tsx](src/Components/FlightResults.tsx#L7-L11)** - Update interface
3. **[src/Components/FlightResults.tsx](src/Components/FlightResults.tsx#L26-L30)** - Update detection logic
4. **[src/Components/FlightResults.tsx](src/Components/FlightResults.tsx#L726+)** - Update conditional rendering

---

## Summary

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| `tripType` not passed to FlightResults | 🔴 Critical | Type 2 roundtrip completely broken | Yet to implement |
| Detection logic incomplete | 🔴 Critical | Type 2 detected as oneway | Yet to implement |
| Rendering not differentiated | 🔴 Critical | Wrong UI for Type 2 | Yet to implement |
