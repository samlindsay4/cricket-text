const cron = require('node-cron');
const cricketApi = require('./cricketApi');
const Match = require('../models/Match');
const { isConnected } = require('../config/database');

/**
 * Sync Service
 * 
 * Background service that periodically syncs cricket data from the API to the database
 */

class SyncService {
  constructor() {
    this.liveTask = null;
    this.fixturesTask = null;
    this.resultsTask = null;
    this.isRunning = false;
    
    // Configurable intervals (in milliseconds)
    this.liveInterval = parseInt(process.env.SYNC_LIVE_INTERVAL) || 60000; // 60 seconds
    this.fixturesInterval = parseInt(process.env.SYNC_FIXTURES_INTERVAL) || 900000; // 15 minutes
    this.resultsInterval = parseInt(process.env.SYNC_RESULTS_INTERVAL) || 900000; // 15 minutes
    
    this.enableSync = process.env.ENABLE_SYNC_SERVICE !== 'false';
  }

  /**
   * Start the sync service
   */
  start() {
    if (!this.enableSync) {
      console.log('Sync service is disabled');
      return;
    }

    if (this.isRunning) {
      console.log('Sync service is already running');
      return;
    }

    console.log('Starting sync service...');
    this.isRunning = true;

    // Initial sync
    this.syncAll();

    // Schedule periodic syncs
    this.scheduleLiveSync();
    this.scheduleFixturesSync();
    this.scheduleResultsSync();

    console.log('Sync service started successfully');
    console.log(`- Live matches: every ${this.liveInterval / 1000}s`);
    console.log(`- Fixtures: every ${this.fixturesInterval / 1000}s`);
    console.log(`- Results: every ${this.resultsInterval / 1000}s`);
  }

  /**
   * Stop the sync service
   */
  stop() {
    console.log('Stopping sync service...');
    
    if (this.liveTask) {
      this.liveTask.stop();
      this.liveTask = null;
    }
    
    if (this.fixturesTask) {
      this.fixturesTask.stop();
      this.fixturesTask = null;
    }
    
    if (this.resultsTask) {
      this.resultsTask.stop();
      this.resultsTask = null;
    }
    
    this.isRunning = false;
    console.log('Sync service stopped');
  }

  /**
   * Schedule live matches sync
   */
  scheduleLiveSync() {
    // Convert milliseconds to cron format
    const seconds = Math.floor(this.liveInterval / 1000);
    
    if (seconds < 60) {
      // Every X seconds
      const cronExpression = `*/${seconds} * * * * *`;
      this.liveTask = cron.schedule(cronExpression, () => {
        this.syncLiveMatches();
      });
    } else {
      // Every X minutes
      const minutes = Math.floor(seconds / 60);
      const cronExpression = `*/${minutes} * * * *`;
      this.liveTask = cron.schedule(cronExpression, () => {
        this.syncLiveMatches();
      });
    }
  }

  /**
   * Schedule fixtures sync
   */
  scheduleFixturesSync() {
    const minutes = Math.floor(this.fixturesInterval / 60000);
    const cronExpression = `*/${minutes} * * * *`;
    
    this.fixturesTask = cron.schedule(cronExpression, () => {
      this.syncFixtures();
    });
  }

  /**
   * Schedule results sync
   */
  scheduleResultsSync() {
    const minutes = Math.floor(this.resultsInterval / 60000);
    const cronExpression = `*/${minutes} * * * *`;
    
    this.resultsTask = cron.schedule(cronExpression, () => {
      this.syncResults();
    });
  }

  /**
   * Sync all data
   */
  async syncAll() {
    await this.syncLiveMatches();
    await this.syncFixtures();
    await this.syncResults();
  }

  /**
   * Sync live matches
   */
  async syncLiveMatches() {
    if (!isConnected()) {
      console.log('Database not connected, skipping live matches sync');
      return;
    }

    try {
      console.log('[Sync] Fetching live matches...');
      const matches = await cricketApi.getLiveMatches();
      
      if (!matches || matches.length === 0) {
        console.log('[Sync] No live matches found');
        return;
      }

      console.log(`[Sync] Found ${matches.length} live matches`);
      
      for (const matchData of matches) {
        await this.upsertMatch(matchData);
      }
      
      console.log('[Sync] Live matches sync completed');
    } catch (error) {
      console.error('[Sync] Error syncing live matches:', error.message);
    }
  }

  /**
   * Sync fixtures
   */
  async syncFixtures() {
    if (!isConnected()) {
      console.log('Database not connected, skipping fixtures sync');
      return;
    }

    try {
      console.log('[Sync] Fetching fixtures...');
      const matches = await cricketApi.getFixtures();
      
      if (!matches || matches.length === 0) {
        console.log('[Sync] No fixtures found');
        return;
      }

      console.log(`[Sync] Found ${matches.length} fixtures`);
      
      for (const matchData of matches) {
        await this.upsertMatch(matchData);
      }
      
      console.log('[Sync] Fixtures sync completed');
    } catch (error) {
      console.error('[Sync] Error syncing fixtures:', error.message);
    }
  }

  /**
   * Sync results
   */
  async syncResults() {
    if (!isConnected()) {
      console.log('Database not connected, skipping results sync');
      return;
    }

    try {
      console.log('[Sync] Fetching results...');
      const matches = await cricketApi.getResults();
      
      if (!matches || matches.length === 0) {
        console.log('[Sync] No results found');
        return;
      }

      console.log(`[Sync] Found ${matches.length} results`);
      
      for (const matchData of matches) {
        await this.upsertMatch(matchData);
      }
      
      console.log('[Sync] Results sync completed');
    } catch (error) {
      console.error('[Sync] Error syncing results:', error.message);
    }
  }

  /**
   * Insert or update a match in the database
   */
  async upsertMatch(matchData) {
    try {
      const filter = { id: matchData.id };
      const update = {
        ...matchData,
        lastUpdated: new Date()
      };
      
      const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      };

      const match = await Match.findOneAndUpdate(filter, update, options);
      
      if (match) {
        console.log(`[Sync] Updated match: ${matchData.teamA} vs ${matchData.teamB} (${matchData.status})`);
      }
    } catch (error) {
      console.error(`[Sync] Error upserting match ${matchData.id}:`, error.message);
    }
  }

  /**
   * Manual sync trigger (for testing or on-demand sync)
   */
  async triggerSync(type = 'all') {
    console.log(`[Sync] Manual sync triggered: ${type}`);
    
    switch (type) {
      case 'live':
        await this.syncLiveMatches();
        break;
      case 'fixtures':
        await this.syncFixtures();
        break;
      case 'results':
        await this.syncResults();
        break;
      case 'all':
      default:
        await this.syncAll();
        break;
    }
  }

  /**
   * Get sync service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      enabled: this.enableSync,
      intervals: {
        live: `${this.liveInterval / 1000}s`,
        fixtures: `${this.fixturesInterval / 1000}s`,
        results: `${this.resultsInterval / 1000}s`
      },
      tasks: {
        live: this.liveTask ? 'scheduled' : 'not scheduled',
        fixtures: this.fixturesTask ? 'scheduled' : 'not scheduled',
        results: this.resultsTask ? 'scheduled' : 'not scheduled'
      }
    };
  }
}

module.exports = new SyncService();
