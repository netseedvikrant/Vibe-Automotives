document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. Test Drive Modal Injection & Handling
    // -------------------------------------------------------------
    const testDriveModalHTML = `
        <div id="testDriveModal" class="modal">
            <div class="modal-content" style="background: rgba(10, 10, 15, 0.92); border: 1px solid var(--glass-border); backdrop-filter: blur(20px);">
                <span class="close-modal" id="closeTestDrive">&times;</span>
                <div class="modal-logo" style="margin-bottom: 0.5rem;">
                    <svg width="35" height="35" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M50 0L100 25V75L50 100L0 75V25L50 0Z" fill="url(#paint0_linear_modal)"/>
                        <path d="M50 20L80 35V65L50 80L20 65V35L50 20Z" fill="#050505"/>
                        <path d="M50 40L60 45V55L50 60L40 55V45L50 40Z" fill="url(#paint1_linear_modal)"/>
                        <defs>
                            <linearGradient id="paint0_linear_modal" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                                <stop stop-color="#00F0FF"/>
                                <stop offset="1" stop-color="#0055FF"/>
                            </linearGradient>
                            <linearGradient id="paint1_linear_modal" x1="40" y1="40" x2="60" y2="60" gradientUnits="userSpaceOnUse">
                                <stop stop-color="#00F0FF"/>
                                <stop offset="1" stop-color="#0055FF"/>
                            </linearGradient>
                        </defs>
                    </svg>
                    <span style="font-weight: 800; font-size: 1.2rem; letter-spacing: 2px;">VIBE PILOT</span>
                </div>
                <p class="modal-subtitle" style="text-align: center; color: var(--primary); font-size: 0.9rem; margin-bottom: 2rem;">Book Your Executive Test Drive Session</p>
                
                <div id="testDriveFormContainer">
                    <form id="testDriveForm">
                        <div class="input-group">
                            <label for="tdName">Full Name</label>
                            <input type="text" id="tdName" required placeholder="John Doe">
                        </div>
                        <div class="input-group">
                            <label for="tdPhone">Phone Number</label>
                            <input type="tel" id="tdPhone" required placeholder="+1 (555) 123-4567">
                        </div>
                        <div class="input-group">
                            <label for="tdEmail">Email Address</label>
                            <input type="email" id="tdEmail" required placeholder="john@example.com">
                        </div>
                        <div class="input-group">
                            <label for="tdVehicle">Vehicle of Interest</label>
                            <select id="tdVehicle" required style="width: 100%; padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.7); border: 1px solid var(--glass-border); color: white; font-family: inherit; font-size: 1rem; transition: var(--transition);">
                                <option value="" disabled selected>Select a model</option>
                                <option value="echelon">VIBE Echelon (Intelligent Sedan)</option>
                                <option value="horizon">VIBE Horizon (Premium SUV)</option>
                                <option value="apex">VIBE Apex (Performance Hypercar)</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="tdDate">Preferred Date</label>
                            <input type="date" id="tdDate" required style="width: 100%; padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.7); border: 1px solid var(--glass-border); color: white; font-family: inherit; font-size: 1rem;">
                        </div>
                        <div class="input-group checkbox-group" style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 1.5rem; margin-top: 1rem;">
                            <input type="checkbox" id="tdConsent" required style="width: auto; margin-top: 0.25rem; cursor: pointer;">
                            <label for="tdConsent" style="color: var(--text-muted); font-size: 0.85rem; cursor: pointer; text-align: left;">I agree to the <a href="privacy.html" target="_blank" style="color: var(--primary); text-decoration: none;">Privacy Policy</a> and <a href="terms.html" target="_blank" style="color: var(--primary); text-decoration: none;">Terms of Service</a>.</label>
                        </div>
                        <button type="submit" class="btn-glow full-width" style="margin-top: 1rem; width: 100%;">Confirm Booking</button>
                    </form>
                </div>
                
                <div id="testDriveSuccess" style="display: none; text-align: center; padding: 1.5rem 0;">
                    <div style="font-size: 4rem; margin-bottom: 1.2rem;">⚡</div>
                    <h3 style="font-size: 1.8rem; margin-bottom: 0.8rem; color: #fff;">Booking Scheduled!</h3>
                    <p style="color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; margin-bottom: 2rem;">Your test drive reservation is queued. Our concierge team will connect with you soon.</p>
                    <button id="btnTDCloseSuccess" class="btn-secondary" style="padding: 0.8rem 2rem; width: 100%;">Close Window</button>
                </div>
            </div>
        </div>
    `;

    // Inject Test Drive Modal
    const tdWrapper = document.createElement('div');
    tdWrapper.innerHTML = testDriveModalHTML;
    document.body.appendChild(tdWrapper.firstElementChild);

    const tdModal = document.getElementById('testDriveModal');
    const openTDBtns = document.querySelectorAll('.open-test-drive-btn');
    const closeTDBtn = document.getElementById('closeTestDrive');
    const tdForm = document.getElementById('testDriveForm');
    const tdFormContainer = document.getElementById('testDriveFormContainer');
    const tdSuccessContainer = document.getElementById('testDriveSuccess');
    const closeTDSuccessBtn = document.getElementById('btnTDCloseSuccess');

    const showTDModal = (e) => {
        e.preventDefault();
        tdModal.style.display = 'flex';
        tdModal.offsetHeight; 
        tdModal.classList.add('show');
        tdFormContainer.style.display = 'block';
        tdSuccessContainer.style.display = 'none';
        if (tdForm) tdForm.reset();
        document.body.style.overflow = 'hidden';
    };

    const hideTDModal = () => {
        tdModal.classList.remove('show');
        setTimeout(() => {
            tdModal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    };

    openTDBtns.forEach(btn => btn.addEventListener('click', showTDModal));
    if (closeTDBtn) closeTDBtn.addEventListener('click', hideTDModal);
    if (closeTDSuccessBtn) closeTDSuccessBtn.addEventListener('click', hideTDModal);

    // -------------------------------------------------------------
    // 2. Support Modal Injection & Handling
    // -------------------------------------------------------------
    const supportModalHTML = `
        <div id="supportModal" class="modal">
            <div class="modal-content" style="background: rgba(10, 10, 15, 0.92); border: 1px solid var(--glass-border); backdrop-filter: blur(20px);">
                <span class="close-modal" id="closeSupport">&times;</span>
                <div class="modal-logo" style="margin-bottom: 0.5rem;">
                    <svg width="35" height="35" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M50 0L100 25V75L50 100L0 75V25L50 0Z" fill="url(#paint0_linear_support)"/>
                        <path d="M50 20L80 35V65L50 80L20 65V35L50 20Z" fill="#050505"/>
                        <path d="M50 40L60 45V55L50 60L40 55V45L50 40Z" fill="url(#paint1_linear_support)"/>
                        <defs>
                            <linearGradient id="paint0_linear_support" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                                <stop stop-color="#00F0FF"/>
                                <stop offset="1" stop-color="#0055FF"/>
                            </linearGradient>
                            <linearGradient id="paint1_linear_support" x1="40" y1="40" x2="60" y2="60" gradientUnits="userSpaceOnUse">
                                <stop stop-color="#00F0FF"/>
                                <stop offset="1" stop-color="#0055FF"/>
                            </linearGradient>
                        </defs>
                    </svg>
                    <span style="font-weight: 800; font-size: 1.2rem; letter-spacing: 2px;">VIBE CARE</span>
                </div>
                <p class="modal-subtitle" style="text-align: center; color: var(--primary); font-size: 0.9rem; margin-bottom: 2rem;">Submit Help Desk Query</p>
                
                <div id="supportFormContainer">
                    <form id="supportForm">
                        <div class="input-group">
                            <label for="spEmail">Email Address</label>
                            <input type="email" id="spEmail" required placeholder="customer@example.com">
                        </div>
                        <div class="input-group">
                            <label for="spQuery">Your Message / Query</label>
                            <textarea id="spQuery" required placeholder="How can we assist you today?" style="width: 100%; height: 120px; padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.7); border: 1px solid var(--glass-border); color: white; font-family: inherit; font-size: 1rem; resize: none; outline: none; transition: var(--transition);"></textarea>
                        </div>
                        <div class="input-group checkbox-group" style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 1.5rem; margin-top: 1rem;">
                            <input type="checkbox" id="spConsent" required style="width: auto; margin-top: 0.25rem; cursor: pointer;">
                            <label for="spConsent" style="color: var(--text-muted); font-size: 0.85rem; cursor: pointer; text-align: left;">I agree to the <a href="privacy.html" target="_blank" style="color: var(--primary); text-decoration: none;">Privacy Policy</a> and <a href="terms.html" target="_blank" style="color: var(--primary); text-decoration: none;">Terms of Service</a>.</label>
                        </div>
                        <button type="submit" class="btn-glow full-width" style="margin-top: 1rem; width: 100%;">Send Query</button>
                    </form>
                </div>
                
                <div id="supportSuccess" style="display: none; text-align: center; padding: 1.5rem 0;">
                    <div style="font-size: 4rem; margin-bottom: 1.2rem;">✉️</div>
                    <h3 style="font-size: 1.8rem; margin-bottom: 0.8rem; color: #fff;">Message Sent!</h3>
                    <p style="color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; margin-bottom: 2rem;">Thank you for reaching out. Our support team will connect with you soon.</p>
                    <button id="btnSPCloseSuccess" class="btn-secondary" style="padding: 0.8rem 2rem; width: 100%;">Close Window</button>
                </div>
            </div>
        </div>
    `;

    // Inject Support Modal
    const spWrapper = document.createElement('div');
    spWrapper.innerHTML = supportModalHTML;
    document.body.appendChild(spWrapper.firstElementChild);

    const spModal = document.getElementById('supportModal');
    const openSPBtns = document.querySelectorAll('.open-support-btn');
    const closeSPBtn = document.getElementById('closeSupport');
    const spForm = document.getElementById('supportForm');
    const spFormContainer = document.getElementById('supportFormContainer');
    const spSuccessContainer = document.getElementById('supportSuccess');
    const closeSPSuccessBtn = document.getElementById('btnSPCloseSuccess');

    const showSPModal = (e) => {
        e.preventDefault();
        spModal.style.display = 'flex';
        spModal.offsetHeight; 
        spModal.classList.add('show');
        spFormContainer.style.display = 'block';
        spSuccessContainer.style.display = 'none';
        if (spForm) spForm.reset();
        document.body.style.overflow = 'hidden';
    };

    const hideSPModal = () => {
        spModal.classList.remove('show');
        setTimeout(() => {
            spModal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    };

    openSPBtns.forEach(btn => btn.addEventListener('click', showSPModal));
    if (closeSPBtn) closeSPBtn.addEventListener('click', hideSPModal);
    if (closeSPSuccessBtn) closeSPSuccessBtn.addEventListener('click', hideSPModal);

    // -------------------------------------------------------------
    // 3. Global Window Click and Form Submit Interceptors
    // -------------------------------------------------------------
    window.addEventListener('click', e => {
        if (e.target === tdModal) hideTDModal();
        if (e.target === spModal) hideSPModal();
    });

    if (tdForm) {
        tdForm.addEventListener('submit', (e) => {
            e.preventDefault();
            tdFormContainer.style.display = 'none';
            tdSuccessContainer.style.display = 'block';
        });
    }

    if (spForm) {
        spForm.addEventListener('submit', (e) => {
            e.preventDefault();
            spFormContainer.style.display = 'none';
            spSuccessContainer.style.display = 'block';
        });
    }
});
