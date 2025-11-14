// ... code before lines 3095-3109

// Indicate a new over has just been completed
if (overCompleted) {
    currentInnings.showTicker = true; // Set the ticker visible
}

// ... code around lines 3095-3109

// ... code before lines 2888-3146

if (newBallBowled) {
    currentInnings.showTicker = false; // Clear the ticker visibility when the first ball of the new over is bowled
    // ... additional logic for recording the ball
}

// ... code after lines 2888-3146