const axios = require('axios');

/**
 * Cricket API Service
 * 
 * This service integrates with cricket APIs to fetch live scores, fixtures, and results.
 * Currently configured for Cricbuzz unofficial API, but designed to be easily switchable.
 */

class CricketApiService {
  constructor() {
    this.baseURL = process.env.CRICKET_API_BASE_URL || 'https://cricbuzz-cricket.p.rapidapi.com';
    this.apiKey = process.env.CRICKET_API_KEY;
    this.internationalOnly = process.env.INTERNATIONAL_ONLY === 'true';
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests
  }

  /**
   * Check if API key is configured and valid
   */
  hasValidApiKey() {
    return !!(this.apiKey && this.apiKey.trim() !== '' && this.apiKey !== 'your_rapidapi_key_here');
  }

  /**
   * Make an API request with rate limiting and error handling
   */
  async makeRequest(endpoint, params = {}) {
    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
      }
      this.lastRequestTime = Date.now();

      const config = {
        method: 'GET',
        url: `${this.baseURL}${endpoint}`,
        params,
        headers: {}
      };

      // Add API key if available
      if (this.hasValidApiKey()) {
        config.headers['X-RapidAPI-Key'] = this.apiKey;
        config.headers['X-RapidAPI-Host'] = 'cricbuzz-cricket.p.rapidapi.com';
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error.message);
      
      // Return mock data if API fails (for development/demo purposes)
      if (!this.hasValidApiKey()) {
        console.log('Using mock data (no API key configured)');
        return this.getMockData(endpoint);
      }
      
      throw error;
    }
  }

  /**
   * Fetch live matches
   */
  async getLiveMatches() {
    try {
      const data = await this.makeRequest('/matches/v1/live');
      return this.transformLiveMatches(data);
    } catch (error) {
      console.error('Error fetching live matches:', error.message);
      return [];
    }
  }

  /**
   * Fetch upcoming fixtures
   */
  async getFixtures() {
    try {
      const data = await this.makeRequest('/matches/v1/upcoming');
      return this.transformFixtures(data);
    } catch (error) {
      console.error('Error fetching fixtures:', error.message);
      return [];
    }
  }

  /**
   * Fetch recent results
   */
  async getResults() {
    try {
      const data = await this.makeRequest('/matches/v1/recent');
      return this.transformResults(data);
    } catch (error) {
      console.error('Error fetching results:', error.message);
      return [];
    }
  }

  /**
   * Fetch detailed match information
   */
  async getMatchDetails(matchId) {
    try {
      const data = await this.makeRequest(`/mcenter/v1/${matchId}`);
      return this.transformMatchDetails(data);
    } catch (error) {
      console.error(`Error fetching match details for ${matchId}:`, error.message);
      return null;
    }
  }

  /**
   * Transform live matches data to our format
   */
  transformLiveMatches(data) {
    if (!data || !data.typeMatches) return [];
    
    const matches = [];
    
    for (const typeMatch of data.typeMatches) {
      if (!typeMatch.seriesMatches) continue;
      
      for (const seriesMatch of typeMatch.seriesMatches) {
        if (!seriesMatch.seriesAdWrapper || !seriesMatch.seriesAdWrapper.matches) continue;
        
        for (const matchInfo of seriesMatch.seriesAdWrapper.matches) {
          const match = matchInfo.matchInfo;
          if (!match) continue;
          
          // Filter international matches only
          if (this.internationalOnly && !this.isInternational(match)) continue;
          
          matches.push(this.formatMatch(match, 'live', seriesMatch.seriesAdWrapper.seriesName));
        }
      }
    }
    
    return matches;
  }

  /**
   * Transform fixtures data to our format
   */
  transformFixtures(data) {
    if (!data || !data.typeMatches) return [];
    
    const matches = [];
    
    for (const typeMatch of data.typeMatches) {
      if (!typeMatch.seriesMatches) continue;
      
      for (const seriesMatch of typeMatch.seriesMatches) {
        if (!seriesMatch.seriesAdWrapper || !seriesMatch.seriesAdWrapper.matches) continue;
        
        for (const matchInfo of seriesMatch.seriesAdWrapper.matches) {
          const match = matchInfo.matchInfo;
          if (!match) continue;
          
          // Filter international matches only
          if (this.internationalOnly && !this.isInternational(match)) continue;
          
          matches.push(this.formatMatch(match, 'upcoming', seriesMatch.seriesAdWrapper.seriesName));
        }
      }
    }
    
    return matches;
  }

  /**
   * Transform results data to our format
   */
  transformResults(data) {
    if (!data || !data.typeMatches) return [];
    
    const matches = [];
    
    for (const typeMatch of data.typeMatches) {
      if (!typeMatch.seriesMatches) continue;
      
      for (const seriesMatch of typeMatch.seriesMatches) {
        if (!seriesMatch.seriesAdWrapper || !seriesMatch.seriesAdWrapper.matches) continue;
        
        for (const matchInfo of seriesMatch.seriesAdWrapper.matches) {
          const match = matchInfo.matchInfo;
          if (!match) continue;
          
          // Filter international matches only
          if (this.internationalOnly && !this.isInternational(match)) continue;
          
          matches.push(this.formatMatch(match, 'completed', seriesMatch.seriesAdWrapper.seriesName));
        }
      }
    }
    
    return matches;
  }

  /**
   * Transform detailed match data to our format
   */
  transformMatchDetails(data) {
    if (!data || !data.matchInfo) return null;
    
    return this.formatMatch(data.matchInfo, data.matchInfo.status, data.matchInfo.seriesName);
  }

  /**
   * Format match data to our schema
   */
  formatMatch(match, status, seriesName = '') {
    const formatted = {
      externalId: match.matchId?.toString(),
      id: match.matchId?.toString() || `api-${Date.now()}`,
      teamA: match.team1?.teamName || 'Team A',
      teamB: match.team2?.teamName || 'Team B',
      format: this.getMatchFormat(match.matchFormat),
      status: this.getMatchStatus(match.state || status),
      venue: match.venueInfo?.ground || match.venue || '',
      date: match.startDate ? new Date(parseInt(match.startDate)) : new Date(),
      series: seriesName || match.seriesName || '',
      result: match.status || '',
      source: 'api',
      lastUpdated: new Date()
    };

    // Add innings data if available
    if (match.matchScore) {
      formatted.innings = this.parseInnings(match.matchScore);
    }

    return formatted;
  }

  /**
   * Parse innings data from API response
   */
  parseInnings(matchScore) {
    const innings = [];
    
    if (matchScore.team1Score) {
      innings.push(this.parseInningsData(matchScore.team1Score, 1));
    }
    
    if (matchScore.team2Score) {
      innings.push(this.parseInningsData(matchScore.team2Score, 2));
    }
    
    return innings;
  }

  /**
   * Parse individual innings data
   */
  parseInningsData(scoreData, inningsNumber) {
    const score = scoreData.inngs1 || scoreData;
    
    return {
      number: inningsNumber,
      battingTeam: score.battingTeam || '',
      bowlingTeam: score.bowlingTeam || '',
      runs: score.runs || 0,
      wickets: score.wickets || 0,
      overs: Math.floor((score.overs || 0)),
      balls: Math.round(((score.overs || 0) % 1) * 6),
      extras: {
        wides: 0,
        noBalls: 0,
        byes: 0,
        legByes: 0
      },
      batsmen: [],
      bowlers: [],
      ballsArray: []
    };
  }

  /**
   * Determine match format from API data
   */
  getMatchFormat(formatString) {
    if (!formatString) return 'Other';
    
    const format = formatString.toUpperCase();
    if (format.includes('TEST')) return 'Test';
    if (format.includes('ODI')) return 'ODI';
    if (format.includes('T20I')) return 'T20I';
    if (format.includes('T20')) return 'T20';
    
    return 'Other';
  }

  /**
   * Map API status to our status
   */
  getMatchStatus(state) {
    if (!state) return 'upcoming';
    
    const stateStr = state.toLowerCase();
    if (stateStr.includes('complete') || stateStr.includes('result')) return 'completed';
    if (stateStr.includes('live') || stateStr.includes('progress')) return 'live';
    
    return 'upcoming';
  }

  /**
   * Check if match is international
   */
  isInternational(match) {
    const format = this.getMatchFormat(match.matchFormat);
    return ['Test', 'ODI', 'T20I'].includes(format);
  }

  /**
   * Mock data for development/testing when API is unavailable
   */
  getMockData(endpoint) {
    console.log('Returning mock data for endpoint:', endpoint);
    
    if (endpoint.includes('/live')) {
      return {
        typeMatches: [{
          seriesMatches: [{
            seriesAdWrapper: {
              seriesName: 'Demo Series 2025',
              matches: [{
                matchInfo: {
                  matchId: 'demo-1',
                  team1: { teamName: 'Australia' },
                  team2: { teamName: 'England' },
                  matchFormat: 'TEST',
                  state: 'In Progress',
                  venueInfo: { ground: 'MCG' },
                  startDate: Date.now().toString(),
                  status: 'Day 1: Australia 250/4'
                }
              }]
            }
          }]
        }]
      };
    }
    
    if (endpoint.includes('/upcoming')) {
      return {
        typeMatches: [{
          seriesMatches: [{
            seriesAdWrapper: {
              seriesName: 'Upcoming Series 2025',
              matches: [{
                matchInfo: {
                  matchId: 'demo-2',
                  team1: { teamName: 'India' },
                  team2: { teamName: 'South Africa' },
                  matchFormat: 'ODI',
                  state: 'Preview',
                  venueInfo: { ground: 'Wankhede Stadium' },
                  startDate: (Date.now() + 86400000).toString()
                }
              }]
            }
          }]
        }]
      };
    }
    
    if (endpoint.includes('/recent')) {
      return {
        typeMatches: [{
          seriesMatches: [{
            seriesAdWrapper: {
              seriesName: 'Recent Series 2025',
              matches: [{
                matchInfo: {
                  matchId: 'demo-3',
                  team1: { teamName: 'New Zealand' },
                  team2: { teamName: 'Pakistan' },
                  matchFormat: 'T20I',
                  state: 'Complete',
                  venueInfo: { ground: 'Eden Park' },
                  startDate: (Date.now() - 86400000).toString(),
                  status: 'New Zealand won by 5 wickets'
                }
              }]
            }
          }]
        }]
      };
    }
    
    return { typeMatches: [] };
  }
}

module.exports = new CricketApiService();
