// Navbar scroll effect
const navbar = document.querySelector('.navbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Optional: stop observing once animated
            // observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right').forEach(el => {
    observer.observe(el);
});

// Carousel Logic
const track = document.querySelector('.carousel-track');
if (track) {
    const slides = Array.from(track.children);
    const nextBtn = document.querySelector('.carousel-btn.next');
    const prevBtn = document.querySelector('.carousel-btn.prev');
    const dotsContainer = document.querySelector('.carousel-dots');
    const dots = dotsContainer ? Array.from(dotsContainer.children) : [];
    
    let currentSlide = 0;
    
    function updateCarousel(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentSlide = (currentSlide + 1) % slides.length;
            updateCarousel(currentSlide);
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            updateCarousel(currentSlide);
        });
    }
    
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSlide = index;
            updateCarousel(currentSlide);
        });
    });
    
    // Auto advance carousel
    setInterval(() => {
        currentSlide = (currentSlide + 1) % slides.length;
        updateCarousel(currentSlide);
    }, 5000);
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - headerOffset;
  
            window.scrollTo({
                 top: offsetPosition,
                 behavior: "smooth"
            });
        }
    });
});

// Modal logic for Corporate Login
const modal = document.getElementById('loginModal');
const openBtns = [document.getElementById('openLoginBtn'), document.getElementById('navbarLoginBtn')];
const closeBtn = document.querySelector('#loginModal .close-modal') || document.querySelector('.close-modal');

// Avoid attaching close/overlay-dismiss listeners to the static login panel on direct-login page
const isDirectLogin = window.location.pathname.includes('direct-login.html');

if (modal && closeBtn && !isDirectLogin) {
    const showModal = (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
        // Allow a small delay to trigger the CSS transition/animation
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        document.body.style.overflow = 'hidden'; // Disable page scrolling
    };

    openBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', showModal);
        }
    });

    const hideModal = () => {
        modal.classList.remove('show');
        // Wait for transition/animation to finish before setting display to none
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        document.body.style.overflow = ''; // Restore page scrolling
    };

    closeBtn.addEventListener('click', hideModal);

    // Close when clicking overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });
}

// Forgot Password Modal Logic
const forgotModal = document.getElementById('forgotPasswordModal');
const forgotLink = document.querySelector('.forgot');
const closeForgotBtn = document.querySelector('.close-forgot-modal');
const forgotForm = document.getElementById('forgotForm');
const forgotSuccess = document.getElementById('forgotSuccess');

if (forgotLink && forgotModal && closeForgotBtn) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Hide login modal first if it is not the static direct-login page
        const loginModal = document.getElementById('loginModal');
        if (loginModal && !isDirectLogin) {
            loginModal.classList.remove('show');
            setTimeout(() => {
                loginModal.style.display = 'none';
            }, 300);
        }
        
        // Open forgot modal
        forgotModal.style.display = 'flex';
        setTimeout(() => {
            forgotModal.classList.add('show');
        }, 10);
        document.body.style.overflow = 'hidden';
    });

    const hideForgotModal = () => {
        forgotModal.classList.remove('show');
        setTimeout(() => {
            forgotModal.style.display = 'none';
            // Reset form when closing
            if (forgotForm) {
                forgotForm.reset();
                const inputs = forgotForm.querySelectorAll('input, button');
                inputs.forEach(input => input.disabled = false);
            }
            if (forgotSuccess) {
                forgotSuccess.style.display = 'none';
                forgotSuccess.textContent = '';
            }
        }, 300);
        document.body.style.overflow = '';
    };

    closeForgotBtn.addEventListener('click', hideForgotModal);

    forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
            hideForgotModal();
        }
    });

    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('forgotName').value.trim();
            const email = document.getElementById('forgotEmail').value.trim();
            
            if (forgotSuccess) {
                forgotSuccess.textContent = `Notification sent to HR! Reset request for ${name} (${email}) has been submitted for approval.`;
                forgotSuccess.style.display = 'block';
            }
            
            // Disable inputs/button inside form
            const inputs = forgotForm.querySelectorAll('input, button');
            inputs.forEach(input => input.disabled = true);
        });
    }
}

// Login Form Submission Handler
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

if (loginForm && loginError) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailInput = document.getElementById('email').value.trim().toLowerCase();
        const passwordInput = document.getElementById('password').value.trim();
        
        loginError.style.display = 'none';
        loginError.textContent = '';
        
        // 1. Validate password
        const localPart = emailInput.split('@')[0];
        if (passwordInput !== 'admin123') {
            loginError.textContent = 'Invalid credentials. Please use the designated staff password.';
            loginError.style.display = 'block';
            return;
        }
        
        // 2. Authenticate against Supabase
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;
        
        try {
            // Check if Supabase client is initialized
            if (!window.supabaseClient) {
                // Wait for the initialization promise if it exists
                if (window.supabaseInit) {
                    await window.supabaseInit;
                }
                if (!window.supabaseClient) {
                    throw new Error("Unable to establish connection to Supabase database.");
                }
            }
            
            // 2. Query users1 table (AutoSCM / Procurement staff) first directly via fetch
            // This avoids supabase-js injecting the service_role key as an Authorization Bearer token, which returns 403 Forbidden
            let profile = null;
            let department = null;
            let userId = null;

            const supabaseUrl = window.supabaseClient?.supabaseUrl || 'https://smkgmfgbuioclfbuuynl.supabase.co';
            const supabaseKey = window.supabaseClient?.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta2dtZmdidWlvY2xmYnV1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM4OTUsImV4cCI6MjA5NDM5OTg5NX0.FSjVcb6aR5nFaspS4M29YHDSB7QKxVyvYOkB_IN_lh4';

            // A. Check users1 table (SCM)
            try {
                const response = await fetch(`${supabaseUrl}/rest/v1/users1?email=eq.${encodeURIComponent(emailInput)}&select=*`, {
                    headers: {
                        'apikey': supabaseKey
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        const scmProfile = data[0];
                        scmProfile.id = scmProfile.id || 'temp-id';
                        profile = scmProfile;
                        department = 'SCM';
                        userId = scmProfile.id;
                        console.log("Logged in SCM staff from users1 table:", emailInput);
                    }
                }
            } catch (scmQueryErr) {
                console.warn("Direct query of users1 failed:", scmQueryErr);
            }

            // B. Check users table (R&D / AutoDev)
            if (!profile) {
                try {
                    const response = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(emailInput)}&select=*`, {
                        headers: {
                            'apikey': supabaseKey
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.length > 0) {
                            const devProfile = data[0];
                            profile = devProfile;
                            department = 'R&D';
                            userId = devProfile.id;
                            console.log("Retrieved R&D profile from users table:", emailInput);
                        }
                    }
                } catch (devQueryErr) {
                    console.warn("Direct query of users table failed:", devQueryErr);
                }
            }

            // C. Check erp_users table (SCM / MFG / EXECUTIVE)
            if (!profile) {
                try {
                    const response = await fetch(`${supabaseUrl}/rest/v1/erp_users?email=eq.${encodeURIComponent(emailInput)}&select=*`, {
                        headers: {
                            'apikey': supabaseKey
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.length > 0) {
                            const erpProfile = data[0];
                            profile = erpProfile;
                            userId = erpProfile.id;
                            
                            // Classify department based on erp_user fields
                            if (erpProfile.department === 'EXECUTIVE' || erpProfile.role === 'CEO') {
                                department = 'EXECUTIVE';
                            } else if (erpProfile.role?.toLowerCase().includes('mfg') || 
                                       erpProfile.role?.toLowerCase().includes('assembly') || 
                                       erpProfile.role?.toLowerCase().includes('plant') || 
                                       erpProfile.role?.toLowerCase().includes('shift')) {
                                department = 'MFG';
                            } else {
                                department = 'SCM';
                            }
                            console.log("Retrieved ERP profile from erp_users table:", emailInput);
                        }
                    }
                } catch (erpQueryErr) {
                    console.warn("Direct query of erp_users table failed:", erpQueryErr);
                }
            }
            
            // D. Validate against Mock Whitelist Registry
            if (!profile) {
                const MOCK_STAFF = [
                    { email: 's.chen@vibe.com', department: 'R&D', full_name: 'Sarah Chen', role: 'Lead Thermal Engineer' },
                    { email: 'd.reyes@vibe.com', department: 'R&D', full_name: 'David Reyes', role: 'Junior CAD Designer' },
                    { email: 'm.johnson@automfg.io', department: 'MFG', full_name: 'Marcus Johnson', role: 'Plant Manager', plant: 'Plant A' },
                    { email: 'a.wong@automfg.io', department: 'MFG', full_name: 'Alicia Wong', role: 'Shift Supervisor', plant: 'Plant A' },
                    { email: 'l.kinsley@vibe.com', department: 'SCM', full_name: 'Liam Kinsley', role: 'Logistics Head' },
                    { email: 'ceo@vibe.com', department: 'EXECUTIVE', full_name: 'VIBE CEO', role: 'CEO' },
                    // Common whitelisted MFG accounts
                    { email: 'prod.manager@automfg.io', department: 'MFG', full_name: 'Production Manager', role: 'Production Manager', plant: 'Plant A' },
                    { email: 'shift.super@automfg.io', department: 'MFG', full_name: 'Shift Supervisor', role: 'Shift Supervisor', plant: 'Plant A' },
                    { email: 'line.leader@automfg.io', department: 'MFG', full_name: 'Line Leader', role: 'Line Leader', plant: 'Plant A' },
                    { email: 'mach.operator@automfg.io', department: 'MFG', full_name: 'Machine Operator', role: 'Machine Operator', plant: 'Plant A' },
                    { email: 'prod.planner@automfg.io', department: 'MFG', full_name: 'Production Planner', role: 'Production Planner', plant: 'Plant A' },
                    { email: 'maint.tech@automfg.io', department: 'MFG', full_name: 'Maintenance Tech', role: 'Maintenance Tech', plant: 'Plant A' },
                    { email: 'qual.inspector@automfg.io', department: 'MFG', full_name: 'Quality Inspector', role: 'Quality Inspector', plant: 'Plant A' },
                    { email: 'plant.manager@automfg.io', department: 'MFG', full_name: 'Plant Manager', role: 'Plant Manager', plant: 'Plant A' },
                    { email: 'sys.admin@automfg.io', department: 'MFG', full_name: 'System Admin', role: 'System Admin', plant: 'Plant A' }
                ];

                const matchedMock = MOCK_STAFF.find(emp => emp.email.toLowerCase() === emailInput);
                if (matchedMock) {
                    profile = {
                        full_name: matchedMock.full_name,
                        role: matchedMock.role,
                        plant: matchedMock.plant || 'Plant A'
                    };
                    department = matchedMock.department;
                    userId = 'mock-' + localPart;
                    console.log("Logged in using fallback mock registry:", emailInput);
                } else {
                    throw new Error("Access Denied. Email address is not registered in the VIBE staff directory.");
                }
            }

            // Post-Auth Zustand synchronizer for MFG users
            if (department === 'MFG') {
                const EMAIL_ROLE_MAP = {
                    'prod.manager': 'production_manager',
                    'shift.super': 'shift_supervisor',
                    'line.leader': 'line_leader',
                    'mach.operator': 'machine_operator',
                    'prod.planner': 'production_planner',
                    'maint.tech': 'maintenance_tech',
                    'qual.inspector': 'quality_inspector',
                    'plant.manager': 'plant_manager',
                    'sys.admin': 'sys_admin'
                };
                const roleKey = EMAIL_ROLE_MAP[localPart] || 'machine_operator';

                localStorage.setItem('automfg-auth', JSON.stringify({
                    state: {
                        user: {
                            id: userId || 'mfg-temp',
                            name: profile.name || profile.full_name || localPart.toUpperCase(),
                            username: localPart,
                            role: roleKey,
                            roleLabel: profile.role || 'Machine Operator',
                            plant: profile.plant || 'Plant A',
                            email: emailInput
                        },
                        isAuthenticated: true,
                        sessionId: null
                    },
                    version: 2
                }));
            }
                
            if (emailInput === 'ceo@vibe.com') {
                department = 'EXECUTIVE';
                if (profile) {
                    profile.role = 'CEO';
                }
                // Initialize AutoMFG session for CEO
                localStorage.setItem('automfg-auth', JSON.stringify({
                    state: {
                        user: {
                            id: userId || 'ceo-temp',
                            name: 'VIBE CEO',
                            username: 'ceo',
                            role: 'ceo',
                            roleLabel: 'Chief Executive Officer',
                            plant: 'All Plants',
                            email: 'ceo@vibe.com'
                        },
                        isAuthenticated: true,
                        sessionId: null
                    },
                    version: 2
                }));
            }

            // Save session
            const sessionData = {
                email: emailInput,
                id: userId || 'temp-id',
                profile: {
                    ...profile,
                    full_name: profile.name || profile.full_name || localPart.toUpperCase(),
                    role: emailInput === 'ceo@vibe.com' ? 'CEO' : (profile?.role || 'Staff')
                },
                department: department
            };
            sessionStorage.setItem('vibe_user', JSON.stringify(sessionData));
            localStorage.setItem('vibe_user', JSON.stringify(sessionData));
            
            // Redirect to unified portal
            window.location.href = 'portal.html';
            
        } catch (err) {
            console.error("Login failed:", err);
            loginError.textContent = err.message || 'Login failed. Please verify your credentials and try again.';
            loginError.style.display = 'block';
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}

// Charging Modal Logic
const chargingModal = document.getElementById('chargingModal');
const openChargingBtn = document.getElementById('openChargingBtn');
const closeChargingBtn = document.querySelector('.close-charging-modal');

if (openChargingBtn && chargingModal && closeChargingBtn) {
    openChargingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        chargingModal.style.display = 'flex';
        setTimeout(() => {
            chargingModal.classList.add('show');
        }, 10);
        document.body.style.overflow = 'hidden';
    });

    const hideChargingModal = () => {
        chargingModal.classList.remove('show');
        setTimeout(() => {
            chargingModal.style.display = 'none';
        }, 300);
        document.body.style.overflow = '';
    };

    closeChargingBtn.addEventListener('click', hideChargingModal);

    chargingModal.addEventListener('click', (e) => {
        if (e.target === chargingModal) {
            hideChargingModal();
        }
    });
}

// Lightbox Map Logic
const mapLightboxModal = document.getElementById('mapLightboxModal');
const closeLightboxBtn = document.querySelector('.close-lightbox');
const mapPreview = document.querySelector('.map-preview-container');

if (mapPreview && mapLightboxModal && closeLightboxBtn) {
    mapPreview.addEventListener('click', () => {
        mapLightboxModal.style.display = 'flex';
        setTimeout(() => {
            mapLightboxModal.classList.add('show');
        }, 10);
    });

    const hideLightbox = () => {
        mapLightboxModal.classList.remove('show');
        setTimeout(() => {
            mapLightboxModal.style.display = 'none';
        }, 300);
    };

    closeLightboxBtn.addEventListener('click', hideLightbox);
    mapLightboxModal.addEventListener('click', hideLightbox);
}
// Reservation Modal Logic
const reserveModal = document.getElementById('reserveModal');
const openReserveBtn = document.getElementById('openReserveBtn');
const closeReserveBtn = document.querySelector('.close-reserve-modal');
const reserveForm = document.getElementById('reserveForm');
const reserveSuccessMsg = document.getElementById('reserveSuccessMsg');

if (openReserveBtn && reserveModal && closeReserveBtn) {
    // Open modal
    openReserveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        reserveModal.style.display = 'flex';
        setTimeout(() => {
            reserveModal.classList.add('show');
        }, 10);
        document.body.style.overflow = 'hidden';
    });

    const hideReserveModal = () => {
        reserveModal.classList.remove('show');
        setTimeout(() => {
            reserveModal.style.display = 'none';
        }, 300);
        document.body.style.overflow = '';
    };

    closeReserveBtn.addEventListener('click', hideReserveModal);
    reserveModal.addEventListener('click', (e) => {
        if (e.target === reserveModal) {
            hideReserveModal();
        }
    });

    if (reserveForm) {
        reserveForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Show success message
            if (reserveSuccessMsg) {
                reserveSuccessMsg.style.display = 'block';
                // Hide after a short delay
                setTimeout(() => {
                    reserveSuccessMsg.style.display = 'none';
                }, 3000);
            }
            hideReserveModal();
        });
    }
}
