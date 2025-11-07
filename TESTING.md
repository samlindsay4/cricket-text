# Manual Testing Plan for Critical Bug Fixes

This document describes how to manually test all 6 critical bug fixes.

## Prerequisites
1. Start the application: `npm start`
2. Open admin interface: http://localhost:3000/admin
3. Open public scorecard in another tab: http://localhost:3000

## Bug 1: Scorecard Sync Issues

**Problem:** Edit a ball → public scorecard doesn't update, subsequent balls don't appear.

**Test Steps:**
1. Create a match and start an innings
2. Record 3-4 balls with various runs
3. Check public scorecard - note the total runs
4. In admin, edit the 2nd ball to change runs from 4 to 0
5. Check admin panel - runs should decrease by 4
6. **Check public scorecard - runs should also decrease by 4** ✓
7. Record another ball in admin
8. **Check public scorecard - new ball should appear** ✓

**Expected:** Admin and public always show the same score. New balls appear on both.

**Status:** ✓ FIXED (already working - verified single source of truth)

---

## Bug 2: Retired Hurt Batsmen Can't Resume

**Problem:** Batsman retires hurt → can't select them later to resume.

**Test Steps:**
1. Create a match and start an innings
2. Record a few balls so a batsman (e.g., Brook) scores 23 runs off 45 balls
3. Open retire batsman modal and retire Brook as "retired hurt"
4. Select a replacement batsman
5. Record more balls until another wicket falls
6. In the "Choose Incoming Batsman" modal:
   - **Brook should appear with ⚕️ indicator** ✓
   - **Should show: "Brook ⚕️ (Retired hurt - can resume: 23* off 45)"** ✓
7. Select Brook
8. **Brook should resume with 23 runs, 45 balls** ✓
9. Record more balls - runs should add to his existing 23

**Expected:** Retired hurt batsmen appear in dropdown and resume with preserved stats.

**Status:** ✓ FIXED

---

## Bug 3: Bowler Auto-Changes After Edit

**Problem:** Edit a ball → bowler automatically changes → wicket credited to wrong bowler.

**Test Steps:**
1. Create a match and start an innings
2. Record 6 balls from Cummins (complete an over)
3. Change bowler to Starc
4. Record 3 balls from Starc
5. Note current bowler: **Should be Starc**
6. Edit ball #2 (from Cummins' over) - change runs from 4 to 1
7. **Current bowler should STILL be Starc** ✓
8. Record next ball - should be credited to Starc
9. Record a wicket - **wicket should be credited to Starc** ✓

**Expected:** Editing a ball doesn't change the current bowler.

**Status:** ✓ FIXED

---

## Bug 4: Batter Disappears from Crease (Ghost Dismissal)

**Problem:** Only 3 wickets down, but one batsman vanished - not at crease, not in dropdown.

**Test Steps:**
1. Create a match and start an innings
2. Record balls and wickets normally
3. After every ball, verify:
   - **Exactly 2 batsmen are at the crease** ✓
   - **Wickets count = number of "out" batsmen** ✓
4. Check server console logs:
   - **Should NOT see "CRITICAL ERROR: Not exactly 2 batsmen at crease!"** ✓
   - **Should NOT see "CRITICAL ERROR: Wicket count mismatch!"** ✓

**Additional Validation:**
- Try to record a wicket with an invalid dismissed batsman (not striker/non-striker)
- **Should get error: "Dismissed batsman must be striker or non-striker"** ✓

**Expected:** Batsmen never disappear. Always 2 at crease (unless all out).

**Status:** ✓ FIXED

---

## Bug 5: Can't Select Openers on First Ball Wicket

**Problem:** Start innings → wicket on first ball → dismissal modal shows batsmen from previous innings.

**Test Steps:**
1. Create a match
2. Start Innings 1: England batting, select Duckett and Crawley as openers
3. First ball of innings → record a wicket
4. In the dismissal modal:
   - **Dismissed batsman dropdown should show "Duckett" and "Crawley"** ✓
   - **Should NOT show "Will be set when ball is recorded"** ✓
5. Select Duckett as dismissed
6. Choose incoming batsman (Pope)
7. **Should work correctly** ✓

**Expected:** Openers are available in dismissal modal on first ball.

**Status:** ✓ FIXED

---

## Bug 6: Run Rate Shows in 4th Innings

**Problem:** 4th innings shows "Current RR: 3.67, Required RR: 5.20" but user doesn't want it.

**Test Steps:**
1. Create a match and complete 3 innings (or simulate)
2. Start 4th innings with England chasing 327
3. Record some balls (e.g., 213/4 in 58 overs)
4. Check admin panel match situation:
   - **Should show: "Target: 327"** ✓
   - **Should show: "England need 114 runs to win"** ✓
   - **Should show: "6 wickets remaining"** ✓
   - **Should NOT show: "Current RR:"** ✓
5. Check public scorecard:
   - **Should show: "TARGET: 327"** ✓
   - **Should show: "England need 114 runs to win"** ✓
   - **Should show: "6 wickets remaining"** ✓
   - **Should NOT show: "Current RR:"** ✓

**Expected:** No run rate displayed in 4th innings.

**Status:** ✓ FIXED

---

## Complete Integration Test Scenario

**Scenario:** Complete match simulation testing all fixes together.

1. **Create Match**
   - England squad: Duckett, Crawley, Pope, Root, Brook, Stokes, Foakes, Woakes, Atkinson, Leach, Anderson
   - Australia squad: Khawaja, Warner, Labuschagne, Smith, Head, Green, Carey, Cummins, Starc, Lyon, Hazlewood

2. **Innings 1: England Batting**
   - Start innings with Duckett and Crawley opening
   - **Verify: Both openers at crease immediately** (Bug 5)
   - First ball: Duckett out bowled → select Pope
   - Score runs: Crawley 45*, Pope 23*
   - Pope retires hurt
   - **Verify: Pope marked as "retired hurt"** (Bug 2)
   - Bring in Brook
   - Score continues normally

3. **Later in Innings**
   - Brook scores 67 runs
   - Edit a ball to remove 4 runs
   - **Verify: Public scorecard updates immediately** (Bug 1)
   - **Verify: Current bowler doesn't change** (Bug 3)
   - Wicket falls
   - **Verify: Pope appears in incoming batsman dropdown with ⚕️** (Bug 2)
   - Select Pope to resume
   - **Verify: Pope continues from 23 runs** (Bug 2)

4. **Throughout**
   - **Verify: No ghost dismissals occur** (Bug 4)
   - **Verify: Always 2 batsmen at crease** (Bug 4)

5. **Complete Match to 4th Innings**
   - Set target (e.g., 327)
   - Start 4th innings chase
   - **Verify: No run rate displayed** (Bug 6)

---

## Acceptance Criteria

All 6 bugs must be verified as fixed:
- [x] Bug 1: Admin and public scorecard always in sync
- [x] Bug 2: Retired hurt batsmen can resume with preserved stats
- [x] Bug 3: Editing ball doesn't change current bowler
- [x] Bug 4: No ghost dismissals (state validation working)
- [x] Bug 5: Openers auto-added at innings start
- [x] Bug 6: No run rate in 4th innings display

---

## Notes

- All changes are minimal and surgical
- Existing functionality preserved
- No security vulnerabilities introduced (CodeQL scan: 0 alerts)
- Single source of truth: match.json
