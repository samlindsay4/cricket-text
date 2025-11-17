// PWA Install Prompt
(function() {
    'use strict';
    
    let deferredPrompt = null;
    const DISMISSED_KEY = 'pwa-install-dismissed';
    const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    // Check if app is already installed or in standalone mode
    function isAppInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone === true;
    }
    
    // Check if prompt was recently dismissed
    function wasRecentlyDismissed() {
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (!dismissed) return false;
        
        const dismissedTime = parseInt(dismissed, 10);
        const now = Date.now();
        return (now - dismissedTime) < DISMISS_DURATION;
    }
    
    // Detect if user is on iOS
    function isIOS() {
        return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    
    // Detect if user is on mobile
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // Create install prompt UI
    function createPromptUI() {
        const isIOSDevice = isIOS();
        
        const promptDiv = document.createElement('div');
        promptDiv.id = 'pwa-install-prompt';
        promptDiv.className = 'pwa-install-prompt';
        
        if (isIOSDevice) {
            // iOS Safari instructions
            promptDiv.innerHTML = `
                <div class="pwa-install-content">
                    <div class="pwa-install-header">
                        <span class="pwa-install-title">Install TELETEST</span>
                        <button class="pwa-install-close" id="pwa-dismiss" aria-label="Dismiss">×</button>
                    </div>
                    <div class="pwa-install-body">
                        <p>Install this app on your iPhone: tap <span class="ios-share-icon">⎙</span> and then "Add to Home Screen"</p>
                    </div>
                </div>
            `;
        } else {
            // Android/Chrome instructions
            promptDiv.innerHTML = `
                <div class="pwa-install-content">
                    <div class="pwa-install-header">
                        <span class="pwa-install-title">Install TELETEST</span>
                        <button class="pwa-install-close" id="pwa-dismiss" aria-label="Dismiss">×</button>
                    </div>
                    <div class="pwa-install-body">
                        <p>Install this app for quick access and offline support</p>
                        <button class="pwa-install-button" id="pwa-install">Install App</button>
                    </div>
                </div>
            `;
        }
        
        document.body.appendChild(promptDiv);
        
        // Add event listeners
        const dismissBtn = document.getElementById('pwa-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', dismissPrompt);
        }
        
        const installBtn = document.getElementById('pwa-install');
        if (installBtn && deferredPrompt) {
            installBtn.addEventListener('click', installApp);
        }
        
        // Show prompt with animation
        setTimeout(() => {
            promptDiv.classList.add('show');
        }, 500);
    }
    
    // Dismiss the prompt
    function dismissPrompt() {
        const prompt = document.getElementById('pwa-install-prompt');
        if (prompt) {
            prompt.classList.remove('show');
            setTimeout(() => {
                prompt.remove();
            }, 300);
        }
        
        // Remember dismissal
        localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    }
    
    // Install the app (non-iOS)
    async function installApp() {
        if (!deferredPrompt) return;
        
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        console.log(`User response to the install prompt: ${outcome}`);
        
        // Clear the deferred prompt
        deferredPrompt = null;
        
        // Dismiss the UI
        dismissPrompt();
    }
    
    // Show the install prompt if conditions are met
    function showInstallPrompt() {
        // Check all conditions
        if (isAppInstalled()) {
            console.log('App is already installed');
            return;
        }
        
        if (wasRecentlyDismissed()) {
            console.log('Install prompt was recently dismissed');
            return;
        }
        
        if (!isMobile()) {
            console.log('Not a mobile device');
            return;
        }
        
        // Show the prompt
        createPromptUI();
    }
    
    // Listen for the beforeinstallprompt event (Chrome, Edge, Samsung Internet)
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Show custom install prompt
        showInstallPrompt();
    });
    
    // Listen for the app being installed
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        deferredPrompt = null;
        dismissPrompt();
    });
    
    // For iOS, show prompt after a short delay since there's no beforeinstallprompt
    if (isIOS() && isMobile()) {
        window.addEventListener('load', () => {
            setTimeout(showInstallPrompt, 2000);
        });
    }
})();
