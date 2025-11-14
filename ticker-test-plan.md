# Ticker Visibility Logic - Manual Test Plan

## Overview
Tests the ticker visibility feature that shows/hides a ticker after an over is completed.

## Prerequisites
1. Start the application: `npm start`
2. Open admin interface: http://localhost:3000/admin
3. Create a match and start an innings

## Test Case 1: Ticker Shows After Over Completion

**Test Steps:**
1. Create a match with England vs Australia
2. Start an innings with England batting
3. Set opening batsman and bowler
4. Record 6 legal deliveries (e.g., 1, 0, 4, 2, 0, 1 runs)
5. After the 6th ball, check `currentInnings.showTicker` in the match data

**Expected Result:**
- After 6th legal ball: `currentInnings.showTicker === true`
- The ticker should be visible to indicate "End of Over 1"

**Verification:**
- Use browser DevTools or check the API response from `/api/match` 
- Look for `innings[0].showTicker === true`

---

## Test Case 2: Ticker Hides When New Over Starts

**Test Steps:**
1. Continue from Test Case 1 (ticker is visible after over 1)
2. Change bowler if needed
3. Record the 1st ball of over 2 (any legal delivery, e.g., 1 run)
4. Check `currentInnings.showTicker` in the match data

**Expected Result:**
- After 1st legal ball of over 2: `currentInnings.showTicker === false`
- The ticker should be hidden as play has resumed

**Verification:**
- Use browser DevTools or check the API response from `/api/match`
- Look for `innings[0].showTicker === false`

---

## Test Case 3: Ticker Persistence Through Wides and No-Balls

**Test Steps:**
1. Create a new match
2. Start an innings
3. Record 5 legal balls
4. Record 2 wides (these are not legal deliveries)
5. Check that ticker is NOT showing (still in the same over)
6. Record the 6th legal ball to complete the over
7. Check that ticker IS showing now

**Expected Result:**
- After 5 legal balls + 2 wides: `showTicker === false` (over not complete)
- After 6th legal ball: `showTicker === true` (over complete)

**Rationale:**
- Only legal deliveries (not wides or no-balls) count toward the over
- The ticker only shows when a legal over (6 legal balls) is completed

---

## Test Case 4: Multiple Overs

**Test Steps:**
1. Create a match and start an innings
2. Record a complete over (6 legal balls)
   - Verify: `showTicker === true`
3. Record 1st ball of over 2
   - Verify: `showTicker === false`
4. Record remaining 5 balls of over 2 (total 6 legal balls)
   - Verify: `showTicker === true` again
5. Record 1st ball of over 3
   - Verify: `showTicker === false` again

**Expected Result:**
- Ticker shows/hides correctly for multiple overs
- Pattern: false → true (end of over) → false (new over starts) → true (end of next over)

---

## Test Case 5: Series Match Endpoint

**Test Steps:**
1. Create a series (e.g., The Ashes)
2. Create a match within the series
3. Start an innings
4. Follow the same test as Test Case 1-4, but using the series match API

**API Endpoint:**
- `/api/series/{seriesId}/match/{matchId}/ball`

**Expected Result:**
- Ticker behavior should be identical to legacy endpoint
- `currentInnings.showTicker` should toggle correctly

---

## Success Criteria

All test cases must pass:
- [x] Test Case 1: Ticker shows after over completion
- [x] Test Case 2: Ticker hides when new over starts
- [x] Test Case 3: Ticker persists through wides/no-balls
- [x] Test Case 4: Ticker works for multiple overs
- [x] Test Case 5: Series endpoint has same behavior

---

## API Testing Commands

### Check current match data:
```bash
curl http://localhost:3000/api/match
```

### Record a ball (legacy endpoint):
```bash
curl -X POST http://localhost:3000/api/match/ball \
  -H "Content-Type: application/json" \
  -H "x-session-id: YOUR_SESSION_ID" \
  -d '{
    "runs": 1,
    "extras": 0,
    "extraType": null,
    "wicket": false,
    "bowler": "Cummins"
  }'
```

### Check innings showTicker field:
```bash
curl http://localhost:3000/api/match | jq '.innings[0].showTicker'
```

---

## Notes

- The ticker logic only applies to legal deliveries (non-wides, non-no-balls)
- The ticker is set at the **innings** level, not match level
- Each innings tracks its own `showTicker` state independently
- Frontend components should check `currentInnings.showTicker` to display the ticker
