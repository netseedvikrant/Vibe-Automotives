// Navbar scroll effect
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

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
const slides = Array.from(track.children);
const nextBtn = document.querySelector('.carousel-btn.next');
const prevBtn = document.querySelector('.carousel-btn.prev');
const dotsContainer = document.querySelector('.carousel-dots');
const dots = Array.from(dotsContainer.children);

let currentSlide = 0;

function updateCarousel(index) {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    slides[index].classList.add('active');
    dots[index].classList.add('active');
}

nextBtn.addEventListener('click', () => {
    currentSlide = (currentSlide + 1) % slides.length;
    updateCarousel(currentSlide);
});

prevBtn.addEventListener('click', () => {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    updateCarousel(currentSlide);
});

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
const closeBtn = document.querySelector('.close-modal');

if (modal && closeBtn) {
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
        
        // Hide login modal first
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
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
            
            const isMFG = emailInput.endsWith('@automfg.io') || emailInput.includes('automfg.io');

            if (isMFG) {
                department = 'MFG';
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
                const EMAIL_DISPLAY_MAP = {
                    'prod.manager': { name: 'Production Manager', roleLabel: 'Production Manager', plant: 'Plant A', seedPass: 'Prod1234' },
                    'shift.super': { name: 'Shift Supervisor', roleLabel: 'Shift Supervisor', plant: 'Plant A', seedPass: 'Shift123' },
                    'line.leader': { name: 'Line Leader', roleLabel: 'Line Leader', plant: 'Plant A', seedPass: 'Line1234' },
                    'mach.operator': { name: 'Machine Operator', roleLabel: 'Machine Operator', plant: 'Plant A', seedPass: 'Mach1234' },
                    'prod.planner': { name: 'Production Planner', roleLabel: 'Production Planner', plant: 'Plant A', seedPass: 'Plan1234' },
                    'maint.tech': { name: 'Maintenance Tech', roleLabel: 'Maintenance Tech', plant: 'Plant A', seedPass: 'Main1234' },
                    'qual.inspector': { name: 'Quality Inspector', roleLabel: 'Quality Inspector', plant: 'Plant A', seedPass: 'Qual1234' },
                    'plant.manager': { name: 'Plant Manager', roleLabel: 'Plant Manager', plant: 'Plant A', seedPass: 'Plant123' },
                    'sys.admin': { name: 'System Admin', roleLabel: 'System Admin', plant: 'Plant A', seedPass: 'Admin123' }
                };

                const prefix = localPart;
                const role = EMAIL_ROLE_MAP[prefix] || 'machine_operator';
                const display = EMAIL_DISPLAY_MAP[prefix] || { name: prefix.toUpperCase(), roleLabel: role, plant: 'Plant A', seedPass: 'admin123' };
                
                profile = {
                    name: display.name,
                    role: display.roleLabel,
                    full_name: display.name,
                    plant: display.plant
                };
                
                // Try to authenticate with Supabase Auth behind the scenes for permissions
                try {
                    let authRes = await window.supabaseClient.auth.signInWithPassword({
                        email: emailInput,
                        password: 'admin123'
                    });
                    
                    if (authRes.error && display.seedPass !== 'admin123') {
                        authRes = await window.supabaseClient.auth.signInWithPassword({
                            email: emailInput,
                            password: display.seedPass
                        });
                    }
                    
                    if (!authRes.error && authRes.data?.user) {
                        userId = authRes.data.user.id;
                        console.log("Logged in MFG staff to Supabase Auth:", emailInput);
                    }
                } catch (authErr) {
                    console.warn("MFG Supabase Auth failed, using mock auth session:", authErr);
                }
                
                userId = userId || ('mfg-' + prefix);
                
                // Set Zustand localStorage state for AutoMFG React App
                localStorage.setItem('automfg-auth', JSON.stringify({
                    state: {
                        user: {
                            id: userId,
                            name: display.name,
                            username: prefix,
                            role: role,
                            roleLabel: display.roleLabel,
                            plant: display.plant,
                            email: emailInput
                        },
                        isAuthenticated: true,
                        sessionId: null
                    },
                    version: 2
                }));
            }

            if (!profile) {
                try {
                    const supabaseUrl = window.supabaseClient?.supabaseUrl || 'https://smkgmfgbuioclfbuuynl.supabase.co';
                    const supabaseKey = window.supabaseClient?.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta2dtZmdidWlvY2xmYnV1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM4OTUsImV4cCI6MjA5NDM5OTg5NX0.FSjVcb6aR5nFaspS4M29YHDSB7QKxVyvYOkB_IN_lh4';
                    
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
                    console.warn("Direct query of users1 failed, falling back to Auth:", scmQueryErr);
                }
            }
            
            // If not SCM or MFG, perform standard Supabase Auth signInWithPassword (for AutoDev / R&D staff)
            if (!profile) {
                try {
                    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                        email: emailInput,
                        password: passwordInput
                    });
                    
                    if (!error && data.user) {
                        userId = data.user.id;
                        console.log("Logged in R&D staff to Supabase Auth:", emailInput);
                    } else {
                        console.warn("Supabase Auth signin failed for R&D:", error?.message);
                    }
                } catch (authErr) {
                    console.warn("Supabase Auth signin failed for R&D:", authErr);
                }

                // Query the users table for profile information
                try {
                    const supabaseUrl = window.supabaseClient?.supabaseUrl || 'https://smkgmfgbuioclfbuuynl.supabase.co';
                    const supabaseKey = window.supabaseClient?.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta2dtZmdidWlvY2xmYnV1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM4OTUsImV4cCI6MjA5NDM5OTg5NX0.FSjVcb6aR5nFaspS4M29YHDSB7QKxVyvYOkB_IN_lh4';
                    
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
                            userId = userId || devProfile.id;
                            console.log("Retrieved R&D profile from users table:", emailInput);
                        }
                    }
                } catch (devQueryErr) {
                    console.warn("Direct query of users table failed:", devQueryErr);
                }

                // Fallback to user_profiles if profile still not found but userId is set
                if (!profile && userId) {
                    try {
                        const { data: devProfile } = await window.supabaseClient
                            .from('user_profiles')
                            .select('*')
                            .eq('id', userId)
                            .maybeSingle();
                            
                        if (devProfile) {
                            profile = devProfile;
                            department = 'R&D';
                        }
                    } catch (queryErr) {
                        console.warn("Profile query from user_profiles failed:", queryErr);
                    }
                }
            }
            
            // Fallback heuristics if profile is not found in either table
            if (!profile) {
                const emailLower = emailInput.toLowerCase();
                if (emailLower.includes('procurement') || emailLower.includes('supplier')) {
                    department = 'SCM';
                    profile = { full_name: localPart.toUpperCase(), role: 'SCM Specialist' };
                } else if (emailLower.includes('automfg') || emailLower.includes('mfg') || emailLower.endsWith('@automfg.io')) {
                    department = 'MFG';
                    profile = { full_name: localPart.toUpperCase(), role: 'MFG Specialist' };
                } else {
                    department = 'R&D';
                    profile = { full_name: localPart.toUpperCase(), role: 'R&D Engineer' };
                }
            }

            if (department === 'MFG') {
                localStorage.setItem('automfg-auth', JSON.stringify({
                    state: {
                        user: {
                            id: userId || 'mfg-temp',
                            name: profile.name || profile.full_name || localPart.toUpperCase(),
                            username: localPart,
                            role: 'machine_operator',
                            roleLabel: 'Machine Operator',
                            plant: 'Plant A',
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
            sessionStorage.setItem('vibe_user', JSON.stringify({
                email: emailInput,
                id: userId || 'temp-id',
                profile: {
                    ...profile,
                    full_name: profile.name || profile.full_name || localPart.toUpperCase(),
                    role: emailInput === 'ceo@vibe.com' ? 'CEO' : (profile?.role || 'Staff')
                },
                department: department
            }));
            
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
