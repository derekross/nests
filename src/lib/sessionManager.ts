/**
 * Session manager to handle multiple browser tabs/windows
 * Prevents conflicts when joining the same nest from multiple tabs
 */

interface SessionInfo {
  nestNaddr: string;
  roomId: string;
  timestamp: number;
  tabId: string;
}

class SessionManager {
  private tabId: string;
  private storageKey = 'nests-active-sessions';
  
  constructor() {
    this.tabId = this.generateTabId();
    this.setupStorageListener();
    this.cleanupOnUnload();
  }

  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey) {
        console.log('Session storage changed in another tab');
        // Could emit events here if needed
      }
    });
  }

  private cleanupOnUnload() {
    window.addEventListener('beforeunload', () => {
      this.removeSession();
    });
  }

  private getActiveSessions(): SessionInfo[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      
      const sessions: SessionInfo[] = JSON.parse(stored);
      
      // Clean up old sessions (older than 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const activeSessions = sessions.filter(session => session.timestamp > fiveMinutesAgo);
      
      if (activeSessions.length !== sessions.length) {
        localStorage.setItem(this.storageKey, JSON.stringify(activeSessions));
      }
      
      return activeSessions;
    } catch (error) {
      console.warn('Failed to get active sessions:', error);
      return [];
    }
  }

  private saveActiveSessions(sessions: SessionInfo[]) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(sessions));
    } catch (error) {
      console.warn('Failed to save active sessions:', error);
    }
  }

  /**
   * Check if another tab is already connected to this nest
   */
  isNestActiveInAnotherTab(nestNaddr: string): boolean {
    const sessions = this.getActiveSessions();
    return sessions.some(session => 
      session.nestNaddr === nestNaddr && 
      session.tabId !== this.tabId
    );
  }

  /**
   * Get information about other tabs connected to this nest
   */
  getOtherTabsForNest(nestNaddr: string): SessionInfo[] {
    const sessions = this.getActiveSessions();
    return sessions.filter(session => 
      session.nestNaddr === nestNaddr && 
      session.tabId !== this.tabId
    );
  }

  /**
   * Register this tab as connected to a nest
   */
  registerSession(nestNaddr: string, roomId: string) {
    const sessions = this.getActiveSessions();
    
    // Remove any existing session for this tab
    const filteredSessions = sessions.filter(session => session.tabId !== this.tabId);
    
    // Add new session
    const newSession: SessionInfo = {
      nestNaddr,
      roomId,
      timestamp: Date.now(),
      tabId: this.tabId,
    };
    
    filteredSessions.push(newSession);
    this.saveActiveSessions(filteredSessions);
    
    console.log('Registered session:', newSession);
  }

  /**
   * Remove this tab's session
   */
  removeSession() {
    const sessions = this.getActiveSessions();
    const filteredSessions = sessions.filter(session => session.tabId !== this.tabId);
    this.saveActiveSessions(filteredSessions);
    
    console.log('Removed session for tab:', this.tabId);
  }

  /**
   * Get this tab's ID
   */
  getTabId(): string {
    return this.tabId;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getAllActiveSessions(): SessionInfo[] {
    return this.getActiveSessions();
  }
}

// Create singleton instance
export const sessionManager = new SessionManager();