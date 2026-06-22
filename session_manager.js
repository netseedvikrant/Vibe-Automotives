/**
 * VIBE Enterprise Portal - Unified Session & Inactivity Manager
 * Implements Option 3 (Complete Package):
 * - Inactivity detector (15 mins + 60s warning countdown)
 * - Tab synchronization (Sync sessionStorage with localStorage fallback)
 * - Supabase Activity Log Audit Trail Integration
 */

(function () {
    // 1. CONFIGURATION
    const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    const WARNING_COUNTDOWN_S = 5 * 60; // 5 minutes warning (300 seconds)
    const RESTRICTED_PAGES = [
        'portal.html',
        'ceo-dashboard.html',
        'ceo-eom.html',
        'ceo-staff-management.html',
        'autodev-landing.html',
        'automfg-landing.html',
        'procurement-landing.html'
    ];

    let inactivityTimer = null;
    let warningInterval = null;
    let countdownValue = WARNING_COUNTDOWN_S;
    let isWarningActive = false;

    // Helper: Verify if ID is a valid UUID
    function isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    // Helper: Log session activity to Supabase public.activity_logs
    async function logSessionActivity(actionType, actionDescription) {
        try {
            // Get user session data
            const userSessionStr = sessionStorage.getItem('vibe_user') || localStorage.getItem('vibe_user');
            if (!userSessionStr) return;
            const userSession = JSON.parse(userSessionStr);
            const userId = userSession.id;
            const userEmail = userSession.email;

            // Wait for Supabase initialization
            if (!window.supabaseClient && window.supabaseInit) {
                await window.supabaseInit;
            }

            const client = window.supabaseClient;
            if (!client) {
                console.warn("SessionManager: Supabase client not initialized, skipping log save.");
                return;
            }

            const dbUserId = isValidUUID(userId) ? userId : null;
            const descriptionWithUser = `[Session Audit] ${userEmail}: ${actionDescription}`;

            const { error } = await client.from('activity_logs').insert({
                user_id: dbUserId,
                action_type: actionType,
                action_description: descriptionWithUser,
                timestamp: new Date().toISOString()
            });

            if (error) {
                console.error("SessionManager: Failed to write session log to Supabase:", error);
            } else {
                console.log(`SessionManager: Logged '${actionType}' to database.`);
            }
        } catch (err) {
            console.error("SessionManager: Error saving activity log:", err);
        }
    }

    // 2. SESSION STORAGE SYNCHRONIZATION (Option 2)
    function syncSession() {
        const path = window.location.pathname;
        const pageName = path.substring(path.lastIndexOf('/') + 1);
        const isRestricted = RESTRICTED_PAGES.some(page => pageName.startsWith(page));

        const sessionUser = sessionStorage.getItem('vibe_user');
        const localUser = localStorage.getItem('vibe_user');

        if (sessionUser) {
            // Sync session to localStorage to make it persistent across tab closes
            if (!localUser) {
                localStorage.setItem('vibe_user', sessionUser);
            }
        } else if (localUser) {
            // Recover session from localStorage (Option 2 Tab Sync)
            sessionStorage.setItem('vibe_user', localUser);
            console.log("SessionManager: Recovered session state from persistent storage.");
            
            // Log that session was restored/continued
            logSessionActivity('session_restore', 'Session restored from persistent tab storage.');
        } else if (isRestricted) {
            // Unauthenticated user attempting to access restricted page
            console.warn("SessionManager: Unauthenticated access block. Redirecting to login portal.");
            window.location.href = 'index.html';
            return false;
        }

        // Auto-redirect from login pages if already authenticated
        if ((pageName === 'index.html' || pageName === 'direct-login.html' || pageName === '') && (sessionUser || localUser)) {
            console.log("SessionManager: Already authenticated. Redirecting to Unified Portal.");
            window.location.href = 'portal.html';
        }

        return true;
    }

    // 3. INACTIVITY DETECTOR & TIMER MANAGEMENT (Option 1 & Multi-tab Sync)
    let lastActivityTime = Date.now();
    let lastStorageWrite = 0;

    function updateActivityState() {
        if (isWarningActive) return;

        const now = Date.now();
        lastActivityTime = now;

        // Throttle writing to localStorage to once every 2 seconds to optimize performance
        if (now - lastStorageWrite > 2000) {
            localStorage.setItem('vibe_last_activity', now.toString());
            lastStorageWrite = now;
        }

        resetInactivityTimer();
    }

    function resetInactivityTimer() {
        if (isWarningActive) return; // Don't reset if lockout dialog is visible

        clearTimeout(inactivityTimer);
        
        // Calculate remaining time until warning modal should show
        const elapsed = Date.now() - lastActivityTime;
        const remainingTime = INACTIVITY_TIMEOUT_MS - elapsed;
        
        inactivityTimer = setTimeout(showInactivityWarning, Math.max(0, remainingTime));
    }

    function setupActivityListeners() {
        const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
        events.forEach(event => {
            window.addEventListener(event, updateActivityState, { passive: true });
        });

        // Initialize activity timestamps
        const savedLastActivity = localStorage.getItem('vibe_last_activity');
        if (savedLastActivity) {
            lastActivityTime = parseInt(savedLastActivity, 10);
        } else {
            lastActivityTime = Date.now();
            localStorage.setItem('vibe_last_activity', lastActivityTime.toString());
        }

        // Listen for visibility change and focus events to catch when a tab wakes up
        document.addEventListener('visibilitychange', checkSessionOnWake);
        window.addEventListener('focus', checkSessionOnWake);

        // Listen to storage events for cross-tab sync
        window.addEventListener('storage', handleStorageChange);

        // Setup a periodic check interval (every 5 seconds) in case setTimeout is throttled in background
        setInterval(checkSessionOnWake, 5000);

        resetInactivityTimer();
    }

    function checkSessionOnWake() {
        const sessionUser = sessionStorage.getItem('vibe_user');
        const localUser = localStorage.getItem('vibe_user');

        // If user logged out in another tab
        if (!sessionUser && !localUser) {
            const path = window.location.pathname;
            const pageName = path.substring(path.lastIndexOf('/') + 1);
            const isRestricted = RESTRICTED_PAGES.some(page => pageName.startsWith(page));
            if (isRestricted) {
                console.warn("SessionManager: Session cleared in another tab. Signing out.");
                performSignOut();
                return;
            }
        }

        // Read last activity time from storage to get the most up-to-date value across all tabs
        const savedLastActivity = localStorage.getItem('vibe_last_activity');
        if (savedLastActivity) {
            lastActivityTime = parseInt(savedLastActivity, 10);
        }

        const elapsed = Date.now() - lastActivityTime;

        if (elapsed >= INACTIVITY_TIMEOUT_MS + (WARNING_COUNTDOWN_S * 1000)) {
            // Expired completely
            if (isWarningActive) {
                closeWarningModal();
            }
            logoutDueToInactivity();
        } else if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            // In warning zone
            const remainingWarning = WARNING_COUNTDOWN_S - Math.floor((elapsed - INACTIVITY_TIMEOUT_MS) / 1000);
            if (remainingWarning <= 0) {
                if (isWarningActive) {
                    closeWarningModal();
                }
                logoutDueToInactivity();
            } else {
                showInactivityWarning(remainingWarning);
            }
        } else {
            // Still active, ensure warning modal is closed and reset the timer with remaining time
            if (isWarningActive) {
                closeWarningModal();
            }
            clearTimeout(inactivityTimer);
            const remainingToWarn = INACTIVITY_TIMEOUT_MS - elapsed;
            inactivityTimer = setTimeout(showInactivityWarning, Math.max(0, remainingToWarn));
        }
    }

    function handleStorageChange(e) {
        if (e.key === 'vibe_user' && !e.newValue) {
            // Session removed in another tab (Sign out)
            const path = window.location.pathname;
            const pageName = path.substring(path.lastIndexOf('/') + 1);
            const isRestricted = RESTRICTED_PAGES.some(page => pageName.startsWith(page));
            if (isRestricted) {
                performSignOut();
            }
        } else if (e.key === 'vibe_last_activity' && e.newValue) {
            // User active in another tab, sync last activity time
            lastActivityTime = parseInt(e.newValue, 10);
            if (!isWarningActive) {
                resetInactivityTimer();
            } else {
                // If warning modal is open but user became active in another tab, extend session silently
                extendSessionSilent();
            }
        }
    }

    function extendSessionSilent() {
        clearInterval(warningInterval);
        isWarningActive = false;
        closeWarningModal();
        resetInactivityTimer();
    }

    function closeWarningModal() {
        const modal = document.getElementById('inactivity-warning-modal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => { modal.remove(); }, 300);
        }
    }

    function formatTimeRemaining(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 4. MOCKUP WARNING MODAL & GLOW EFFECTS
    function showInactivityWarning(initialCountdown) {
        if (isWarningActive) {
            // Modal is already open, just update the countdown if needed
            if (initialCountdown !== undefined) {
                countdownValue = initialCountdown;
                const clock = document.getElementById('warning-countdown');
                if (clock) clock.textContent = formatTimeRemaining(countdownValue);
            }
            return;
        }

        isWarningActive = true;
        countdownValue = initialCountdown !== undefined ? initialCountdown : WARNING_COUNTDOWN_S;
        
        // Log that warning was shown
        logSessionActivity('session_warn', 'User prompted with inactivity timeout warning.');

        // Inject dynamic style for glowing modal animation
        if (!document.getElementById('session-warning-styles')) {
            const styles = document.createElement('style');
            styles.id = 'session-warning-styles';
            styles.textContent = `
                @keyframes pulse-border-glow {
                    0% { box-shadow: 0 0 15px rgba(245, 158, 11, 0.2), 0 0 5px rgba(245, 158, 11, 0.1); }
                    50% { box-shadow: 0 0 30px rgba(245, 158, 11, 0.6), 0 0 15px rgba(245, 158, 11, 0.3); }
                    100% { box-shadow: 0 0 15px rgba(245, 158, 11, 0.2), 0 0 5px rgba(245, 158, 11, 0.1); }
                }
                .warning-modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(4, 4, 8, 0.85); backdrop-filter: blur(15px);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 99999; opacity: 0; transition: opacity 0.3s ease;
                }
                .warning-modal-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(245, 158, 11, 0.4);
                    border-radius: 20px;
                    padding: 2.5rem; max-width: 480px; width: 90%;
                    text-align: center; color: #ffffff;
                    animation: pulse-border-glow 2.5s infinite ease-in-out;
                    font-family: 'Outfit', sans-serif;
                }
                .warning-modal-icon {
                    font-size: 3.5rem; margin-bottom: 1rem; display: inline-block;
                }
                .warning-modal-title {
                    font-size: 1.8rem; font-weight: 700; color: #f59e0b; margin-bottom: 0.8rem;
                }
                .warning-modal-desc {
                    color: #8892b0; font-size: 1rem; margin-bottom: 2rem; line-height: 1.5;
                }
                .warning-countdown-clock {
                    font-family: monospace; font-size: 3rem; font-weight: bold;
                    color: #ffd700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.4);
                    margin-bottom: 2rem;
                }
                .warning-btn-group {
                    display: flex; gap: 1rem; justify-content: center;
                }
                .warning-btn {
                    padding: 0.8rem 1.8rem; border-radius: 8px; font-weight: 700;
                    cursor: pointer; transition: all 0.3s ease; font-size: 0.95rem;
                }
                .warning-btn-extend {
                    background: linear-gradient(90deg, #ff8c00, #ffd700);
                    color: #000; border: none;
                }
                .warning-btn-extend:hover {
                    box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
                    transform: translateY(-2px);
                }
                .warning-btn-logout {
                    background: transparent; border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #8892b0;
                }
                .warning-btn-logout:hover {
                    background: rgba(255, 74, 74, 0.1);
                    color: #ff4a4a; border-color: rgba(255, 74, 74, 0.3);
                }
            `;
            document.head.appendChild(styles);
        }

        // Create overlay and modal if not already present
        let overlay = document.getElementById('inactivity-warning-modal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'warning-modal-overlay';
            overlay.id = 'inactivity-warning-modal';
            overlay.innerHTML = `
                <div class="warning-modal-card">
                    <span class="warning-modal-icon">⚠️</span>
                    <h3 class="warning-modal-title">Session Inactivity Lock</h3>
                    <p class="warning-modal-desc">Your VIBE Enterprise workspace has been idle. To protect engineering schemas, session will auto-lock in:</p>
                    <div class="warning-countdown-clock" id="warning-countdown">${formatTimeRemaining(countdownValue)}</div>
                    <div class="warning-btn-group">
                        <button class="warning-btn warning-btn-extend" id="btn-extend-session">Extend Session</button>
                        <button class="warning-btn warning-btn-logout" id="btn-logout-session">Lock Portal</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Button Events
            document.getElementById('btn-extend-session').addEventListener('click', extendSession);
            document.getElementById('btn-logout-session').addEventListener('click', () => {
                logSessionActivity('session_logout', 'User clicked manual Lock Portal on warning prompt.');
                performSignOut();
            });
        } else {
            const clock = document.getElementById('warning-countdown');
            if (clock) clock.textContent = formatTimeRemaining(countdownValue);
        }

        // Animate entrance
        setTimeout(() => { overlay.style.opacity = '1'; }, 10);

        // Setup Countdown
        clearInterval(warningInterval);
        const warningStartTime = Date.now() - ((WARNING_COUNTDOWN_S - countdownValue) * 1000);
        warningInterval = setInterval(() => {
            const secondsElapsed = Math.floor((Date.now() - warningStartTime) / 1000);
            countdownValue = WARNING_COUNTDOWN_S - secondsElapsed;
            
            const clock = document.getElementById('warning-countdown');
            if (clock) clock.textContent = formatTimeRemaining(Math.max(0, countdownValue));

            if (countdownValue <= 0) {
                clearInterval(warningInterval);
                logoutDueToInactivity();
            }
        }, 1000);
    }

    async function extendSession() {
        clearInterval(warningInterval);
        isWarningActive = false;
        
        closeWarningModal();

        console.log("SessionManager: Session successfully extended.");
        
        // Reset activity state and write to localStorage to notify other tabs
        const now = Date.now();
        lastActivityTime = now;
        localStorage.setItem('vibe_last_activity', now.toString());

        // Log to database
        await logSessionActivity('session_extend', 'User clicked Extend Session, resetting inactivity countdown.');

        // Restart monitoring
        resetInactivityTimer();
    }

    async function logoutDueToInactivity() {
        console.warn("SessionManager: Inactivity lockout countdown complete. Logging out user.");
        
        // Log timeout to database
        await logSessionActivity('session_timeout', 'Automated lockout triggered due to session inactivity.');

        performSignOut('Session expired due to inactivity.');
    }

    function performSignOut(toastMessage) {
        // Clear session info
        sessionStorage.removeItem('vibe_user');
        localStorage.removeItem('vibe_user');
        localStorage.removeItem('automfg-auth');

        // Clear warning timers
        clearInterval(warningInterval);
        clearTimeout(inactivityTimer);

        if (window.supabaseClient) {
            window.supabaseClient.auth.signOut().finally(() => {
                redirectToLogin(toastMessage);
            });
        } else {
            redirectToLogin(toastMessage);
        }
    }

    function redirectToLogin(toastMessage) {
        if (toastMessage) {
            sessionStorage.setItem('logout_toast', toastMessage);
        }
        window.location.href = 'index.html';
    }

    // 5. BOOTSTRAPPING
    document.addEventListener('DOMContentLoaded', () => {
        const isSynced = syncSession();
        if (isSynced) {
            const userSession = sessionStorage.getItem('vibe_user');
            if (userSession) {
                // Set up inactivity timers
                setupActivityListeners();
                
                // If it is the initial load, log a successful terminal session start
                const isInitialSessionLog = !sessionStorage.getItem('vibe_session_logged');
                if (isInitialSessionLog) {
                    sessionStorage.setItem('vibe_session_logged', 'true');
                    logSessionActivity('session_start', 'New secure terminal session initiated.');
                }
            }
        }

        // Check if there is a pending logout toast message from a previous redirect
        const pendingToast = sessionStorage.getItem('logout_toast');
        if (pendingToast) {
            sessionStorage.removeItem('logout_toast');
            
            // Build custom premium alert toast
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed; bottom: 30px; right: 30px;
                background: rgba(15, 23, 42, 0.9);
                border: 1px solid rgba(239, 68, 68, 0.4);
                color: #ffffff; padding: 1rem 1.8rem; border-radius: 10px;
                font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 500;
                box-shadow: 0 10px 25px rgba(239, 68, 68, 0.2);
                z-index: 999999; animation: slideIn 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            `;
            toast.innerHTML = `<span style="color:#ef4444; margin-right:8px;">⚠️</span> ${pendingToast}`;
            document.body.appendChild(toast);

            // Add slide-in animation to style block
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateY(50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);

            // Fade out after 5 seconds
            setTimeout(() => {
                toast.style.transition = 'all 0.5s ease';
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(20px)';
                setTimeout(() => { toast.remove(); }, 500);
            }, 5000);
        }
    });

    // Make functions globally accessible for login script integrations
    window.SessionManager = {
        logSessionActivity: logSessionActivity,
        syncSession: syncSession,
        performSignOut: performSignOut,
        extendSession: extendSession
    };
})();
