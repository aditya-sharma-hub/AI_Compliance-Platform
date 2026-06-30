/* ============================================================
   EY AI COMPLIANCE & GOVERNANCE PLATFORM - CORE CONTROLLER
   Application Logic — app.js (Sequential standard load)
   ============================================================ */

// Global helper selectors
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const withTimeout = (promise, ms = 2500) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Network Timeout")), ms);
    });
    return Promise.race([
        promise.then(res => { clearTimeout(timeoutId); return res; }),
        timeoutPromise
    ]);
};

// Global Variables
let deleteConfirmationProjectId = null;
let currentProjectDocs = []; // List of documents for active project upload/view

// Safe Storage Wrapper to handle sandboxed/restricted environments (e.g. cookie block / SecurityError)
const safeStorage = {
    _inMemoryStore: {},
    
    getItem(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            console.warn(`localStorage.getItem failed for key "${key}":`, e);
            return this._inMemoryStore[key] || null;
        }
    },
    
    setItem(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (e) {
            console.warn(`localStorage.setItem failed for key "${key}":`, e);
            this._inMemoryStore[key] = String(value);
        }
    },
    
    removeItem(key) {
        try {
            window.localStorage.removeItem(key);
        } catch (e) {
            console.warn(`localStorage.removeItem failed for key "${key}":`, e);
            delete this._inMemoryStore[key];
        }
    },
    
    clear() {
        try {
            window.localStorage.clear();
        } catch (e) {
            console.warn("localStorage.clear failed:", e);
            this._inMemoryStore = {};
        }
    }
};

function safeGetJSON(key, defaultValue) {
    try {
        const val = safeStorage.getItem(key);
        return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
        console.error(`Error parsing JSON for key "${key}":`, e);
        return defaultValue;
    }
}

function normalizeEmail(email) {
    if (!email) return "";
    return email.toLowerCase().trim();
}

function getLocalTimestamp() {
    const now = new Date();
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().replace('T', ' ').substring(0, 16);
}

async function triggerFileDownload(url, filename, blob = null) {
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({ suggestedName: filename });
            const writable = await handle.createWritable();
            if (blob) {
                await writable.write(blob);
            } else {
                const response = await fetch(url);
                await response.body.pipeTo(writable);
            }
            await writable.close();
            showToast("File saved successfully.", "success");
            return;
        } catch (err) {
            if (err.name !== 'AbortError') showToast("Save failed: " + err.message, "error");
            return;
        }
    }
    
    const a = document.createElement('a');
    if (blob) url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (blob) URL.revokeObjectURL(url);
    showToast("Download started successfully.", "success");
}

function getFrameworkName(key) {
    const map = { 
        'eu-ai-act': 'EU AI Act', 
        'nist-ai-rmf': 'NIST AI RMF', 
        'iso-42001': 'ISO 42001', 
        'dpdp': 'DPDP Act', 
        'meity': 'MeitY Guidelines' 
    };
    return map[key] || key;
}

function getFrameworkDbVal(key) {
    const map = {
        'eu-ai-act': 'EU AI Act',
        'nist-ai-rmf': 'NIST AI RMF',
        'iso-42001': 'ISO 42001',
        'dpdp': 'DPDP',
        'meity': 'MeitY Guidelines'
    };
    return map[key] || key;
}

function getStatusBadge(status) {
    const map = {
        'in-progress': '<span class="badge badge-progress">In Progress</span>',
        'Submitted — Awaiting Auditor Review': '<span class="badge badge-review">Under Review</span>',
        'Under Assessment': '<span class="badge badge-review">Assessing</span>',
        'Reviewed': '<span class="badge badge-completed">Reviewed</span>',
        'Completed': '<span class="badge badge-completed">Completed</span>',
    };
    return map[status] || `<span class="badge badge-draft">${status}</span>`;
}

function addActivity(text) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + now.toLocaleDateString();
    State.activities.unshift({ text, time: timeStr });
    if (State.activities.length > 20) State.activities.length = 20;
    State.saveState();
}

/* ──────────────────────────────────────────────
   1. STATE MANAGEMENT CLASS
   ────────────────────────────────────────────── */
class AppStateManager {
    constructor() {
        this.users = safeGetJSON("ey_users", DEFAULT_USERS);
        
        // Ensure seed users are always present in the users list
        DEFAULT_USERS.forEach(seedUser => {
            if (!this.users.some(u => u.email === seedUser.email)) {
                this.users.push(seedUser);
            }
        });

        this.projects = safeGetJSON("ey_projects", INITIAL_PROJECTS);
        this.currentUser = safeGetJSON("ey_current_user", null);
        this.activeProjectId = safeStorage.getItem("ey_active_project_id") || null;
        this.activeView = safeStorage.getItem("ey_active_view") || "dashboard";
        this.currentProjectStep = parseInt(safeStorage.getItem("ey_current_project_step") || "1");
        this.viewHistory = safeGetJSON("ey_view_history", []);
        this.privateDocuments = safeGetJSON("ey_private_documents", {});
        this.activities = safeGetJSON("ey_activities", []);
        
        // Draft storage
        this.regDraft = safeGetJSON("ey_draft_reg", null);
        this.onbAudDraft = safeGetJSON("ey_draft_onb_aud", null);
        this.onbAeeDraft = safeGetJSON("ey_draft_onb_aee", null);
        this.projectDraft = safeGetJSON("ey_draft_project", null);
    }

    saveState() {
        safeStorage.setItem("ey_users", JSON.stringify(this.users));
        safeStorage.setItem("ey_projects", JSON.stringify(this.projects));
        safeStorage.setItem("ey_current_user", JSON.stringify(this.currentUser));
        safeStorage.setItem("ey_active_view", this.activeView);
        safeStorage.setItem("ey_current_project_step", this.currentProjectStep ? String(this.currentProjectStep) : "1");
        safeStorage.setItem("ey_view_history", JSON.stringify(this.viewHistory));
        safeStorage.setItem("ey_private_documents", JSON.stringify(this.privateDocuments));
        safeStorage.setItem("ey_activities", JSON.stringify(this.activities));
        if (this.activeProjectId) {
            safeStorage.setItem("ey_active_project_id", this.activeProjectId);
        } else {
            safeStorage.removeItem("ey_active_project_id");
        }
        
        safeStorage.setItem("ey_draft_reg", JSON.stringify(this.regDraft));
        safeStorage.setItem("ey_draft_onb_aud", JSON.stringify(this.onbAudDraft));
        safeStorage.setItem("ey_draft_onb_aee", JSON.stringify(this.onbAeeDraft));
        safeStorage.setItem("ey_draft_project", JSON.stringify(this.projectDraft));
    }

    registerUser(fullname, org, designation, email, mobile, password, role) {
        const emailNorm = email.toLowerCase().trim();
        const existingIdx = this.users.findIndex(u => u.email === emailNorm);
        
        const newUser = {
            email: emailNorm,
            password,
            fullname,
            org,
            designation,
            role,
            mobile,
            onboarded: false,
            profile: null
        };
        
        if (existingIdx !== -1) {
            this.users[existingIdx] = newUser;
        } else {
            this.users.push(newUser);
        }
        
        this.saveState();
        return { success: true };
    }

    loginUser(email, password) {
        const emailNorm = email.toLowerCase().trim();
        const user = this.users.find(u => u.email === emailNorm);
        if (!user) {
            return { success: false, message: "Email not registered." };
        }
        if (user.password !== password) {
            return { success: false, message: "Incorrect password." };
        }
        
        // Ensure local seed users have a local fallback ID so syncWithSupabase skips them cleanly
        if (!user.id) {
            user.id = 'local-fallback-' + emailNorm;
        }
        
        this.currentUser = user;
        this.activeProjectId = null;
        this.viewHistory = [];
        
        if (!user.onboarded) {
            this.activeView = user.role === "auditor" ? "onboarding-auditor" : "onboarding-auditee";
        } else {
            this.activeView = "dashboard";
        }
        
        this.saveState();
        return { success: true };
    }

    logout() {
        this.currentUser = null;
        this.activeProjectId = null;
        this.currentProjectStep = 1;
        this.activeView = "auth-section";
        this.viewHistory = [];
        this.saveState();
    }

    getActiveProject() {
        return this.projects.find(p => p.id === this.activeProjectId) || null;
    }

    getPrivateDocumentsForUser(email = null) {
        let userEmail = email || this.currentUser?.email;
        if (!userEmail) return [];
        userEmail = userEmail.toLowerCase().trim();
        const docs = this.privateDocuments[userEmail];
        return Array.isArray(docs) ? docs : [];
    }

    setPrivateDocumentsForUser(docs, email = null) {
        let userEmail = email || this.currentUser?.email;
        if (!userEmail) return [];
        userEmail = userEmail.toLowerCase().trim();
        this.privateDocuments[userEmail] = Array.isArray(docs) ? docs : [];
        this.saveState();
        return this.getPrivateDocumentsForUser(userEmail);
    }

    addPrivateDocumentForCurrentUser(doc) {
        const docs = this.getPrivateDocumentsForUser();
        docs.push(doc);
        return this.setPrivateDocumentsForUser(docs);
    }

    removePrivateDocumentForCurrentUser(id) {
        let docs = this.getPrivateDocumentsForUser();
        docs = docs.filter(d => d.id !== id);
        return this.setPrivateDocumentsForUser(docs);
    }
}

// Instantiate global State
const State = new AppStateManager();
window.State = State;

/* ──────────────────────────────────────────────
   2. TOAST NOTIFICATIONS
   ────────────────────────────────────────────── */
function showToast(message, type = 'info') {
    const container = $('#toast-container');
    if (!container) return;
    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFE600" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span><span class="toast-close">&times;</span>`;
    container.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
    setTimeout(() => removeToast(toast), 4000);
}

function removeToast(toast) {
    if (toast.classList.contains('toast-exit')) return;
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
}

/* ──────────────────────────────────────────────
   3. MODAL SYSTEM
   ────────────────────────────────────────────── */
function showModal(title, bodyHTML, actions = []) {
    const overlay = $('#modal-overlay');
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHTML;
    const footer = $('#modal-footer');
    footer.innerHTML = '';
    
    actions.forEach(a => {
        const btn = document.createElement('button');
        btn.className = `btn ${a.class || 'btn-outline'}`;
        btn.textContent = a.label;
        btn.addEventListener('click', async () => { 
            if (a.action) {
                const result = await a.action();
                if (result === false) return; // Keep modal open on validation failure
            }
            closeModal(); 
        });
        footer.appendChild(btn);
    });
    overlay.classList.remove('hidden');
}

function closeModal() { 
    $('#modal-overlay').classList.add('hidden'); 
}

$('#modal-close-btn').addEventListener('click', closeModal);
$('#modal-overlay').addEventListener('click', (e) => { 
    if (e.target === $('#modal-overlay')) closeModal(); 
});

/* ──────────────────────────────────────────────
   4. ROUTING & VIEW CONTROLLER
   ────────────────────────────────────────────── */
const PAGES = [
    'dashboard', 'new-project', 'projects', 'reviewed-projects', 'assessment',
    'questionnaire', 'vault', 'profile', 'settings', 'auditor-review', 'compliance-dashboard', 'framework-manager'
];

function navigateTo(page, saveToHistory = true) {
    if (page === 'project-detail') {
        goToProjectStep(State.currentProjectStep || 1);
        return;
    }
    if (page === 'assessment') {
        const proj = State.getActiveProject();
        if (!proj) {
            showToast("Please select an active project to view A-Z Assessment.", "info");
            navigateTo("projects");
            return;
        }
        if (State.currentUser && State.currentUser.role === 'auditee' && proj.status !== 'Reviewed' && proj.status !== 'Completed') {
            showToast("A-Z Assessment is an Auditor evaluation area. Access restricted.", "warning");
            goToProjectStep(State.currentProjectStep || 1);
            return;
        }
        goToProjectStep(4);
        return;
    }
    if (page === 'questionnaire') {
        const proj = State.getActiveProject();
        if (!proj) {
            showToast("Please select an active project to view Compliance Questionnaire.", "info");
            navigateTo("projects");
            return;
        }
        if (State.currentUser && State.currentUser.role === 'auditee' && proj.status !== 'Reviewed' && proj.status !== 'Completed') {
            showToast("Compliance Questionnaire is an Auditor evaluation area. Access restricted.", "warning");
            goToProjectStep(State.currentProjectStep || 1);
            return;
        }
        goToProjectStep(5);
        return;
    }
    if (page === 'auditor-review') {
        const proj = State.getActiveProject();
        if (!proj) {
            navigateTo("projects");
            return;
        }
        if (State.currentUser && State.currentUser.role === 'auditee' && proj.status !== 'Reviewed' && proj.status !== 'Completed') {
            goToProjectStep(State.currentProjectStep || 1);
            return;
        }
        goToProjectStep(6);
        return;
    }
    if (page === 'compliance-dashboard') {
        const proj = State.getActiveProject();
        if (!proj) {
            navigateTo("projects");
            return;
        }
        goToProjectStep(7);
        return;
    }
    if (!PAGES.includes(page)) return;
    
    // Hide Stepper when viewing generic non-project pages
    if (!['assessment', 'questionnaire', 'auditor-review', 'compliance-dashboard'].includes(page)) {
        $('#project-stepper').style.display = 'none';
        State.activeProjectId = null;
        State.saveState();
    }
    
    $$('.page').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('active');
    });
    const target = $(`#page-${page}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    
    $$('.sidebar-link').forEach(l => l.classList.remove('active'));
    const activeLink = $(`.sidebar-link[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');
    
    const names = {
        'dashboard': 'Dashboard', 
        'new-project': 'New Project', 
        'projects': 'Ongoing Projects',
        'reviewed-projects': 'Reviewed Projects', 
        'assessment': 'A-Z Assessment',
        'questionnaire': 'Compliance Questionnaire', 
        'vault': 'Private Document Vault',
        'profile': 'Profile', 
        'settings': 'Settings',
        'auditor-review': 'Auditor Review',
        'compliance-dashboard': 'Project Compliance Dashboard'
    };
    $('#header-breadcrumb').innerHTML = `<span>${names[page] || page}</span>`;
    State.activeView = page;
    State.saveState();
    closeMobileSidebar();
    $('#app-main').scrollTop = 0;
    window.scrollTo(0, 0);

    /* Refresh page renders */
    if (page === 'dashboard') renderDashboard();
    if (page === 'new-project') initNewProject();
    if (page === 'projects') renderProjectsGrid();
    if (page === 'reviewed-projects') renderReviewedProjectsGrid();
    if (page === 'vault') renderVault();
    if (page === 'profile') renderProfilePage();
}

function showView(viewId) {
    const screens = ['page-login', 'page-register', 'page-forgot', 'page-onboard-auditor', 'page-onboard-auditee', 'app-shell'];
    screens.forEach(id => {
        const el = $(`#${id}`);
        if (el) el.classList.add('hidden');
    });
    
    if (viewId === 'auth-section' || viewId === 'page-login') {
        $(`#page-login`).classList.remove('hidden');
    } else if (viewId === 'page-register') {
        $(`#page-register`).classList.remove('hidden');
    } else if (viewId === 'page-forgot') {
        $(`#page-forgot`).classList.remove('hidden');
    } else if (viewId.startsWith('onboarding')) {
        // Map 'onboarding-auditor' -> '#page-onboard-auditor', 'onboarding-auditee' -> '#page-onboard-auditee'
        const pageId = viewId === 'onboarding-auditor' ? 'page-onboard-auditor' : 'page-onboard-auditee';
        const el = $(`#${pageId}`);
        if (el) el.classList.remove('hidden');
        if (viewId === 'onboarding-auditor') initAuditorOnboardingForm();
        if (viewId === 'onboarding-auditee') initAuditeeOnboardingForm();
    } else {
        $(`#app-shell`).classList.remove('hidden');
        updateUserDisplay();
        renderSidebarNav();
        renderDraftResumeBanner();
        navigateTo(State.activeView || 'dashboard', false);
    }
}

async function enforceOAuthRoleSelection(supabaseUserId, email) {
    return new Promise((resolve) => {
        showModal("Select Your Role", `
            <div style="text-align: center;">
                <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">You signed in with Google. Please select your account type to finalize your setup.</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-primary" id="btn-oauth-auditor">I am an Auditor</button>
                    <button class="btn btn-outline" id="btn-oauth-auditee">I am an Auditee</button>
                </div>
            </div>
        `, []);

        const saveRole = async (role) => {
            showToast(`Registering you as ${role}...`, "info");
            
            document.getElementById('btn-oauth-auditor').disabled = true;
            document.getElementById('btn-oauth-auditee').disabled = true;

            if (_supabase) {
                await _supabase.from('users').upsert({
                    id: supabaseUserId,
                    email: email,
                    role: role,
                    onboarded: false
                });
            }
            
            if (State.currentUser) State.currentUser.role = role;
            State.saveState();
            closeModal();
            resolve(role);
        };

        document.getElementById('btn-oauth-auditor').addEventListener('click', () => saveRole('auditor'));
        document.getElementById('btn-oauth-auditee').addEventListener('click', () => saveRole('auditee'));
    });
}

function renderSidebarNav() {
    if (!State.currentUser) return;
    const isAuditor = State.currentUser.role === 'auditor';
    
    // Toggle auditee onboarding search widget
    const auditeeWidget = document.getElementById("add-auditee-widget");
    if (auditeeWidget) {
        auditeeWidget.style.display = isAuditor ? "block" : "none";
    }

    // Scope ongoing/reviewed projects counts to the logged-in user
    let ongoingCount = State.projects.filter(p => p.status !== 'Reviewed' && p.status !== 'Completed').length;
    let reviewedCount = State.projects.filter(p => p.status === 'Reviewed' || p.status === 'Completed').length;
    if (State.currentUser && State.currentUser.role === 'auditee') {
        ongoingCount = State.projects.filter(p => p.auditeeEmail === State.currentUser.email && p.status !== 'Reviewed' && p.status !== 'Completed').length;
        reviewedCount = State.projects.filter(p => p.auditeeEmail === State.currentUser.email && (p.status === 'Reviewed' || p.status === 'Completed')).length;
    }
    
    const ongoingBadge = document.getElementById("projects-count");
    if (ongoingBadge) ongoingBadge.textContent = ongoingCount;
    const reviewedBadge = document.getElementById("reviewed-count");
    if (reviewedBadge) reviewedBadge.textContent = reviewedCount;

    // Toggle Framework Manager visibility
    const fwManagerItem = document.getElementById("sidebar-item-fw-manager");
    if (fwManagerItem) {
        fwManagerItem.style.display = isAuditor ? "block" : "none";
    }
}

function renderDraftResumeBanner() {
    const banner = document.getElementById("draft-resume-banner");
    if (State.projectDraft && State.currentUser && State.currentUser.role === 'auditee') {
        document.getElementById("draft-banner-case-id").textContent = State.projectDraft.id;
        banner.style.display = "flex";
    } else {
        banner.style.display = "none";
    }
}

/* ──────────────────────────────────────────────
   5. AUTH & LOGIN / REGISTRATION WORKFLOWS
   ────────────────────────────────────────────── */
function updateUserDisplay() {
    if (!State.currentUser) return;
    const u = State.currentUser;
    const initials = u.fullname ? u.fullname.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : "US";
    
    $$('.header-avatar').forEach(el => el.textContent = initials);
    $('#header-user-name').textContent = u.fullname || u.email;
    
    // FIX: Safely handle the pending role state without defaulting to Auditee
    $('#header-user-role').textContent = u.role === 'auditor' ? 'EY Compliance Auditor' : (u.role === 'auditee' ? 'Auditee Representative' : 'Role Pending');
    
    $('#dropdown-user-name').textContent = u.fullname || u.email;
    $('#dropdown-user-email').textContent = u.email;
    
    const profileName = $('#profile-name');
    if (profileName) profileName.textContent = u.fullname;
    
    const profileRole = $('#profile-role');
    if (profileRole) profileRole.textContent = u.role === 'auditor' ? 'Lead AI Auditor' : (u.role === 'auditee' ? 'Technology Director' : 'Pending');
    
    const profileOrg = $('#profile-org');
    if (profileOrg) profileOrg.textContent = u.org;
}

$('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors('login');
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    let valid = true;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { 
        showFormError('login-email', 'Please enter a valid email address'); 
        valid = false; 
    }
    if (!password || password.length < 6) { 
        showFormError('login-password', 'Password must be at least 6 characters'); 
        valid = false; 
    }
    
        if (valid) {
        showToast("Signing in...", "info");
        
        // Try Supabase auth if connected
        if (_supabase) {
            try {
                const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    // Try local fallback sign-in
                    const res = State.loginUser(email, password);
                    if (res.success) {
                        showToast(`Welcome back, ${State.currentUser.fullname}! (Local Offline Mode)`, "success");
                        showView(State.currentUser.onboarded ? "app-shell" : 
                                 (State.currentUser.role === "auditor" ? "onboarding-auditor" : "onboarding-auditee"));
                        return;
                    }
                    showToast(error.message, "error");
                    return;
                }
                showToast("Signed in successfully via Supabase.", "success");
                return; // Auth state listener will handle routing
            } catch (err) {
                console.warn("Supabase signin error, trying offline fallback:", err);
            }
        }
        
        // Fallback to local
        const res = State.loginUser(email, password);
        if (res.success) {
            showToast(`Welcome back, ${State.currentUser.fullname}!`, "success");
            showView(State.currentUser.onboarded ? "app-shell" : 
                     (State.currentUser.role === "auditor" ? "onboarding-auditor" : "onboarding-auditee"));
        } else {
            showToast(res.message, "error");
            showFormError('login-password', res.message);
        }
    }
});

$('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors('reg');
    const fname = $('#reg-fname').value.trim();
    const designation = $('#reg-designation').value.trim();
    const org = $('#reg-org').value.trim();
    const mobile = $('#reg-mobile').value.trim();
    const email = $('#reg-email').value.trim();
    const role = $('#reg-role').value;
    const password = $('#reg-password').value;
    const confirm = $('#reg-confirm').value;
    const terms = $('#reg-terms').checked;
    let valid = true;
    
    if (!fname) { showFormError('reg-fname', 'Full name is required'); valid = false; }
    if (!designation) { showFormError('reg-designation', 'Designation is required'); valid = false; }
    if (!org) { showFormError('reg-org', 'Organization is required'); valid = false; }
    if (!mobile) { showFormError('reg-mobile', 'Mobile number is required'); valid = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFormError('reg-email', 'Valid email is required'); valid = false; }
    if (!role) { showFormError('reg-role', 'Please select a role'); valid = false; }
    if (!password || password.length < 8) { showFormError('reg-password', 'Password must be at least 8 characters'); valid = false; }
    if (password !== confirm) { showFormError('reg-confirm', 'Passwords do not match'); valid = false; }
    if (!terms) { showFormError('reg-terms', 'You must agree to the terms'); valid = false; }

    if (valid) {
        showToast("Creating account...", "info");
        
        if (_supabase) {
            try {
                const { data, error } = await _supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            fullname: fname,
                            org: org,
                            designation: designation,
                            role: role,
                            mobile: mobile
                        }
                    }
                });
                
                if (error) {
                    // Try local fallback registration
                    const res = State.registerUser(fname, org, designation, email, mobile, password, role);
                    if (res.success) {
                        showToast("Account created locally (Supabase database offline).", "success");
                        State.loginUser(email, password);
                        showView(role === 'auditor' ? 'onboarding-auditor' : 'onboarding-auditee');
                        return;
                    }
                    showToast(error.message, "error");
                    return;
                }
                
                // Create profile row in users table
                const { error: dbErr } = await _supabase
                    .from('users')
                    .insert([{
                        id: data.user.id,
                        email: email,
                        fullname: fname,
                        org: org,
                        designation: designation,
                        role: role,
                        mobile: mobile,
                        onboarded: false,
                        profile: null
                    }]);
                
                if (dbErr) {
                    console.error("Database user profile creation failed:", dbErr);
                }
                
                showToast("Account created successfully! Check email for verification link.", "success");
                return;
            } catch (err) {
                console.warn("Supabase signup error, trying offline fallback:", err);
            }
        }
        
        // Local Fallback
        const res = State.registerUser(fname, org, designation, email, mobile, password, role);
        if (res.success) {
            showToast("Account created locally.", "success");
            State.loginUser(email, password);
            showView(role === 'auditor' ? 'onboarding-auditor' : 'onboarding-auditee');
        }
    }
});

$('#reg-draft').addEventListener('click', () => {
    const fname = $('#reg-fname').value.trim();
    const designation = $('#reg-designation').value.trim();
    const org = $('#reg-org').value.trim();
    const mobile = $('#reg-mobile').value.trim();
    const email = $('#reg-email').value.trim();
    const role = $('#reg-role').value;
    
    State.regDraft = { fname, designation, org, mobile, email, role };
    State.saveState();
    showToast('Registration draft saved successfully.', 'success');
});

// Resume Registration Draft if present
function resumeRegDraft() {
    if (State.regDraft) {
        $('#reg-fname').value = State.regDraft.fname || '';
        $('#reg-designation').value = State.regDraft.designation || '';
        $('#reg-org').value = State.regDraft.org || '';
        $('#reg-mobile').value = State.regDraft.mobile || '';
        $('#reg-email').value = State.regDraft.email || '';
        if (State.regDraft.role) $('#reg-role').value = State.regDraft.role;
    }
}
resumeRegDraft();

// Forgot Password Flow
$('#forgot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearFormErrors('forgot');
    const email = $('#forgot-email').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { 
        showFormError('forgot-email', 'Please enter a valid email address'); 
        return; 
    }
    
    showToast("Sending reset link...", "info");
    if (_supabase) {
        _supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.href
        }).then(({ error }) => {
            if (error) {
                showToast(error.message, "error");
            } else {
                showModal('Reset Link Sent', `<p style="color:var(--text-secondary);font-size:16px;line-height:1.6;">A password reset link has been sent to <strong style="color:var(--text-primary)">${email}</strong>.</p>`, [
                    { label: 'Back to Sign In', class: 'btn-primary', action: () => showView('auth-section') }
                ]);
            }
        });
    } else {
        showModal('Offline Mode', `<p style="color:var(--text-secondary);font-size:16px;">Cannot reset password while database is offline.</p>`, [
            { label: 'Back to Sign In', class: 'btn-primary', action: () => showView('auth-section') }
        ]);
    }
});

// Google Login Integration
$('#btn-google-login').addEventListener('click', async () => {
    // 1. Detect file:// protocol and show a friendly modal explaining why it doesn't work and how to fix it.
    if (window.location.protocol === 'file:') {
        showModal('Local Server Required', `
            <div style="color: var(--text-secondary); font-size: 15px; line-height: 1.5;">
                <p style="margin-bottom: 12px;"><strong style="color: var(--text-primary);">Google Sign-In is not supported when opening the file directly (file:// protocol).</strong></p>
                <p>OAuth providers (like Google) require a secure web environment (http/https) to redirect back to. Running from a local folder blocks this redirection.</p>
                <p style="margin-top: 12px; margin-bottom: 6px;"><strong>How to resolve:</strong></p>
                <ol style="margin-left: 20px; margin-bottom: 12px;">
                    <li>Open your terminal in this project directory.</li>
                    <li>Start the local server by running: <code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: var(--primary-color);">node local-server.js</code></li>
                    <li>Open <a href="http://localhost:8080" target="_blank" style="color: var(--primary-color); text-decoration: underline; font-weight: 500;">http://localhost:8080</a> in your web browser.</li>
                </ol>
                <p>Alternatively, you can sign in instantly using the mock offline credentials (e.g. Ramesh or Auditor) shown at the bottom of the sign-in form.</p>
            </div>
        `, [
            { label: 'Close', class: 'btn-outline', action: () => true }
        ]);
        return;
    }

    if (_supabase) {
        try {
            showToast("Signing in with Google...", "info");
            
            // Clean up redirect URL to match registered Redirect URLs in Supabase
            let redirectUrl = window.location.origin + window.location.pathname;
            if (redirectUrl.endsWith('index.html')) {
                redirectUrl = redirectUrl.substring(0, redirectUrl.length - 10);
            }
            
            // Rewrite 127.0.0.1 to localhost to guarantee match with registered Supabase redirect URLs
            if (window.location.hostname === '127.0.0.1') {
                redirectUrl = redirectUrl.replace('127.0.0.1', 'localhost');
            }
            
            // Log port warning if they are running on an alternate port
            if (window.location.port && window.location.port !== '8080') {
                console.warn(`[Supabase Auth] Using alternate port ${window.location.port}. If redirection fails, ensure http://localhost:${window.location.port}/ is added to your Supabase redirect URLs.`);
            }
            
            console.log("Initiating Google Sign-In with redirect URL:", redirectUrl);
            
            const { error } = await _supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl
                }
            });
            
            if (error) {
                console.error("Supabase OAuth error:", error);
                showToast("Google Login failed: " + error.message, "error");
            }
        } catch (err) {
            console.error("Google Sign-in handler exception:", err);
            showToast("Google Login error: " + err.message, "error");
        }
    } else {
        showToast("Supabase is offline. Google Login is unavailable.", "warning");
    }
});

// Navigation shortcuts
$('#goto-register').addEventListener('click', (e) => { e.preventDefault(); showView('page-register'); });
$('#goto-login').addEventListener('click', (e) => { e.preventDefault(); showView('auth-section'); });
$('#login-forgot').addEventListener('click', (e) => { e.preventDefault(); showView('page-forgot'); });
$('#goto-login-from-forgot').addEventListener('click', (e) => { e.preventDefault(); showView('auth-section'); });

/* ──────────────────────────────────────────────
   6. ONBOARDING FORMS
   ────────────────────────────────────────────── */
function initAuditorOnboardingForm() {
    if (!State.currentUser) return;
    const nameEl = document.getElementById("onb-aud-name");
    const orgEl = document.getElementById("onb-aud-org");
    if (nameEl) nameEl.value = State.currentUser.fullname || "";
    if (orgEl) orgEl.value = State.currentUser.org || "";
    
    // Fill from draft
    if (State.onbAudDraft) {
        if (State.onbAudDraft.qualification) $('#ao-qual').value = State.onbAudDraft.qualification;
        if (State.onbAudDraft.experience) $('#ao-exp').value = State.onbAudDraft.experience;
        if (State.onbAudDraft.specialization) $('#ao-specialization').value = State.onbAudDraft.specialization;
        if (State.onbAudDraft.certificationId) $('#ao-cert').value = State.onbAudDraft.certificationId;
        if (State.onbAudDraft.bio) $('#ao-bio').value = State.onbAudDraft.bio;
        
        if (State.onbAudDraft.frameworks && Array.isArray(State.onbAudDraft.frameworks)) {
            document.querySelectorAll('#auditor-onboard-form .checkbox-input').forEach(cb => {
                cb.checked = State.onbAudDraft.frameworks.includes(cb.closest('.checkbox-label').querySelector('.checkbox-text').textContent.trim());
            });
        }
    }
    updateOnboardProgress('#auditor-onboard-form');
}

function initAuditeeOnboardingForm() {
    if (!State.currentUser) return;
    const nameEl = document.getElementById("ae-poc-name");
    const emailEl = document.getElementById("ae-poc-email");
    if (nameEl) nameEl.value = State.currentUser.fullname || "";
    if (emailEl) emailEl.value = State.currentUser.email || "";
    
    // Fill from draft
    if (State.onbAeeDraft) {
        if (State.onbAeeDraft.orgName) $('#ae-org-name').value = State.onbAeeDraft.orgName;
        if (State.onbAeeDraft.orgType) $('#ae-org-type').value = State.onbAeeDraft.orgType;
        if (State.onbAeeDraft.industry) $('#ae-industry').value = State.onbAeeDraft.industry;
        if (State.onbAeeDraft.size) $('#ae-size').value = State.onbAeeDraft.size;
        if (State.onbAeeDraft.aiSystems) $('#ae-ai-systems').value = State.onbAeeDraft.aiSystems;
        if (State.onbAeeDraft.aiDomains) $('#ae-ai-domains').value = State.onbAeeDraft.aiDomains;
        if (State.onbAeeDraft.pocPhone) $('#ae-poc-phone').value = State.onbAeeDraft.pocPhone;
        
        if (State.onbAeeDraft.frameworks && Array.isArray(State.onbAeeDraft.frameworks)) {
            document.querySelectorAll('#auditee-onboard-form .checkbox-input').forEach(cb => {
                cb.checked = State.onbAeeDraft.frameworks.includes(cb.closest('.checkbox-label').querySelector('.checkbox-text').textContent.trim());
            });
        }
    }
    updateOnboardProgress('#auditee-onboard-form');
}

function saveAuditorOnboardingDraft() {
    const qual = $('#ao-qual').value;
    const exp = $('#ao-exp').value;
    const spec = $('#ao-specialization').value;
    const cert = $('#ao-cert').value;
    const bio = $('#ao-bio').value;
    const frameworks = Array.from($('#auditor-onboard-form').querySelectorAll('.checkbox-input:checked')).map(cb => cb.closest('.checkbox-label').querySelector('.checkbox-text').textContent.trim());
    
    State.onbAudDraft = { qualification: qual, experience: exp, specialization: spec, certificationId: cert, bio, frameworks };
    State.saveState();
    showToast('Auditor onboarding draft saved.', 'success');
}

function saveAuditeeOnboardingDraft() {
    const orgName = $('#ae-org-name').value;
    const orgType = $('#ae-org-type').value;
    const industry = $('#ae-industry').value;
    const size = $('#ae-size').value;
    const aiSystems = $('#ae-ai-systems').value;
    const aiDomains = $('#ae-ai-domains').value;
    const pocPhone = $('#ae-poc-phone').value;
    const frameworks = Array.from($('#auditee-onboard-form').querySelectorAll('.checkbox-input:checked')).map(cb => cb.closest('.checkbox-label').querySelector('.checkbox-text').textContent.trim());
    
    State.onbAeeDraft = { orgName, orgType, industry, size, aiSystems, aiDomains, pocPhone, frameworks };
    State.saveState();
    showToast('Organization onboarding draft saved.', 'success');
}

$('#ao-draft').addEventListener('click', saveAuditorOnboardingDraft);
$('#ae-draft').addEventListener('click', saveAuditeeOnboardingDraft);

function updateOnboardProgress(formSel) {
    const form = $(formSel);
    if (!form) return;
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let filled = 0;
    inputs.forEach(i => { if (i.value.trim()) filled++; });
    const pct = inputs.length ? Math.round((filled / inputs.length) * 100) : 0;
    const bar = form.querySelector('.progress-fill');
    const text = form.querySelector('.progress-text');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = pct + '% Complete';
}

['auditor-onboard-form', 'auditee-onboard-form'].forEach(id => {
    const el = $(`#${id}`);
    if (el) {
        el.addEventListener('input', () => updateOnboardProgress(`#${id}`));
        el.addEventListener('change', () => updateOnboardProgress(`#${id}`));
    }
});

$('#auditor-onboard-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showToast("Submitting profile...", "info");
    
    const qual = $('#ao-qual').value;
    const exp = parseInt($('#ao-exp').value) || 0;
    const spec = $('#ao-specialization').value;
    const cert = $('#ao-cert').value.trim();
    const bio = $('#ao-bio').value.trim();
    const certs = Array.from($('#auditor-onboard-form').querySelectorAll('.checkbox-input:checked')).map(cb => cb.closest('.checkbox-label').querySelector('.checkbox-text').textContent.trim());
    if (cert) certs.push(cert);
    
    const profile = { role: spec || qual || "Lead Auditor", years: exp, certs, qualification: qual, specialization: spec, certificationId: cert, bio };
    
    if (_supabase) {
        try {
            const { error } = await withTimeout(_supabase
                .from('users')
                .update({
                    fullname: State.currentUser.fullname,
                    org: State.currentUser.org,
                    onboarded: true,
                    profile: profile
                })
                .eq('id', State.currentUser.id), 2500);
                
            if (error) {
                showToast("Failed to save profile: " + error.message, "error");
                return;
            }
        } catch (e) {
            showToast("Cloud profile save timed out. Proceeding offline.", "warning");
        }
    }
    
    State.currentUser.onboarded = true;
    State.currentUser.profile = profile;
    State.onbAudDraft = null;
    State.saveState();
    
    addActivity('Completed auditor onboarding profile');
    showToast('Auditor onboarding submitted successfully. Welcome!', 'success');
    showView('app-shell');
});

$('#auditee-onboard-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showToast("Submitting profile...", "info");
    
    const orgName = $('#ae-org-name').value.trim();
    const orgType = $('#ae-org-type').value;
    const industry = $('#ae-industry').value;
    const size = $('#ae-size').value;
    const aiSystems = parseInt($('#ae-ai-systems').value) || 0;
    const aiDomains = $('#ae-ai-domains').value.trim();
    const pocName = $('#ae-poc-name').value.trim();
    const pocEmail = $('#ae-poc-email').value.trim();
    const pocPhone = $('#ae-poc-phone').value.trim();
    const frameworks = Array.from($('#auditee-onboard-form').querySelectorAll('.checkbox-input:checked')).map(cb => cb.closest('.checkbox-label').querySelector('.checkbox-text').textContent.trim());
    
    const profile = { profExp: 10, aiExp: 5, certs: frameworks, customCert: "", orgName, orgType, industry, size, aiSystems, aiDomains, pocName, pocEmail, pocPhone, frameworks };
    
    if (_supabase) {
        try {
            const { error } = await withTimeout(_supabase
                .from('users')
                .update({
                    fullname: pocName || State.currentUser.fullname,
                    org: orgName || State.currentUser.org,
                    designation: "Technology Director",
                    mobile: pocPhone,
                    onboarded: true,
                    profile: profile
                })
                .eq('id', State.currentUser.id), 2500);
                
            if (error) {
                showToast("Failed to save profile: " + error.message, "error");
                return;
            }
        } catch (e) {
            showToast("Cloud profile save timed out. Proceeding offline.", "warning");
        }
    }
    
    State.currentUser.fullname = pocName || State.currentUser.fullname;
    State.currentUser.org = orgName || State.currentUser.org;
    State.currentUser.designation = "Technology Director";
    State.currentUser.mobile = pocPhone;
    State.currentUser.onboarded = true;
    State.currentUser.profile = profile;
    State.onbAeeDraft = null;
    State.saveState();
    
    addActivity('Completed organization onboarding profile');
    showToast('Organization onboarding submitted successfully!', 'success');
    showView('app-shell');
});

/* ──────────────────────────────────────────────
   7. GENERAL FORM HELPERS
   ────────────────────────────────────────────── */
function showFormError(fieldId, message) {
    const el = $(`#${fieldId}-error`);
    if (el) el.textContent = message;
    const input = $(`#${fieldId}`);
    if (input) input.style.borderColor = 'var(--semantic-red)';
}

function clearFormErrors(prefix) {
    $$(`[id^="${prefix}"][id$="-error"]`).forEach(el => el.textContent = '');
    $$(`[id^="${prefix}"]`).forEach(el => {
        if (el.classList && el.classList.contains('form-input')) el.style.borderColor = '';
    });
}

/* ──────────────────────────────────────────────
   8. SIDEBAR INTERACTIVITY
   ────────────────────────────────────────────── */
$('#sidebar-toggle').addEventListener('click', () => {
    const sidebar = $('#app-sidebar');
    const main = $('#app-main');
    if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('mobile-open');
        State.sidebarMobileOpen = sidebar.classList.contains('mobile-open');
        toggleSidebarOverlay(State.sidebarMobileOpen);
    } else {
        sidebar.classList.toggle('collapsed');
        main.classList.toggle('sidebar-collapsed');
        State.sidebarCollapsed = sidebar.classList.contains('collapsed');
    }
});

function closeMobileSidebar() {
    $('#app-sidebar').classList.remove('mobile-open');
    toggleSidebarOverlay(false);
    State.sidebarMobileOpen = false;
}

function toggleSidebarOverlay(show) {
    let overlay = $('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', closeMobileSidebar);
        document.body.appendChild(overlay);
    }
    overlay.classList.toggle('visible', show);
}

// User dropdown menu
$('#header-user').addEventListener('click', (e) => { 
    e.stopPropagation(); 
    $('#user-dropdown').classList.toggle('hidden'); 
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#user-dropdown') && !e.target.closest('#header-user')) {
        $('#user-dropdown').classList.add('hidden');
    }
});

async function doLogout() {
    $('#user-dropdown').classList.add('hidden');
    showToast("Signing out...", "info");
    
    if (_supabase) {
        await _supabase.auth.signOut();
    }
    
    State.logout();
    showView('auth-section');
    showToast('You have been signed out.', 'info');
}

$('#btn-logout').addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
$('#sidebar-logout').addEventListener('click', (e) => { e.preventDefault(); doLogout(); });

// Password input visibility toggler
$$('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = $(`#${btn.dataset.target}`);
        if (target.type === 'password') {
            target.type = 'text';
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        } else {
            target.type = 'password';
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
    });
});

/* ──────────────────────────────────────────────
   9. GENERAL DASHBOARD (page-dashboard)
   ────────────────────────────────────────────── */
function renderDashboard() {
    updateKPIs();
    renderDashProjects();
    renderDashActivities();
    renderDashFrameworks();
    
    // Dynamic role-based dashboard labeling
    const pageTitle = $('#page-dashboard .page-title');
    const pageSubtitle = $('#page-dashboard .page-subtitle');
    if (pageTitle && pageSubtitle && State.currentUser) {
        if (State.currentUser.role === 'auditor') {
            pageTitle.textContent = 'Auditor Dashboard';
            pageSubtitle.textContent = 'Compliance audit overview and project status at a glance';
        } else if (State.currentUser.role === 'auditee') {
            pageTitle.textContent = 'Auditee Dashboard';
            pageSubtitle.textContent = 'Compliance self-assessment and project status at a glance';
        } else {
            pageTitle.textContent = 'Dashboard';
            pageSubtitle.textContent = 'Compliance overview and project status at a glance';
        }
    }
    // Update reviewed projects badge count
    const reviewedBadge = document.getElementById('reviewed-count');
    if (reviewedBadge) {
        let reviewedCount = State.projects.filter(p => p.status === 'Reviewed' || p.status === 'Completed').length;
        if (State.currentUser && State.currentUser.role === 'auditee') {
            reviewedCount = State.projects.filter(p => p.auditeeEmail === State.currentUser.email && (p.status === 'Reviewed' || p.status === 'Completed')).length;
        }
        reviewedBadge.textContent = reviewedCount;
    }
    // Update ongoing projects badge count
    const ongoingBadge = document.getElementById('projects-count');
    if (ongoingBadge) {
        let ongoingCount = State.projects.filter(p => p.status !== 'Reviewed' && p.status !== 'Completed').length;
        if (State.currentUser && State.currentUser.role === 'auditee') {
            ongoingCount = State.projects.filter(p => p.auditeeEmail === State.currentUser.email && p.status !== 'Reviewed' && p.status !== 'Completed').length;
        }
        ongoingBadge.textContent = ongoingCount;
    }
}

function updateKPIs() {
    // Total, pass, fail, na counters across all active projects
    let totalQuestions = 0;
    let submittedCount = 0;
    let draftCount = 0;
    let unansweredCount = 0;
    
    // Filter projects for the logged-in auditee
    let targetProjects = State.projects;
    if (State.currentUser && State.currentUser.role === 'auditee') {
        targetProjects = State.projects.filter(p => p.auditeeEmail === State.currentUser.email);
    }
    
    targetProjects.forEach(p => {
        // AZ (fixed math to count dynamic length of AZ questions)
        const azCount = AZ_QUESTIONS.reduce((acc, s) => acc + s.questions.length, 0);
        totalQuestions += azCount;
        
        AZ_QUESTIONS.forEach(section => {
            section.questions.forEach(q => {
                const ans = p.azAnswers[q.id];
                if (ans && ans.value !== 'unanswered') {
                    if (p.azSubmitted) submittedCount++;
                    else draftCount++;
                } else {
                    unansweredCount++;
                }
            });
        });
        
        // Compliance
        COMPLIANCE_QUESTIONS.forEach(section => {
            const isSelected = p.frameworks.some(f => section.section.includes(f));
            if (!isSelected) return;
            totalQuestions += section.questions.length;
            section.questions.forEach(q => {
                const ans = p.complianceAnswers[q.id];
                if (ans && ans.value !== 'unanswered') {
                    if (p.complianceSubmitted) submittedCount++;
                    else draftCount++;
                } else {
                    unansweredCount++;
                }
            });
        });
    });
    
    // Fallback if no projects exist for target user
    if (targetProjects.length === 0) {
        totalQuestions = 0;
        unansweredCount = 0;
    }
    
    animateCounter('kpi-total', totalQuestions);
    animateCounter('kpi-submitted', submittedCount);
    animateCounter('kpi-draft', draftCount);
    animateCounter('kpi-unanswered', unansweredCount);
    
    // Animate overall status tiles
    const totalEval = submittedCount + draftCount;
    const overallPct = totalQuestions > 0 ? Math.round((submittedCount / totalQuestions) * 100) : 0;
    
    $$('.status-tile').forEach((tile, idx) => {
        let pct = 0;
        let bar = tile.querySelector('.progress-fill');
        let text = tile.querySelector('.status-tile-pct');
        
        if (idx === 0) {
            pct = overallPct;
        } else {
            // Mock specific framework progression metrics
            pct = Math.round(overallPct * (1.2 - idx * 0.15));
            if (pct < 0) pct = 0;
            if (pct > 100) pct = 100;
        }
        
        if (text) text.textContent = pct + '%';
        if (bar) bar.style.width = pct + '%';
    });
}

function animateCounter(id, target) {
    const el = $(`#${id}`);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const interval = setInterval(() => {
        current += step;
        if (current >= target) { 
            current = target; 
            clearInterval(interval); 
        }
        el.textContent = current;
    }, 20);
}

function renderDashProjects() {
    const container = $('#dash-project-list');
    if (!container) return;
    
    // Apply role scoping
    let filtered = State.projects;
    if (State.currentUser && State.currentUser.role === 'auditee') {
        filtered = State.projects.filter(p => p.auditeeEmail === State.currentUser.email);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="color:var(--text-tertiary);font-size:14px;padding:16px 0;text-align:center;">No ongoing projects yet. Create your first project to get started.</p>';
        return;
    }
    
    container.innerHTML = filtered.slice(0, 5).map(p => `
        <div class="project-list-item" style="cursor:pointer" onclick="selectProjectForAssessment('${p.id}')">
            <div class="project-list-info">
                <span class="project-list-name">${p.title}</span>
                <span class="project-list-meta">Case ID: ${p.id} &middot; ${p.frameworks.map(getFrameworkName).join(', ')}</span>
            </div>
            ${getStatusBadge(p.status)}
        </div>
    `).join('');
}

function renderDashActivities() {
    const container = $('#dash-activity-list');
    if (!container) return;
    if (State.activities.length === 0) {
        container.innerHTML = '<p style="color:var(--text-tertiary);font-size:14px;padding:16px 0;text-align:center;">No recent activity.</p>';
        return;
    }
    container.innerHTML = State.activities.slice(0, 6).map(a => `
        <div class="activity-item">
            <span class="activity-dot"></span>
            <div class="activity-content">
                <p class="activity-text">${a.text}</p>
                <span class="activity-time">${a.time}</span>
            </div>
        </div>
    `).join('');
}

function renderDashFrameworks() {
    const container = $('#dash-framework-grid');
    if (!container) return;
    
    const frameworksList = [
        { key: 'eu-ai-act', name: 'EU AI Act', desc: 'European Union Artificial Intelligence Regulation', progress: 57 },
        { key: 'nist-ai-rmf', name: 'NIST AI RMF', desc: 'Risk Management Framework for Artificial Intelligence', progress: 42 },
        { key: 'iso-42001', name: 'ISO 42001', desc: 'Information technology — Artificial intelligence — Management system', progress: 30 },
        { key: 'dpdp', name: 'DPDP Act', desc: 'Digital Personal Data Protection Act (India)', progress: 75 },
        { key: 'meity', name: 'MeitY Guidelines', desc: 'Ministry of Electronics & Information Technology AI Advisories', progress: 20 }
    ];
    
    container.innerHTML = frameworksList.map(f => `
        <div class="framework-card">
            <div class="framework-card-header">
                <div class="framework-card-icon">${f.name.split(' ').map(w => w[0]).join('')}</div>
                <div style="flex:1">
                    <h3 class="framework-card-name">${f.name}</h3>
                    <p class="framework-card-desc">${f.desc}</p>
                </div>
            </div>
            <div class="framework-card-progress">
                <div class="progress-bar"><div class="progress-fill" style="width:${f.progress}%"></div></div>
                <span class="framework-card-pct">${f.progress}%</span>
            </div>
        </div>
    `).join('');
}

/* ──────────────────────────────────────────────
   10. NEW PROJECT FORM & CREATION (page-new-project)
   ────────────────────────────────────────────── */
function generateUniqueCaseId() {
    const existingIds = new Set(State.projects.map(p => p.id));
    let id;
    do {
        id = String(Math.floor(10000 + Math.random() * 90000));
    } while (existingIds.has(id));
    return id;
}

function initNewProject() {
    if (!State.currentUser) return;
    const caseId = generateUniqueCaseId();
    $('#proj-case-id').value = caseId;
    $('#proj-owner').value = State.currentUser.fullname || "";
    
    // Handle framework checkbox style triggers
    $$('.framework-select-card input').forEach(cb => {
        cb.addEventListener('change', () => {
            cb.closest('.framework-select-card').classList.toggle('active', cb.checked);
        });
    });
}

function saveProjectFormDraft() {
    const caseId = $('#proj-case-id').value;
    const title = $('#proj-name').value.trim();
    const domain = $('#proj-domain').value;
    const desc = $('#proj-desc').value.trim();
    const frameworks = Array.from(document.querySelectorAll('#new-project-form .framework-checkbox:checked')).map(cb => cb.value);
    
    State.projectDraft = { id: caseId, title, domain, desc, frameworks, documents: [] };
    State.saveState();
    showToast("Project draft saved successfully.", "success");
    renderDraftResumeBanner();
}

function resumeProjectFormDraft() {
    if (!State.projectDraft) return;
    
    $('#proj-case-id').value = State.projectDraft.id;
    $('#proj-name').value = State.projectDraft.title || '';
    $('#proj-domain').value = State.projectDraft.domain || '';
    $('#proj-desc').value = State.projectDraft.desc || '';
    
    $$('#new-project-form .framework-checkbox').forEach(cb => {
        cb.checked = State.projectDraft.frameworks.includes(cb.value);
        cb.closest('.framework-select-card').classList.toggle('active', cb.checked);
    });
    
    showToast("Draft project resumed.", "success");
    navigateTo("new-project");
}

$('#proj-draft').addEventListener('click', saveProjectFormDraft);
$('#btn-resume-draft').addEventListener('click', resumeProjectFormDraft);

$('#new-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors('proj');
    const id = $('#proj-case-id').value;
    const title = $('#proj-name').value.trim();
    const domain = $('#proj-domain').value;
    const desc = $('#proj-desc').value.trim();
    const frameworksRaw = Array.from(document.querySelectorAll('#new-project-form .framework-checkbox:checked')).map(cb => cb.value);
    
    let valid = true;
    if (!title) { showFormError('proj-name', 'Project title is required'); valid = false; }
    if (!domain) { showFormError('proj-domain', 'Domain is required'); valid = false; }
    if (frameworksRaw.length === 0) {
        showToast("Please check at least one target compliance framework.", "error");
        valid = false;
    }
    
    if (valid) {
        const frameworksMapped = frameworksRaw.map(getFrameworkDbVal);
        
        showModal("Confirm Project Submission", `Are you sure you want to submit Case ID ${id} for compliance audit? Once submitted, details cannot be edited.`, [
            { label: 'Cancel', class: 'btn-outline' },
            {
                label: 'Confirm & Submit',
                class: 'btn-primary',
                action: async () => {
                    const newProj = {
                        id,
                        title,
                        domain,
                        desc,
                        frameworks: frameworksMapped,
                        status: "Submitted — Awaiting Auditor Review",
                        auditeeEmail: State.currentUser.email,
                        auditeeProfile: {
                            designation: State.currentUser.designation || 'Technology Director',
                            profExp: State.currentUser.profile?.profExp || 10,
                            aiExp: State.currentUser.profile?.aiExp || 5,
                            certs: (State.currentUser.profile?.certs || []).join(", ")
                        },
                        documents: [],
                        azAnswers: {},
                        complianceAnswers: {},
                        azSubmitted: false,
                        complianceSubmitted: false
                    };
                    
                    showToast("Saving project...", "info");
                    
                    if (_supabase) {
                        try {
                            const { error: projErr } = await _supabase
                                .from('projects')
                                .upsert({
                                    id: newProj.id,
                                    title: newProj.title,
                                    domain: newProj.domain,
                                    description: newProj.desc,
                                    frameworks: newProj.frameworks,
                                    status: newProj.status,
                                    auditee_email: newProj.auditeeEmail.toLowerCase().trim(),
                                    auditee_profile: newProj.auditeeProfile,
                                    auditor_email: null,
                                    az_submitted: false,
                                    compliance_submitted: false
                                }, { onConflict: 'id' });
                                
                            if (projErr) {
                                console.warn("Supabase save failed: " + projErr.message);
                                showToast("Cloud save failed — saving locally.", "warning");
                            }
                        } catch (err) {
                            console.error("Supabase upsert error:", err);
                        }
                    }
                    
                    // Add to local projects list
                    const existingIdx = State.projects.findIndex(p => p.id === id);
                    if (existingIdx !== -1) {
                        State.projects[existingIdx] = newProj;
                    } else {
                        State.projects.unshift(newProj);
                    }
                    
                    State.projectDraft = null;
                    State.saveState();
                    
                    addActivity(`Submitted new project: ${title} (Case ID: ${id})`);
                    showToast("Project submitted successfully!", "success");
                    
                    // Clear inputs
                    $('#proj-name').value = '';
                    $('#proj-domain').value = '';
                    $('#proj-desc').value = '';
                    $$('#new-project-form .framework-checkbox').forEach(cb => {
                        cb.checked = false;
                        cb.closest('.framework-select-card').classList.remove('active');
                    });
                    
                    // Re-render and navigate
                    renderDraftResumeBanner();
                    navigateTo('projects');
                }
            }
        ]);
    }
});

/* ──────────────────────────────────────────────
   11. PROJECTS GRID (page-projects & page-reviewed-projects)
   ────────────────────────────────────────────── */
function renderProjectsGrid() {
    const grid = $('#projects-grid');
    if (!grid) return;
    
    // Filter active (non-completed / non-reviewed) projects
    let filtered = State.projects.filter(p => p.status !== 'Reviewed' && p.status !== 'Completed');
    if (State.currentUser && State.currentUser.role === 'auditee') {
        filtered = filtered.filter(p => p.auditeeEmail === State.currentUser.email);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-tertiary);padding:48px 0;">No ongoing assessment projects found.</div>';
        return;
    }
    
    grid.innerHTML = filtered.map(p => `
        <div class="project-card">
            <div class="project-card-header">
                <span class="project-card-id">${p.id}</span>
                ${getStatusBadge(p.status)}
            </div>
            <h3 class="project-card-title">${p.title}</h3>
            <p class="project-card-desc">${p.desc || p.description || 'No description provided.'}</p>
            <div class="project-card-meta">
                <span class="project-card-meta-label">Frameworks</span>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                    ${p.frameworks.map(f => `<span class="badge badge-framework">${f}</span>`).join('')}
                </div>
            </div>
            <div style="margin-top:1.25rem;display:flex;justify-content:flex-end;">
                <button class="btn btn-primary btn-sm" onclick="selectProjectForAssessment('${p.id}')">Open Assessment</button>
            </div>
        </div>
    `).join('');
}

function renderReviewedProjectsGrid() {
    const grid = $('#reviewed-projects-grid');
    if (!grid) return;
    
    let filtered = State.projects.filter(p => p.status === 'Reviewed' || p.status === 'Completed');
    if (State.currentUser && State.currentUser.role === 'auditee') {
        filtered = filtered.filter(p => p.auditeeEmail === State.currentUser.email);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-tertiary);padding:48px 0;">No completed reports found.</div>';
        return;
    }
    
    grid.innerHTML = filtered.map(p => `
        <div class="project-card">
            <div class="project-card-header">
                <span class="project-card-id">${p.id}</span>
                ${getStatusBadge(p.status)}
            </div>
            <h3 class="project-card-title">${p.title}</h3>
            <p class="project-card-desc">${p.desc || p.description || 'No description provided.'}</p>
            <div style="margin-top:1.25rem;display:flex;justify-content:flex-end;">
                <button class="btn btn-outline btn-sm" onclick="selectProjectForAssessment('${p.id}')">View Results</button>
            </div>
        </div>
    `).join('');
}

function selectProjectForAssessment(projId) {
    const proj = State.projects.find(p => p.id === projId);
    if (!proj) return;
    
    State.activeProjectId = proj.id;
    
    let step;
    if (proj.status === 'Reviewed' || proj.status === 'Completed') {
        // Reviewed projects: everyone lands on the final dashboard
        step = 7;
    } else if (State.currentUser.role === 'auditor') {
        // Auditors always land on Step 4 (A-Z Assessment) to fill in the form
        // If AZ is done but compliance not, land on Step 5; otherwise Step 4
        step = proj.azSubmitted ? 5 : 4;
        if (proj.azSubmitted && proj.complianceSubmitted) step = 6;
    } else {
        // Auditees start at Step 1 (Overview)
        step = 1;
    }
    
    State.currentProjectStep = step;
    State.saveState();
    
    goToProjectStep(step);
}

// Trigger "New Project" button bindings
const newProjBtn = $('#projects-new-btn');
if (newProjBtn) newProjBtn.addEventListener('click', () => navigateTo('new-project'));
const dashNewProjBtn = $('#dash-new-project');
if (dashNewProjBtn) dashNewProjBtn.addEventListener('click', () => navigateTo('new-project'));

/* ──────────────────────────────────────────────
   12. STEP-BY-STEP STEPPER WIZARD FLOW (Steps 1–7)
   ────────────────────────────────────────────── */
async function goToProjectStep(stepNumber) {
    const proj = State.getActiveProject();
    if (!proj) {
        navigateTo("projects");
        return;
    }

    State.currentProjectStep = stepNumber;
    State.saveState();

    // Map step to view page divisions
    let activePageId = "";
    if (stepNumber >= 1 && stepNumber <= 3) {
        activePageId = "project-detail-view";
    } else if (stepNumber === 4) {
        activePageId = "page-assessment";
    } else if (stepNumber === 5) {
        activePageId = "page-questionnaire";
    } else if (stepNumber === 6) {
        activePageId = "page-auditor-review";
    } else if (stepNumber === 7) {
        activePageId = "page-compliance-dashboard";
    }

    // Toggle pages
    $$('.page').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('active');
    });
    const pageEl = $(`#${activePageId}`);
    if (pageEl) {
        pageEl.classList.remove('hidden');
        pageEl.classList.add('active');
    }

    // Update global breadcrumbs
    const stepsLabels = ["Overview", "Auditee Info", "Documents", "A-Z Assessment", "Compliance", "Auditor Review", "Dashboard"];
    $('#header-breadcrumb').innerHTML = `
        <span>Ongoing Projects</span>
        <span class="breadcrumb-separator">&nbsp;/&nbsp;</span>
        <span>${proj.title}</span>
        <span class="breadcrumb-separator">&nbsp;/&nbsp;</span>
        <span style="color:var(--brand);font-weight:600;">Step ${stepNumber}: ${stepsLabels[stepNumber - 1]}</span>
    `;

    // Manage Stepper header visual progress
    const stepper = $('#project-stepper');
    if (stepper) {
        stepper.style.display = 'flex';
        stepper.querySelectorAll('.step').forEach(s => {
            const sNum = parseInt(s.getAttribute('data-step'));
            s.classList.remove('active', 'completed');
            if (sNum === stepNumber) {
                s.classList.add('active');
            } else if (sNum < stepNumber) {
                s.classList.add('completed');
            }
        });
        
        stepper.querySelectorAll('.step-line').forEach((l, idx) => {
            l.classList.remove('completed');
            if (idx < stepNumber - 1) {
                l.classList.add('completed');
            }
        });
    }

    // Toggle Step Detail Subviews (Overview, Auditee, Documents)
    const overviewSub = $("#project-overview-subview");
    const auditeeSub = $("#project-auditee-subview");
    const documentsSub = $("#project-documents-subview");
    if (overviewSub) overviewSub.style.display = 'none';
    if (auditeeSub) auditeeSub.style.display = 'none';
    if (documentsSub) documentsSub.style.display = 'none';

    const isAuditor = State.currentUser.role === 'auditor';

    if (stepNumber === 1) {
        if (overviewSub) overviewSub.style.display = 'block';
        renderProjectOverviewSub();
    } else if (stepNumber === 2) {
        if (auditeeSub) auditeeSub.style.display = 'block';
        renderProjectAuditeeSub();
    } else if (stepNumber === 3) {
        if (documentsSub) documentsSub.style.display = 'block';
        renderProjectDocumentsSub();
    } else if (stepNumber === 4) {
        renderAZAssessmentSplitView();
    } else if (stepNumber === 5) {
        renderComplianceQuestionnaires();
    } else if (stepNumber === 6) {
        renderAuditorConclusionView();
    } else if (stepNumber === 7) {
        renderComplianceDashboardView();
    }

    // Update State.activeView to persist step navigation on reload
    let viewName = 'project-detail';
    if (stepNumber === 4) viewName = 'assessment';
    else if (stepNumber === 5) viewName = 'questionnaire';
    else if (stepNumber === 6) viewName = 'auditor-review';
    else if (stepNumber === 7) viewName = 'compliance-dashboard';
    State.activeView = viewName;
    State.saveState();

    // Highlight corresponding sidebar link
    $$('.sidebar-link').forEach(l => l.classList.remove('active'));
    let highlightPage = 'projects';
    if (stepNumber === 4) highlightPage = 'assessment';
    else if (stepNumber === 5) highlightPage = 'questionnaire';
    const activeLink = $(`.sidebar-link[data-page="${highlightPage}"]`);
    if (activeLink) activeLink.classList.add('active');
}

async function handleStepNavigation(nextStep) {
    const currentStep = State.currentProjectStep || 1;
    
    // Save draft responses when shifting pages
    if (currentStep === 4 && nextStep !== 4) {
        const proj = State.getActiveProject();
        if (proj && State.currentUser.role === 'auditor' && !proj.azSubmitted) {
            await saveAZAssessmentDraft();
        }
    } else if (currentStep === 5 && nextStep !== 5) {
        const proj = State.getActiveProject();
        if (proj && State.currentUser.role === 'auditor' && !proj.complianceSubmitted) {
            await saveComplianceQuestionnaireDraft();
        }
    }
    
    await goToProjectStep(nextStep);
}

// Stepper Step click listeners
$$('#project-stepper .step').forEach(stepDiv => {
    stepDiv.addEventListener('click', () => {
        const targetStep = parseInt(stepDiv.getAttribute('data-step'));
        
        // Block jump if not selected project
        if (!State.activeProjectId) return;
        
        // Auditors can navigate freely, auditees are restricted to Steps 1-3 (unless project is Reviewed)
        const proj = State.getActiveProject();
        if (State.currentUser.role === 'auditee') {
            if (proj.status === 'Reviewed' || proj.status === 'Completed') {
                handleStepNavigation(targetStep);
            } else if (targetStep <= 3) {
                handleStepNavigation(targetStep);
            } else {
                showToast("Steps 4–7 are Auditor evaluation areas. Access restricted.", "warning");
            }
        } else {
            handleStepNavigation(targetStep);
        }
    });
});

/* ──────────────────────────────────────────────
   13. STEP 1: PROJECT OVERVIEW SUBVIEW
   ────────────────────────────────────────────── */
function renderProjectOverviewSub() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    document.getElementById("det-case-id").textContent = proj.id;
    document.getElementById("det-title").textContent = proj.title;
    document.getElementById("det-desc").textContent = proj.desc || proj.description || "No description.";
    document.getElementById("det-domain").textContent = proj.domain;
    
    // Display list of target frameworks selected
    const container = document.getElementById("det-frameworks-list");
    if (container) {
        container.innerHTML = proj.frameworks.map(f => `<span class="badge badge-framework">${f}</span>`).join(' ');
    }
}

// Overview Wizard buttons
$('#btn-overview-back').addEventListener('click', () => {
    navigateTo('projects');
});
$('#btn-overview-next').addEventListener('click', () => {
    handleStepNavigation(2);
});

/* ──────────────────────────────────────────────
   14. STEP 2: AUDITEE PROFILE SUBVIEW
   ────────────────────────────────────────────── */
function renderProjectAuditeeSub() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    const profile = proj.auditeeProfile || {};
    
    document.getElementById("det-auditee-email").textContent = proj.auditeeEmail;
    document.getElementById("det-auditee-designation").textContent = profile.designation || "Not specified";
    document.getElementById("det-auditee-exp").textContent = (profile.profExp || "N/A") + " Years";
    document.getElementById("det-auditee-ai-exp").textContent = (profile.aiExp || "N/A") + " Years";
    document.getElementById("det-auditee-certs").textContent = profile.certs || "None";
}

// Auditee Profile Wizard buttons
$('#btn-auditee-prev').addEventListener('click', () => {
    handleStepNavigation(1);
});
$('#btn-auditee-next').addEventListener('click', () => {
    handleStepNavigation(3);
});

/* ──────────────────────────────────────────────
   15. STEP 3: PROJECT DOCUMENTS SUBVIEW
   ────────────────────────────────────────────── */
function renderProjectDocumentsSub() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    const isAuditor = State.currentUser.role === 'auditor';
    
    // Show/hide upload card for auditee only (auditors inspect)
    const uploadCard = document.getElementById("detail-upload-container");
    if (uploadCard) {
        uploadCard.style.display = isAuditor ? "none" : "block";
    }
    
    // Render list of documents
    const container = document.getElementById("det-uploaded-docs");
    if (!container) return;
    
    const docs = proj.documents || [];
    if (docs.length === 0) {
        container.innerHTML = '<p style="color:var(--text-tertiary);font-size:14px;padding:12px 0;">No documents uploaded for this project yet.</p>';
        return;
    }
    
    container.innerHTML = docs.map((d, index) => `
        <div class="project-list-item" style="padding:10px 14px; margin-bottom:8px;">
            <div class="project-list-info">
                <span class="project-list-name" style="font-size:14px;">${d.name}</span>
                <span class="project-list-meta" style="font-size:11px;">Tag: ${d.framework} &middot; Size: ${d.size} &middot; Uploaded: ${d.timestamp || 'Recent'}</span>
            </div>
            <div style="display:flex;gap:6px;">
                ${d.storage_path ? `
                    <button class="btn btn-outline btn-sm" onclick="downloadProjectFile('${proj.id}', ${index})" style="padding:4px 8px;font-size:11px;">Download</button>
                ` : ''}
                ${!isAuditor ? `
                    <button class="btn btn-outline btn-sm btn-danger" onclick="deleteProjectFile('${proj.id}', ${index})" style="padding:4px 8px;font-size:11px;border-color:var(--semantic-red);color:var(--semantic-red);">Remove</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Choose project file button click proxy
$('#btn-choose-detail-file').addEventListener('click', () => {
    $('#detail-file-uploader').click();
});

$('#detail-file-uploader').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        document.getElementById("detail-selected-filename").textContent = file.name;
    }
});

// File upload button click handler
$('#btn-upload-project-file').addEventListener('click', async () => {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    const fileInput = document.getElementById("detail-file-uploader");
    const fileObject = fileInput.files[0];
    if (!fileObject) {
        showToast("Please choose a file to upload first.", "error");
        return;
    }
    
    const framework = document.getElementById("detail-upload-framework").value;
    
    showToast(`Uploading "${fileObject.name}" to Supabase Storage...`, "info");
    
    const uniqueFileName = `${Date.now()}_${fileObject.name}`;
    const storagePath = `documents/${uniqueFileName}`;
    const docSize = (fileObject.size / (1024 * 1024)).toFixed(1) + " MB";
    const timestamp = getLocalTimestamp();
    
    let uploadErr = null;
    let dbErr = null;

    if (_supabase) {
        try {
            const { error: err } = await _supabase.storage
                .from('project-documents')
                .upload(storagePath, fileObject);
            uploadErr = err;
                
            if (!uploadErr) {
                const { error: err2 } = await _supabase
                    .from('documents')
                    .insert([{
                        project_id: proj.id,
                        name: fileObject.name,
                        framework: framework,
                        size: docSize,
                        storage_path: storagePath,
                        owner_email: State.currentUser.email,
                        timestamp: timestamp
                    }]);
                dbErr = err2;
            
                if (dbErr) {
                    console.warn("Database document record save failed: " + dbErr.message);
                    await _supabase.storage.from('project-documents').remove([storagePath]);
                }
            } else {
                console.warn("File storage upload failed: " + uploadErr.message);
            }
        } catch (e) {
            console.error("Storage upload caught exception:", e);
        }
    }

    if (!_supabase || uploadErr || dbErr) {
        // Local Fallback
        if (!proj.documents) proj.documents = [];
        proj.documents.push({
            id: 'local-' + Date.now(),
            project_id: proj.id,
            name: fileObject.name,
            framework: framework,
            size: docSize,
            storage_path: storagePath,
            owner_email: State.currentUser.email,
            timestamp: timestamp
        });
        State.saveState();
    }
    
    addActivity(`Uploaded evidence: ${fileObject.name} for ${framework} (Case ID: ${proj.id})`);
    showToast(`Successfully uploaded "${fileObject.name}" to project.`, "success");
    
    // Clear selection
    fileInput.value = '';
    document.getElementById("detail-selected-filename").textContent = "No file chosen";
    
    await syncWithSupabase();
    renderProjectDocumentsSub();
});

// Download and Delete project-specific evidence files
async function downloadProjectFile(projId, docIndex) {
    const proj = State.projects.find(p => p.id === projId);
    if (!proj) return;
    const doc = proj.documents[docIndex];
    if (!doc) return;
    
    showToast(`Downloading file "${doc.name}"...`, "info");
    
    if (_supabase && doc.storage_path) {
        try {
            const { data, error } = await _supabase.storage
                .from('project-documents')
                .download(doc.storage_path);
            if (error) throw error;
            
            const url = URL.createObjectURL(data);
            triggerFileDownload(url, doc.name);
            return;
        } catch (err) {
            console.warn("Supabase download failed:", err);
        }
    }
    
    // Local download warning
    showToast("Local file downloads are mock simulations.", "warning");
}

async function deleteProjectFile(projId, docIndex) {
    const proj = State.projects.find(p => p.id === projId);
    if (!proj) return;
    const doc = proj.documents[docIndex];
    if (!doc) return;
    
    showModal("Delete Document", `Are you sure you want to remove "${doc.name}" from this project?`, [
        { label: 'Cancel', class: 'btn-outline' },
        {
            label: 'Remove',
            class: 'btn-danger',
            action: async () => {
                showToast("Removing file...", "info");
                
                if (_supabase && doc.storage_path && !String(doc.id).startsWith('local-')) {
                    try {
                        if (doc.id) {
                            await _supabase.from('documents').delete().eq('id', doc.id);
                        }
                        await _supabase.storage.from('project-documents').remove([doc.storage_path]);
                    } catch (e) {
                        console.warn("Supabase document delete exception:", e);
                    }
                }
                
                proj.documents.splice(docIndex, 1);
                State.saveState();
                
                addActivity(`Removed evidence: ${doc.name} (Case ID: ${proj.id})`);
                showToast("Document removed.", "success");
                
                await syncWithSupabase();
                renderProjectDocumentsSub();
            }
        }
    ]);
}

window.downloadProjectFile = downloadProjectFile;
window.deleteProjectFile = deleteProjectFile;

// Documents Wizard buttons
$('#btn-docs-prev').addEventListener('click', () => {
    handleStepNavigation(2);
});
$('#btn-docs-next').addEventListener('click', () => {
    // Auditors jump to A-Z, auditees block unless reviewed
    const proj = State.getActiveProject();
    if (State.currentUser.role === 'auditee') {
        if (proj.status === 'Reviewed' || proj.status === 'Completed') {
            handleStepNavigation(4);
        } else {
            showToast("Project details and documents saved. Auditor evaluation pending.", "success");
            navigateTo("projects");
        }
    } else {
        handleStepNavigation(4);
    }
});

/* ──────────────────────────────────────────────
   16. STEP 4: A-Z TECHNICAL ASSESSMENT (split-pane)
   ────────────────────────────────────────────── */
function renderAZAssessmentSplitView() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    const isAuditor = State.currentUser.role === 'auditor';
    const isAzSubmitted = proj.azSubmitted;
    
    // Render left sidebar A-Z list
    const navList = $('#az-nav-list');
    if (!navList) return;
    
    navList.innerHTML = AZ_QUESTIONS.map((section, idx) => {
        // Calculate progress percentage of answers for this section (3 questions)
        let answered = 0;
        section.questions.forEach(q => {
            const ans = proj.azAnswers[q.id];
            if (ans && ans.value !== 'unanswered') answered++;
        });
        const pct = Math.round((answered / 3) * 100);
        
        return `
            <div class="az-nav-item" data-index="${idx}" id="az-nav-item-${section.letter}">
                <span class="az-nav-item-label"><span class="az-nav-item-letter">${section.letter}</span>${section.title}</span>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
                    <span class="az-nav-item-pct">${pct}%</span>
                    <div class="az-nav-item-bar"><div class="az-nav-item-bar-fill" style="width:${pct}%"></div></div>
                </div>
            </div>
        `;
    }).join('');
    
    // Bind click events on A-Z tabs
    navList.querySelectorAll('.az-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            navList.querySelectorAll('.az-nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            renderAZQuestionsWorkspace(parseInt(item.dataset.index));
        });
    });
    
    // Update overall progress bar
    updateAZOverallProgress();
    
    // Render placeholder
    const placeholder = $('.az-question-placeholder');
    const workspaceContainer = $('#az-questions-container');
    placeholder.classList.remove('hidden');
    workspaceContainer.classList.add('hidden');
    
    // Add wizard footer buttons inside A-Z page container if not already placed
    let footerNav = $('#page-assessment .wizard-footer-nav');
    if (!footerNav) {
        footerNav = document.createElement('div');
        footerNav.className = 'wizard-footer-nav';
        footerNav.style.marginTop = '2rem';
        footerNav.innerHTML = `
            <button class="btn btn-outline" id="btn-assessment-prev">⬅️ Previous (Documents)</button>
            <div class="wizard-nav-actions" style="display:flex;gap:0.75rem;">
                <button class="btn btn-outline" id="btn-az-save-draft">Save Draft</button>
                <button class="btn btn-primary" id="btn-az-submit">Submit Assessment</button>
            </div>
            <button class="btn btn-primary" id="btn-assessment-next">Next (Compliance) ➡️</button>
        `;
        $('#page-assessment').appendChild(footerNav);
        
        // Bind footer buttons
        $('#btn-assessment-prev').addEventListener('click', () => handleStepNavigation(3));
        $('#btn-assessment-next').addEventListener('click', () => handleStepNavigation(5));
        $('#btn-az-save-draft').addEventListener('click', saveAZAssessmentDraft);
        $('#btn-az-submit').addEventListener('click', submitAZAssessment);
    }
    
    // Toggle buttons enabled/disabled based on role and submission state
    const saveBtn = $('#btn-az-save-draft');
    const submitBtn = $('#btn-az-submit');
    const isDisabled = !isAuditor || isAzSubmitted;
    if (saveBtn) saveBtn.disabled = isDisabled;
    if (submitBtn) submitBtn.disabled = isDisabled;
}

function renderAZQuestionsWorkspace(sectionIndex) {
    const container = $('#az-questions-container');
    const placeholder = $('.az-question-placeholder');
    if (!container) return;
    
    placeholder.classList.add('hidden');
    container.classList.remove('hidden');
    
    const proj = State.getActiveProject();
    const section = AZ_QUESTIONS[sectionIndex];
    const isEditable = State.currentUser.role === 'auditor' && !proj.azSubmitted;
    
    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);border-bottom:1px solid var(--border);padding-bottom:12px;">
            <h2 style="font-size:var(--h2);font-weight:600;color:var(--text-primary);">Section ${section.letter} — ${section.title}</h2>
            <span class="badge badge-framework">3 Questions</span>
        </div>
    ` + section.questions.map((q, idx) => {
        const savedAns = proj.azAnswers[q.id] || { value: "unanswered", comment: "" };
        const statusClass = savedAns.value !== 'unanswered' ? (proj.azSubmitted ? 'answered' : 'draft-state') : '';
        
        return `
            <div class="question-card ${statusClass}" id="qcard-${q.id}">
                <div class="question-card-header">
                    <span class="question-card-number">Question ${idx + 1}</span>
                    <span class="question-card-id">${q.id}</span>
                </div>
                <p class="question-card-question">${q.text}</p>
                <div class="question-card-guidance">Evaluate implementation controls, logging trails, encryption and security parameters.</div>
                
                <div class="question-card-actions">
                    <div class="question-card-row">
                        <span class="question-card-label">Disposition</span>
                        <select class="form-input form-select q-disposition" id="dropdown-${q.id}" data-qid="${q.id}" ${!isEditable ? 'disabled' : ''}>
                            <option value="unanswered" ${savedAns.value === 'unanswered' ? 'selected' : ''}>Unanswered</option>
                            <option value="pass" ${savedAns.value === 'pass' ? 'selected' : ''}>Pass</option>
                            <option value="fail" ${savedAns.value === 'fail' ? 'selected' : ''}>Fail</option>
                            <option value="na" ${savedAns.value === 'na' ? 'selected' : ''}>Not Applicable</option>
                        </select>
                    </div>
                    <div class="question-card-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
                        <span class="question-card-label">Observations / Audit Comments</span>
                        <textarea class="form-input form-textarea q-comments" id="comment-${q.id}" rows="2" placeholder="Add observation comments, document links, audit notes..." style="width:100%;box-sizing:border-box;" ${!isEditable ? 'disabled' : ''}>${savedAns.comment || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Bind immediate auto-save triggers on input change
    if (isEditable) {
        container.querySelectorAll('.q-disposition, .q-comments').forEach(el => {
            el.addEventListener('change', () => {
                const qId = el.getAttribute('id').split('-').slice(1).join('-');
                updateAZLocalResponse(qId);
                updateAZOverallProgress();
                updateAZSectionProgress(section.letter);
                triggerAutosaveIndicator();
            });
        });
    }
}

function updateAZLocalResponse(qId) {
    const proj = State.getActiveProject();
    const dropdown = document.getElementById(`dropdown-${qId}`);
    const comment = document.getElementById(`comment-${qId}`);
    if (dropdown && comment && proj) {
        proj.azAnswers[qId] = {
            value: dropdown.value,
            comment: comment.value
        };
        State.saveState();
        
        // Visual updates
        const card = document.getElementById(`qcard-${qId}`);
        if (card) {
            card.classList.remove('answered', 'draft-state');
            if (dropdown.value !== 'unanswered') card.classList.add('draft-state');
        }
    }
}

function updateAZSectionProgress(letter) {
    const proj = State.getActiveProject();
    const section = AZ_QUESTIONS.find(s => s.letter === letter);
    if (!section || !proj) return;
    
    let answered = 0;
    section.questions.forEach(q => {
        const ans = proj.azAnswers[q.id];
        if (ans && ans.value !== 'unanswered') answered++;
    });
    const pct = Math.round((answered / 3) * 100);
    
    const tab = document.getElementById(`az-nav-item-${letter}`);
    if (tab) {
        tab.querySelector('.az-nav-item-pct').textContent = pct + '%';
        tab.querySelector('.az-nav-item-bar-fill').style.width = pct + '%';
    }
}

function updateAZOverallProgress() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    let answered = 0;
    AZ_QUESTIONS.forEach(section => {
        section.questions.forEach(q => {
            const ans = proj.azAnswers[q.id];
            if (ans && ans.value !== 'unanswered') answered++;
        });
    });
    
    const total = 78;
    const pct = Math.round((answered / total) * 100);
    
    const bar = $('#az-overall-bar');
    const text = $('#az-overall-pct');
    const navCount = $('#az-nav-count');
    
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = pct + '%';
    if (navCount) navCount.textContent = `${answered} / ${total}`;
}

async function saveAZAssessmentDraft() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    showToast("Saving draft A-Z assessment...", "info");
    
    // Step 1: Capture any currently visible (rendered) DOM answers first
    AZ_QUESTIONS.forEach(section => {
        section.questions.forEach(q => {
            const dropdownEl = document.getElementById(`dropdown-${q.id}`);
            const commentEl = document.getElementById(`comment-${q.id}`);
            if (dropdownEl && commentEl) {
                proj.azAnswers[q.id] = {
                    value: dropdownEl.value,
                    comment: commentEl.value
                };
            }
        });
    });
    
    // Step 2: Save everything (all answers from azAnswers) to local state
    State.saveState();
    
    // Step 3: Push ALL stored answers to Supabase (not just the visible ones)
    if (_supabase) {
        const updates = [];
        AZ_QUESTIONS.forEach(section => {
            section.questions.forEach(q => {
                const ans = proj.azAnswers[q.id];
                if (ans) {
                    updates.push({
                        project_id: proj.id,
                        question_id: q.id,
                        value: ans.value,
                        comment: ans.comment || ''
                    });
                }
            });
        });
        
        if (updates.length > 0) {
            try {
                const { error } = await withTimeout(_supabase
                    .from('responses')
                    .upsert(updates, { onConflict: 'project_id,question_id' }), 2500);
                if (error) {
                    console.warn("Supabase A-Z responses upsert failed:", error.message);
                    showToast("Cloud sync failed — saved locally.", "warning");
                }
            } catch (err) {
                console.error("Supabase A-Z upsert error or timeout:", err);
                showToast("Cloud sync timed out — saved locally.", "warning");
            }
        }
    }
    
    showToast("A-Z technical framework progress saved to draft.", "success");
    
    // Refresh the currently active section view to show updated styles
    const activeNavItem = $('#az-nav-list .active');
    if (activeNavItem) {
        renderAZQuestionsWorkspace(parseInt(activeNavItem.dataset.index));
    }
    updateAZOverallProgress();
}

async function submitAZAssessment() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    showModal("Confirm A-Z Submission", "Are you sure you want to finalize and submit the A-Z assessment? This will lock edits for this section.", [
        { label: 'Cancel', class: 'btn-outline' },
        {
            label: 'Finalize & Submit',
            class: 'btn-primary',
            action: async () => {
                showToast("Submitting A-Z evaluation...", "info");
                
                await saveAZAssessmentDraft();
                
                if (_supabase) {
                    try {
                        const { error } = await withTimeout(_supabase
                            .from('projects')
                            .update({ az_submitted: true })
                            .eq('id', proj.id), 2500);
                        if (error) throw error;
                    } catch (e) {
                        console.warn("Failed to submit status online or timed out:", e.message);
                    }
                }
                
                proj.azSubmitted = true;
                State.saveState();
                
                addActivity(`Finalized and submitted A-Z compliance checks (Case ID: ${proj.id})`);
                showToast("A-Z assessment submitted successfully.", "success");
                
                // Jump to Step 5 Compliance framework
                handleStepNavigation(5);
            }
        }
    ]);
}

/* ──────────────────────────────────────────────
   17. STEP 5: COMPLIANCE QUESTIONNAIRE (accordion tabs)
   ────────────────────────────────────────────── */
function renderComplianceQuestionnaires() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    const selectedFws = proj.frameworks || [];
    
    // Map framework tags to DOM tabs
    const fwTabMapping = {
        "EU AI Act": "tab-eu-ai-act",
        "NIST AI RMF": "tab-nist-ai-rmf",
        "DPDP": "tab-dpdp",
        "MeitY Guidelines": "tab-meity",
        "ISO 42001": "tab-iso-42001"
    };
    
    // Toggle tab header buttons visibility based on selected frameworks
    let firstVisibleTab = "";
    Object.entries(fwTabMapping).forEach(([fwName, tabId]) => {
        const isSelected = selectedFws.includes(fwName);
        const tabBtn = $(`.tab[data-tab="${tabId}"]`);
        if (tabBtn) {
            tabBtn.style.display = isSelected ? "block" : "none";
            if (isSelected && !firstVisibleTab) firstVisibleTab = tabId;
        }
    });
    
    // Load accordion contents
    COMPLIANCE_QUESTIONS.forEach((section, secIdx) => {
        // Find framework name
        let fwName = "";
        if (section.section.includes("EU AI Act")) fwName = "EU AI Act";
        else if (section.section.includes("NIST AI RMF")) fwName = "NIST AI RMF";
        else if (section.section.includes("DPDP")) fwName = "DPDP";
        else if (section.section.includes("MeitY")) fwName = "MeitY Guidelines";
        else if (section.section.includes("ISO 42001")) fwName = "ISO 42001";
        
        if (!selectedFws.includes(fwName)) return;
        
        const tabId = fwTabMapping[fwName];
        const container = $(`#accordion-${tabId.split('-').slice(1).join('-')}`);
        if (!container) return;
        
        const isEditable = State.currentUser.role === 'auditor' && !proj.complianceSubmitted;
        
        // Count section answered
        let answeredCount = 0;
        section.questions.forEach(q => {
            const ans = proj.complianceAnswers[q.id];
            if (ans && ans.value !== 'unanswered') answeredCount++;
        });
        const totalCount = section.questions.length;
        const pct = Math.round((answeredCount / totalCount) * 100);
        const dotClass = pct === 100 ? 'complete' : pct > 0 ? 'partial' : '';
        
        container.innerHTML = `
            <div class="accordion-section open" data-fw="${fwName}" data-section="${secIdx}">
                <div class="accordion-header">
                    <div class="accordion-header-left">
                        <span class="accordion-status-dot ${dotClass}"></span>
                        <span class="accordion-title">${section.section}</span>
                        <span class="accordion-count">${totalCount} questions</span>
                    </div>
                    <div class="accordion-header-right">
                        <span class="accordion-pct">${pct}%</span>
                        <svg class="accordion-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </div>
                <div class="accordion-body">
                    ${section.questions.map((q, qIdx) => {
                        const savedAns = proj.complianceAnswers[q.id] || { value: "unanswered", comment: "" };
                        return `
                            <div class="q-item" data-qid="${q.id}" id="qitem-${q.id}">
                                <div class="q-item-header">
                                    <span class="q-item-number">${qIdx + 1}</span>
                                    <p class="q-item-text">${q.text}</p>
                                </div>
                                <p style="font-size:var(--caption);color:var(--text-tertiary);margin-bottom:var(--space-sm);margin-left:50px;padding:6px 12px;background:var(--bg-surface);border-radius:4px;border-left:3px solid var(--brand);">
                                    Evaluate control guidelines, process documentation, risk metrics, and verification steps.
                                </p>
                                <div class="q-item-actions">
                                    <select class="form-input form-select q-item-disposition" id="dropdown-${q.id}" data-qid="${q.id}" style="max-width:240px" ${!isEditable ? 'disabled' : ''}>
                                        <option value="unanswered" ${savedAns.value === 'unanswered' ? 'selected' : ''}>— Disposition —</option>
                                        <option value="pass" ${savedAns.value === 'pass' ? 'selected' : ''}>Pass</option>
                                        <option value="fail" ${savedAns.value === 'fail' ? 'selected' : ''}>Fail</option>
                                        <option value="na" ${savedAns.value === 'na' ? 'selected' : ''}>Not Applicable</option>
                                    </select>
                                    <input type="text" class="form-input q-item-comment" id="comment-${q.id}" data-qid="${q.id}" placeholder="Compliance observations, document references..." value="${savedAns.comment || ''}" style="flex:1" ${!isEditable ? 'disabled' : ''}>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        // Accordion chevron toggle binding
        container.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.accordion-section').classList.toggle('open');
            });
        });
        
        // Auto-save triggers
        if (isEditable) {
            container.querySelectorAll('.q-item-disposition, .q-item-comment').forEach(el => {
                el.addEventListener('change', () => {
                    const qId = el.getAttribute('data-qid');
                    updateComplianceLocalResponse(qId);
                    updateComplianceProgressBars(fwName, tabId);
                    triggerAutosaveIndicator();
                });
            });
        }
        
        // Update framework progress bar
        updateComplianceProgressBars(fwName, tabId);
    });
    
    // Switch to first visible tab
    if (firstVisibleTab) {
        $$('#q-tabs .tab').forEach(t => t.classList.remove('active'));
        $$('#page-questionnaire .tab-content').forEach(c => c.classList.remove('active'));
        
        const activeTabBtn = $(`.tab[data-tab="${firstVisibleTab}"]`);
        if (activeTabBtn) activeTabBtn.classList.add('active');
        const activeTabContent = $(`#${firstVisibleTab}`);
        if (activeTabContent) activeTabContent.classList.add('active');
    }
    
    // Bind Tab Click Switcher
    $('#q-tabs').onclick = (e) => {
        const tabBtn = e.target.closest('.tab');
        if (!tabBtn) return;
        
        $$('#q-tabs .tab').forEach(t => t.classList.remove('active'));
        $$('#page-questionnaire .tab-content').forEach(c => c.classList.remove('active'));
        
        tabBtn.classList.add('active');
        const contentId = tabBtn.getAttribute('data-tab');
        $(`#${contentId}`).classList.add('active');
    };
    
    // Append wizard footer
    let footerNav = $('#page-questionnaire .wizard-footer-nav');
    if (!footerNav) {
        footerNav = document.createElement('div');
        footerNav.className = 'wizard-footer-nav';
        footerNav.style.marginTop = '2rem';
        footerNav.innerHTML = `
            <button class="btn btn-outline" id="btn-questionnaire-prev">⬅️ Previous (A-Z)</button>
            <div class="wizard-nav-actions" style="display:flex;gap:0.75rem;">
                <button class="btn btn-outline" id="btn-comp-save-draft">Save Draft</button>
                <button class="btn btn-primary" id="btn-comp-submit">Submit Questionnaire</button>
            </div>
            <button class="btn btn-primary" id="btn-questionnaire-next">Next (Auditor Review) ➡️</button>
        `;
        $('#page-questionnaire').appendChild(footerNav);
        
        // Bind footer buttons
        $('#btn-questionnaire-prev').addEventListener('click', () => handleStepNavigation(4));
        $('#btn-questionnaire-next').addEventListener('click', () => handleStepNavigation(6));
        $('#btn-comp-save-draft').addEventListener('click', saveComplianceQuestionnaireDraft);
        $('#btn-comp-submit').addEventListener('click', submitComplianceQuestionnaire);
    }
    
    const saveBtn = $('#btn-comp-save-draft');
    const submitBtn = $('#btn-comp-submit');
    // Fix: was `!State.currentUser.role === 'auditor'` which always evaluates to false
    const isAuditorUser = State.currentUser.role === 'auditor';
    if (saveBtn) saveBtn.disabled = !isAuditorUser || proj.complianceSubmitted;
    if (submitBtn) submitBtn.disabled = !isAuditorUser || proj.complianceSubmitted;
}

function updateComplianceLocalResponse(qId) {
    const proj = State.getActiveProject();
    const dropdown = document.getElementById(`dropdown-${qId}`);
    const comment = document.getElementById(`comment-${qId}`);
    if (dropdown && comment && proj) {
        proj.complianceAnswers[qId] = {
            value: dropdown.value,
            comment: comment.value
        };
        State.saveState();
    }
}

function updateComplianceProgressBars(fwName, tabId) {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    // Find the COMPLIANCE_QUESTIONS section matching this framework
    const section = COMPLIANCE_QUESTIONS.find(s => s.section.includes(fwName.replace(' Guidelines', '').replace(' Act', '')));
    if (!section) return;
    
    let answered = 0;
    section.questions.forEach(q => {
        const ans = proj.complianceAnswers[q.id];
        if (ans && ans.value !== 'unanswered') answered++;
    });
    
    const total = section.questions.length;
    const pct = total ? Math.round((answered / total) * 100) : 0;
    
    const tabSuffix = tabId.split('-').slice(1).join('-');
    const bar = document.getElementById(`qprogress-${tabSuffix === 'nist-ai-rmf' ? 'nist' : tabSuffix}`);
    const text = document.getElementById(`qprogress-${tabSuffix === 'nist-ai-rmf' ? 'nist' : tabSuffix}-text`);
    
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = `${answered} of ${total} answered`;
}

async function saveComplianceQuestionnaireDraft() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    showToast("Saving draft compliance answers...", "info");
    
    // Step 1: Capture any currently visible DOM answers first
    COMPLIANCE_QUESTIONS.forEach(section => {
        section.questions.forEach(q => {
            const dropdownEl = document.getElementById(`dropdown-${q.id}`);
            const commentEl = document.getElementById(`comment-${q.id}`);
            if (dropdownEl && commentEl) {
                proj.complianceAnswers[q.id] = {
                    value: dropdownEl.value,
                    comment: commentEl.value
                };
            }
        });
    });
    
    // Step 2: Save all to local state first
    State.saveState();
    
    // Step 3: Push ALL stored compliance answers to Supabase
    if (_supabase) {
        const updates = [];
        COMPLIANCE_QUESTIONS.forEach(section => {
            section.questions.forEach(q => {
                const ans = proj.complianceAnswers[q.id];
                if (ans) {
                    updates.push({
                        project_id: proj.id,
                        question_id: q.id,
                        value: ans.value,
                        comment: ans.comment || ''
                    });
                }
            });
        });
        
        if (updates.length > 0) {
            try {
                const { error } = await withTimeout(_supabase
                    .from('responses')
                    .upsert(updates, { onConflict: 'project_id,question_id' }), 2500);
                if (error) {
                    console.warn("Supabase compliance responses save failed:", error.message);
                    showToast("Cloud sync failed — saved locally.", "warning");
                }
            } catch (err) {
                console.error("Supabase compliance upsert error or timeout:", err);
                showToast("Cloud sync timed out — saved locally.", "warning");
            }
        }
    }
    
    showToast("Compliance questionnaire progress saved to draft.", "success");
    renderComplianceQuestionnaires();
}

async function submitComplianceQuestionnaire() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    showModal("Confirm Compliance Submission", "Are you sure you want to finalize and submit the compliance questionnaire? This will lock edits for this section.", [
        { label: 'Cancel', class: 'btn-outline' },
        {
            label: 'Finalize & Submit',
            class: 'btn-primary',
            action: async () => {
                showToast("Submitting compliance evaluation...", "info");
                
                await saveComplianceQuestionnaireDraft();
                
                if (_supabase) {
                    try {
                        const { error } = await withTimeout(_supabase
                            .from('projects')
                            .update({ compliance_submitted: true })
                            .eq('id', proj.id), 2500);
                        if (error) throw error;
                    } catch (e) {
                        console.warn("Failed to submit status online or timed out:", e.message);
                    }
                }
                
                proj.complianceSubmitted = true;
                State.saveState();
                
                addActivity(`Finalized and submitted framework compliance questionnaires (Case ID: ${proj.id})`);
                showToast("Compliance questionnaire submitted successfully.", "success");
                
                // Jump to Step 6 Auditor Review
                handleStepNavigation(6);
            }
        }
    ]);
}

/* ──────────────────────────────────────────────
   18. STEP 6: AUDITOR CONCLUSION & REPORT GENERATION
   ────────────────────────────────────────────── */
function renderAuditorConclusionView() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    const isAuditor = State.currentUser.role === 'auditor';
    
    document.getElementById("rev-case-id").textContent = proj.id;
    
    // Populate Conclusion Notes
    const conclusionField = document.getElementById("rev-auditor-notes");
    if (conclusionField) {
        conclusionField.value = proj.auditeeProfile?.auditorNotes || "";
        conclusionField.disabled = !isAuditor || proj.status === 'Reviewed';
    }
    
    // Enable/disable concludes
    const saveNotesBtn = document.getElementById("btn-save-notes");
    if (saveNotesBtn) saveNotesBtn.disabled = !isAuditor || proj.status === 'Reviewed';
    
    const genReportBtn = document.getElementById("btn-rev-generate-report");
    if (genReportBtn) genReportBtn.disabled = !isAuditor;
    
    // Count stats for boxes
    let azAnswered = 0;
    let compAnswered = 0;
    
    // Count AZ answered
    AZ_QUESTIONS.forEach(section => {
        section.questions.forEach(q => {
            const ans = proj.azAnswers[q.id];
            if (ans && ans.value !== 'unanswered') azAnswered++;
        });
    });
    
    // Count Compliance answered
    let compTotal = 0;
    COMPLIANCE_QUESTIONS.forEach(section => {
        const isSelected = proj.frameworks.some(f => section.section.includes(f));
        if (!isSelected) return;
        compTotal += section.questions.length;
        section.questions.forEach(q => {
            const ans = proj.complianceAnswers[q.id];
            if (ans && ans.value !== 'unanswered') compAnswered++;
        });
    });
    
    // Write to the correct element IDs from the HTML
    const azStatsEl = document.getElementById("rev-az-stats");
    if (azStatsEl) azStatsEl.textContent = `${azAnswered} / 78`;
    
    const compStatsEl = document.getElementById("rev-comp-stats");
    if (compStatsEl) compStatsEl.textContent = `${compAnswered} / ${compTotal}`;
    
    const docsCountEl = document.getElementById("rev-docs-count");
    if (docsCountEl) docsCountEl.textContent = (proj.documents || []).length;
}

$('#btn-save-notes').addEventListener('click', async () => {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    const notes = document.getElementById("rev-auditor-notes").value.trim();
    if (!proj.auditeeProfile) proj.auditeeProfile = {};
    proj.auditeeProfile.auditorNotes = notes;
    
    showToast("Saving conclusion notes...", "info");
    
    if (_supabase) {
        try {
            const { error } = await _supabase
                .from('projects')
                .update({ auditee_profile: proj.auditeeProfile })
                .eq('id', proj.id);
            if (error) throw error;
        } catch (e) {
            console.warn("Failed to sync auditor notes online:", e.message);
        }
    }
    
    State.saveState();
    showToast("Audit conclusion notes saved to draft.", "success");
});

$('#btn-rev-generate-report').addEventListener('click', () => {
    const proj = State.getActiveProject();
    if (proj) {
        generateAuditReport(proj);
    }
});

// Wizard conclusion step buttons
$('#btn-review-prev').addEventListener('click', () => {
    handleStepNavigation(5);
});

$('#btn-review-next').addEventListener('click', async () => {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    // Finalize audit and change status
    if (State.currentUser.role === 'auditor' && proj.status !== 'Reviewed' && proj.status !== 'Completed') {
        showModal("Finalize Audit Assessment", "Are you sure you want to finalize this audit? This will mark the project as Reviewed and notify the auditee.", [
            { label: 'Cancel', class: 'btn-outline' },
            {
                label: 'Finalize Assessment',
                class: 'btn-primary',
                action: async () => {
                    showToast("Finalizing audit...", "info");
                    
                    if (_supabase) {
                        try {
                            const { error } = await _supabase
                                .from('projects')
                                .update({ status: 'Reviewed' })
                                .eq('id', proj.id);
                            if (error) throw error;
                        } catch (e) {
                            console.warn("Failed to finalize status online:", e.message);
                        }
                    }
                    
                    proj.status = 'Reviewed';
                    State.saveState();
                    
                    addActivity(`Finalized audit review for project: ${proj.title} (Case ID: ${proj.id})`);
                    showToast("Audit finalized successfully.", "success");
                    
                    handleStepNavigation(7);
                }
            }
        ]);
    } else {
        handleStepNavigation(7);
    }
});

/* ──────────────────────────────────────────────
   19. STEP 7: PROJECT COMPLIANCE DASHBOARD
   ────────────────────────────────────────────── */
async function renderComplianceDashboardView() {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    document.getElementById("dash-project-title").textContent = `${proj.title} - Compliance`;
    document.getElementById("dash-case-id").textContent = proj.id;
    
    // Dynamic calculation of metrics
    let totalQuestions = 78;
    COMPLIANCE_QUESTIONS.forEach(section => {
        const isSelected = proj.frameworks.some(f => section.section.includes(f));
        if (isSelected) {
            totalQuestions += section.questions.length;
        }
    });
    
    let submittedCount = 0;
    let draftCount = 0;
    let unansweredCount = 0;
    
    // A-Z
    AZ_QUESTIONS.forEach(section => {
        section.questions.forEach(q => {
            const ans = proj.azAnswers[q.id] || { value: "unanswered" };
            if (proj.azSubmitted) {
                if (ans.value === 'pass' || ans.value === 'fail' || ans.value === 'na') submittedCount++;
                else unansweredCount++;
            } else {
                if (ans.value === 'pass' || ans.value === 'fail' || ans.value === 'na') draftCount++;
                else unansweredCount++;
            }
        });
    });
    
    // Compliance
    COMPLIANCE_QUESTIONS.forEach(section => {
        const isSelected = proj.frameworks.some(f => section.section.includes(f));
        if (!isSelected) return;
        
        section.questions.forEach(q => {
            const ans = proj.complianceAnswers[q.id] || { value: "unanswered" };
            if (proj.complianceSubmitted) {
                if (ans.value === 'pass' || ans.value === 'fail' || ans.value === 'na') submittedCount++;
                else unansweredCount++;
            } else {
                if (ans.value === 'pass' || ans.value === 'fail' || ans.value === 'na') draftCount++;
                else unansweredCount++;
            }
        });
    });
    
    document.getElementById("dash-total-questions").textContent = totalQuestions;
    document.getElementById("dash-submitted-questions").textContent = submittedCount;
    document.getElementById("dash-draft-questions").textContent = draftCount;
    document.getElementById("dash-unanswered-questions").textContent = unansweredCount;
    
    // Action Buttons
    const actionsBox = document.getElementById("dash-action-buttons");
    if (actionsBox) {
        let buttonsHtml = `
            <button class="btn btn-secondary" onclick="handleStepNavigation(1)" style="margin-right:0.5rem;">View Project Details</button>
        `;
        
        if (State.currentUser.role === 'auditor' && proj.status !== 'Reviewed') {
            buttonsHtml += `
                <button class="btn btn-primary" onclick="handleStepNavigation(4)" style="margin-right:0.5rem;">Modify Assessment</button>
            `;
        }
        
        // Generate Report Button
        if (State.currentUser.role === 'auditor') {
            buttonsHtml += `
                <button class="btn btn-success" id="btn-dash-gen-report" style="margin-right:0.5rem;">Generate Report</button>
            `;
        }
        
        actionsBox.innerHTML = buttonsHtml;
        
        // Bind reports download triggers
        const dashGenBtn = document.getElementById("btn-dash-gen-report");
        if (dashGenBtn) {
            dashGenBtn.onclick = () => generateAuditReport(proj);
        }
    }
    
    // Bottom actions (Delete Project)
    const bottomBox = document.getElementById("dash-bottom-actions");
    if (bottomBox) {
        const isDeleteArmed = deleteConfirmationProjectId === proj.id;
        bottomBox.innerHTML = `
            <button class="btn btn-danger" onclick="deleteActiveProjectRequest('${proj.id}')">
                ${isDeleteArmed ? 'Confirm Delete Project' : 'Delete Project'}
            </button>
        `;
    }
}

async function deleteActiveProjectRequest(projectId) {
    if (deleteConfirmationProjectId === projectId) {
        showToast("Deleting project...", "info");
        
        if (_supabase && !projectId.startsWith('local-')) {
            try {
                // Delete responses
                await _supabase.from('responses').delete().eq('project_id', projectId);
                // Delete reports
                await _supabase.from('reports').delete().eq('project_id', projectId);
                // Delete documents
                await _supabase.from('documents').delete().eq('project_id', projectId);
                // Delete project
                const { error } = await _supabase.from('projects').delete().eq('id', projectId);
                if (error) throw error;
            } catch (e) {
                console.warn("Supabase project deletion failed:", e.message);
            }
        }
        
        State.projects = State.projects.filter(p => p.id !== projectId);
        State.activeProjectId = null;
        State.saveState();
        
        addActivity(`Deleted project with Case ID: ${projectId}`);
        showToast("Project deleted successfully.", "success");
        
        deleteConfirmationProjectId = null;
        await syncWithSupabase();
        navigateTo("projects");
    } else {
        deleteConfirmationProjectId = projectId;
        renderComplianceDashboardView();
        showToast("Click 'Confirm Delete Project' to permanently remove this case.", "warning");
        
        setTimeout(() => {
            if (deleteConfirmationProjectId === projectId) {
                deleteConfirmationProjectId = null;
                renderComplianceDashboardView();
            }
        }, 5000);
    }
}
window.deleteActiveProjectRequest = deleteActiveProjectRequest;

/* ──────────────────────────────────────────────
   20. PRIVATE DOCUMENT VAULT (page-vault)
   ────────────────────────────────────────────── */
function renderVault() {
    const tbody = $('#vault-table-body');
    if (!tbody) return;
    
    const docs = State.getPrivateDocumentsForUser();
    const search = $('#vault-search-input').value.toLowerCase().trim();
    const filterType = $('#vault-filter-type').value;
    const filterFw = $('#vault-filter-framework').value;
    const sortBy = $('#vault-sort').value;
    
    let filtered = docs.filter(d => {
        const matchesSearch = d.name.toLowerCase().includes(search);
        
        // Type filter
        const ext = d.name.split('.').pop().toLowerCase();
        let type = 'other';
        if (ext === 'pdf') type = 'pdf';
        else if (ext === 'docx' || ext === 'doc') type = 'docx';
        else if (ext === 'xlsx' || ext === 'xls') type = 'xlsx';
        else if (['png', 'jpg', 'jpeg'].includes(ext)) type = 'image';
        
        const matchesType = filterType === 'all' || type === filterType;
        
        // Framework filter
        const matchesFw = filterFw === 'all' || d.framework.toLowerCase().includes(filterFw.replace('-act', '').replace('-rmf', ''));
        
        return matchesSearch && matchesType && matchesFw;
    });
    
    // Sort
    if (sortBy === 'name-asc') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
        filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'date-asc') {
        filtered.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    } else {
        // date-desc default
        filtered.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-tertiary);padding:48px 0;">No documents found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map((d, index) => `
        <tr>
            <td><input type="checkbox" class="checkbox-input vault-check" data-id="${d.id}"></td>
            <td><div class="vault-file-name"><div class="vault-file-icon">${d.name.split('.').pop().toUpperCase().slice(0, 3)}</div>${d.name}</div></td>
            <td>${d.name.split('.').pop().toUpperCase()}</td>
            <td><span class="badge badge-framework">${d.framework}</span></td>
            <td>${d.size}</td>
            <td>${d.timestamp || 'Recent'}</td>
            <td><div class="vault-actions">
                <button class="vault-action-btn vault-download" data-id="${d.id}" data-idx="${index}" title="Download"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                <button class="vault-action-btn delete vault-delete" data-id="${d.id}" data-idx="${index}" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
            </div></td>
        </tr>
    `).join('');
    
    // Bind Actions
    tbody.querySelectorAll('.vault-download').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            downloadPrivateFile(idx);
        });
    });
    
    tbody.querySelectorAll('.vault-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            deletePrivateFile(idx);
        });
    });
}

async function downloadPrivateFile(index) {
    const docs = State.getPrivateDocumentsForUser();
    const doc = docs[index];
    if (!doc) return;
    
    showToast(`Downloading file "${doc.name}"...`, "info");
    
    if (_supabase && doc.storage_path) {
        try {
            const { data, error } = await _supabase.storage
                .from('project-documents')
                .download(doc.storage_path);
            if (error) throw error;
            
            const url = URL.createObjectURL(data);
            triggerFileDownload(url, doc.name);
            return;
        } catch (err) {
            console.warn("Supabase download failed:", err);
        }
    }
    
    showToast("Local file downloads are mock simulations.", "warning");
}

async function deletePrivateFile(index) {
    const docs = State.getPrivateDocumentsForUser();
    const doc = docs[index];
    if (!doc) return;
    
    showModal("Delete Document", `Are you sure you want to delete "${doc.name}" from your vault?`, [
        { label: 'Cancel', class: 'btn-outline' },
        {
            label: 'Delete',
            class: 'btn-danger',
            action: async () => {
                showToast("Deleting document...", "info");
                
                if (_supabase && doc.storage_path && !String(doc.id).startsWith('local-')) {
                    try {
                        if (doc.id) {
                            await _supabase.from('documents').delete().eq('id', doc.id);
                        }
                        await _supabase.storage.from('project-documents').remove([doc.storage_path]);
                    } catch (e) {
                        console.warn("Supabase document delete exception:", e);
                    }
                }
                
                State.removePrivateDocumentForCurrentUser(doc.id);
                showToast("Document deleted.", "success");
                
                await syncWithSupabase();
                renderVault();
            }
        }
    ]);
}

$('#vault-search-input').addEventListener('input', renderVault);
$('#vault-filter-type').addEventListener('change', renderVault);
$('#vault-filter-framework').addEventListener('change', renderVault);
$('#vault-sort').addEventListener('change', renderVault);
$('#vault-select-all').addEventListener('change', (e) => { 
    $$('.vault-check').forEach(cb => cb.checked = e.target.checked); 
});

// Vault Upload zone controls
const vaultUploadBtn = $('#vault-upload-btn');
const vaultUploadZone = $('#vault-upload-zone');
const vaultFileInput = $('#vault-file-input');

if (vaultUploadBtn && vaultUploadZone && vaultFileInput) {
    vaultUploadBtn.addEventListener('click', () => { 
        vaultUploadZone.classList.toggle('hidden'); 
    });
    vaultUploadZone.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        vaultUploadZone.querySelector('.upload-zone').classList.add('drag-over'); 
    });
    vaultUploadZone.addEventListener('dragleave', () => vaultUploadZone.querySelector('.upload-zone').classList.remove('drag-over'));
    vaultUploadZone.addEventListener('drop', (e) => { 
        e.preventDefault(); 
        vaultUploadZone.querySelector('.upload-zone').classList.remove('drag-over'); 
        handleVaultUpload(e.dataTransfer.files); 
    });
    vaultUploadZone.querySelector('.upload-zone').addEventListener('click', () => vaultFileInput.click());
    vaultFileInput.addEventListener('change', () => handleVaultUpload(vaultFileInput.files));
}

async function handleVaultUpload(fileList) {
    const tag = $('#vault-filter-framework').value === 'all' ? 'EU AI Act' : getFrameworkDbVal($('#vault-filter-framework').value);
    
    for (const f of Array.from(fileList)) {
        showToast(`Uploading "${f.name}" to private vault...`, "info");
        
        const uniqueFileName = `${Date.now()}_${f.name}`;
        const storagePath = `documents/${uniqueFileName}`;
        const docSize = (f.size / (1024 * 1024)).toFixed(1) + " MB";
        const timestamp = getLocalTimestamp();
        
        let uploadErr = null;
        let dbErr = null;

        if (_supabase) {
            try {
                const { error: err } = await _supabase.storage
                    .from('project-documents')
                    .upload(storagePath, f);
                uploadErr = err;
                    
                if (!uploadErr) {
                    const { error: err2 } = await _supabase
                        .from('documents')
                        .insert([{
                            project_id: null,
                            name: f.name,
                            framework: tag,
                            size: docSize,
                            storage_path: storagePath,
                            owner_email: State.currentUser.email,
                            timestamp: timestamp
                        }]);
                    dbErr = err2;
                
                    if (dbErr) {
                        await _supabase.storage.from('project-documents').remove([storagePath]);
                    }
                }
            } catch (e) {
                console.warn("Vault storage upload exception:", e);
            }
        }

        if (!_supabase || uploadErr || dbErr) {
            State.addPrivateDocumentForCurrentUser({
                id: 'local-' + Date.now() + Math.random(),
                project_id: null,
                name: f.name,
                framework: tag,
                size: docSize,
                storage_path: storagePath,
                owner_email: State.currentUser.email,
                timestamp: timestamp
            });
        }
        
        addActivity(`Uploaded document to vault: ${f.name}`);
    }
    
    showToast(`${fileList.length} document(s) uploaded to vault.`, 'success');
    vaultUploadZone.classList.add('hidden');
    await syncWithSupabase();
    renderVault();
}

/* ──────────────────────────────────────────────
   21. PROFILE PAGE (page-profile)
   ────────────────────────────────────────────── */
function renderProfilePage() {
    if (!State.currentUser) return;
    const u = State.currentUser;
    const container = $('#profile-details');
    if (!container) return;
    
    let details = [
        { label: 'Full Name', value: u.fullname },
        { label: 'Email', value: u.email },
        { label: 'Portal Access Role', value: u.role === 'auditor' ? 'Lead Compliance Auditor' : 'Auditee Client' },
        { label: 'Organization Name', value: u.org },
        { label: 'Designation', value: u.designation || 'Not specified' },
        { label: 'Mobile Number', value: u.mobile || 'Not specified' },
        { label: 'Onboarding Status', value: u.onboarded ? 'Completed' : 'Pending' }
    ];

    if (u.profile) {
        details.push({ label: '', value: '' }); /* separator spacer */
        details.push({ label: '── Onboarding Profile Details ──', value: '' });
        
        if (u.role === 'auditor') {
            if (u.profile.qualification) details.push({ label: 'Qualification', value: u.profile.qualification });
            if (u.profile.years) details.push({ label: 'Years of Experience', value: u.profile.years });
            if (u.profile.specialization) details.push({ label: 'Specialization', value: u.profile.specialization });
            if (u.profile.certificationId) details.push({ label: 'Certification ID', value: u.profile.certificationId });
            if (u.profile.bio) details.push({ label: 'Professional Bio', value: u.profile.bio });
            if (u.profile.certs && u.profile.certs.length) details.push({ label: 'Expertise Frameworks', value: u.profile.certs.join(', ') });
        } else {
            if (u.profile.orgName) details.push({ label: 'Entity Name', value: u.profile.orgName });
            if (u.profile.orgType) details.push({ label: 'Entity Type', value: u.profile.orgType });
            if (u.profile.industry) details.push({ label: 'Industry Sector', value: u.profile.industry });
            if (u.profile.size) details.push({ label: 'Employee Size', value: u.profile.size });
            if (u.profile.aiSystems) details.push({ label: 'AI Systems Running', value: u.profile.aiSystems });
            if (u.profile.aiDomains) details.push({ label: 'AI Scope Domains', value: u.profile.aiDomains });
            if (u.profile.pocName) details.push({ label: 'Primary Contact', value: u.profile.pocName });
            if (u.profile.pocEmail) details.push({ label: 'Contact Email', value: u.profile.pocEmail });
            if (u.profile.pocPhone) details.push({ label: 'Contact Phone', value: u.profile.pocPhone });
        }
    }

    container.innerHTML = details.map(d => {
        if (!d.label && !d.value) return '<div style="grid-column:1/-1;height:8px"></div>';
        if (!d.value) return `<div class="profile-detail-item" style="grid-column:1/-1;margin-top:10px;"><span class="profile-detail-label" style="color:var(--brand);text-transform:none;font-weight:700;font-size:14px;letter-spacing:0">${d.label}</span></div>`;
        return `<div class="profile-detail-item"><span class="profile-detail-label">${d.label}</span><span class="profile-detail-value">${d.value}</span></div>`;
    }).join('');
}

// Edit Profile Trigger
const profileEditBtn = $('#profile-edit-btn');
if (profileEditBtn) {
    profileEditBtn.addEventListener('click', () => {
        if (State.currentUser) {
            showView(State.currentUser.role === 'auditor' ? 'onboarding-auditor' : 'onboarding-auditee');
        }
    });
}

/* ──────────────────────────────────────────────
   22. AUTOSAVE INDICATOR & SIMULATORS
   ────────────────────────────────────────────── */
let autosaveTimeout = null;
function triggerAutosaveIndicator() {
    const indicator = $('#autosave-indicator');
    if (!indicator) return;
    indicator.classList.add('visible', 'saving');
    indicator.querySelector('.autosave-text').textContent = 'Saving...';
    clearTimeout(autosaveTimeout);
    
    autosaveTimeout = setTimeout(() => {
        indicator.classList.remove('saving');
        indicator.querySelector('.autosave-text').textContent = 'All changes saved';
        setTimeout(() => indicator.classList.remove('visible'), 2000);
    }, 1200);
}

// Global search bar warning placeholder
$('#global-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) showToast(`Search for "${query}" - search features are currently localized to pages.`, 'info');
    }
});

// Notifications modal trigger
$('#header-notifications').addEventListener('click', () => {
    const notifContent = State.activities.length > 0
        ? State.activities.slice(0, 5).map(a => `<div class="activity-item"><span class="activity-dot"></span><div class="activity-content"><p class="activity-text">${a.text}</p><span class="activity-time">${a.time}</span></div></div>`).join('')
        : '<p style="color:var(--text-tertiary);text-align:center;padding:24px;">No notifications yet.</p>';
    showModal('System Notifications Log', `<div style="display:flex;flex-direction:column;gap:12px;">${notifContent}</div>`, [
        { label: 'Close', class: 'btn-outline' }
    ]);
});

// Sidebar menu router click binding
$('#sidebar-menu').addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-link[data-page]');
    if (link) { 
        e.preventDefault(); 
        navigateTo(link.getAttribute('data-page')); 
    }
});

document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-page]');
    if (link && !link.classList.contains('sidebar-link') && !link.classList.contains('user-dropdown-item')) {
        e.preventDefault(); 
        navigateTo(link.getAttribute('data-page'));
    }
});

// Keyboard shortcuts (Escape key closes modals)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { 
        closeModal(); 
        $('#user-dropdown').classList.add('hidden'); 
    }
});

/* ──────────────────────────────────────────────
   23. AUDITEE LINKING SEARCH WIDGET (Auditors only)
   ────────────────────────────────────────────── */
const auditeeSearchInput = document.getElementById("auditee-search-input");
if (auditeeSearchInput) {
    auditeeSearchInput.addEventListener("input", handleAuditeeSearch);
}

async function handleAuditeeSearch() {
    const q = auditeeSearchInput.value.toLowerCase().trim();
    const resultsBox = document.getElementById("auditee-search-results");
    
    if (!q) {
        resultsBox.innerHTML = "";
        resultsBox.style.display = "none";
        return;
    }
    
    // Search default users with auditee role
    let auditeeUsers = State.users.filter(u => u.role === "auditee");
    
    if (_supabase) {
        try {
            const { data, error } = await _supabase
                .from('users')
                .select('*')
                .eq('role', 'auditee')
                .ilike('fullname', `%${q}%`);
            if (!error && data) {
                // Merge lists
                data.forEach(dbU => {
                    if (!auditeeUsers.some(u => u.email === dbU.email)) {
                        auditeeUsers.push(dbU);
                    }
                });
            }
        } catch (e) {
            console.warn("Could not query auditees online:", e);
        }
    }
    
    const matched = auditeeUsers.filter(u => 
        u.fullname.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q) || 
        u.org.toLowerCase().includes(q)
    );
    
    if (matched.length === 0) {
        resultsBox.innerHTML = `<div style="padding:10px; font-size:var(--caption); color:var(--text-tertiary); text-align:center;">No auditees found.</div>`;
    } else {
        resultsBox.innerHTML = matched.map(u => `
            <div class="search-result-item" onclick="selectAuditeeToLink('${u.fullname.replace(/'/g, "\\'")}', '${u.email}', '${u.designation.replace(/'/g, "\\'")}', '${u.org.replace(/'/g, "\\'")}')" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border); font-size:var(--caption); transition: background 0.2s;">
                <div style="font-weight:600; color:var(--text-primary);">${u.fullname}</div>
                <div style="color:var(--text-secondary); font-size:10px;">${u.email} &middot; ${u.org}</div>
            </div>
        `).join('');
    }
    resultsBox.style.display = "block";
}
window.handleAuditeeSearch = handleAuditeeSearch;

async function selectAuditeeToLink(fullname, email, designation, org) {
    const proj = State.getActiveProject();
    if (!proj) return;
    
    showModal("Link Auditee Representative", `Are you sure you want to assign <strong>${fullname}</strong> (${org}) as the auditee client for this project?`, [
        { label: 'Cancel', class: 'btn-outline' },
        {
            label: 'Link Client',
            class: 'btn-primary',
            action: async () => {
                showToast("Linking auditee...", "info");
                
                const auditeeProfile = {
                    designation: designation || "Technology Director",
                    profExp: 10,
                    aiExp: 5,
                    certs: "PMP, AWS Certified ML Specialty"
                };
                
                proj.auditeeEmail = email;
                proj.auditeeProfile = auditeeProfile;
                
                if (_supabase) {
                    try {
                        const { error } = await _supabase
                            .from('projects')
                            .update({
                                auditee_email: email,
                                auditee_profile: auditeeProfile
                            })
                            .eq('id', proj.id);
                        if (error) throw error;
                    } catch (e) {
                        console.warn("Failed to sync auditee link online:", e.message);
                    }
                }
                
                State.saveState();
                
                addActivity(`Linked auditee ${fullname} (${email}) to Case ID: ${proj.id}`);
                showToast("Auditee client linked successfully.", "success");
                
                // Clear input
                auditeeSearchInput.value = "";
                document.getElementById("auditee-search-results").style.display = "none";
                
                // Sync and reload
                await syncWithSupabase();
                goToProjectStep(State.currentProjectStep || 1);
            }
        }
    ]);
}
window.selectAuditeeToLink = selectAuditeeToLink;

function renderUserBadge() {
    updateUserDisplay();
}
window.renderUserBadge = renderUserBadge;

/* ──────────────────────────────────────────────
   24. MAIN ROUTE INITIALIZER
   ────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
    // Apply localStorage framework overrides if present
    applyFrameworkOverrides();

    // Show loading / auth view immediately
    showView("auth-section");
    
    // Initialize Supabase client
    await initSupabase();
    
    // If Supabase fails to initialize, restore localStorage session to support offline usage
    if (!_supabase && State.currentUser) {
        console.warn("Offline fallback mode: restoring local session");
        showView("app-shell");
    }
    
    // Initial UI bindings
    initNewProject();
});


// ==========================================================================
// FRAMEWORK MANAGER — Dynamic Question Management
// ==========================================================================

let _fwPreviewData = null;
const _AZ_DEFAULTS = JSON.parse(JSON.stringify(AZ_QUESTIONS));
const _COMP_DEFAULTS = JSON.parse(JSON.stringify(COMPLIANCE_QUESTIONS));

function applyFrameworkOverrides() {
    try {
        const azOverride = localStorage.getItem('AZ_QUESTIONS_OVERRIDE');
        if (azOverride) {
            const parsed = JSON.parse(azOverride);
            if (Array.isArray(parsed) && parsed.length > 0) {
                AZ_QUESTIONS.length = 0;
                parsed.forEach(s => AZ_QUESTIONS.push(s));
                console.log('[Framework] AZ_QUESTIONS overridden from localStorage, sections:', AZ_QUESTIONS.length);
            }
        }
    } catch (e) { console.warn('[Framework] Failed to apply AZ override:', e); }

    try {
        const compOverride = localStorage.getItem('COMPLIANCE_QUESTIONS_OVERRIDE');
        if (compOverride) {
            const parsed = JSON.parse(compOverride);
            if (Array.isArray(parsed) && parsed.length > 0) {
                COMPLIANCE_QUESTIONS.length = 0;
                parsed.forEach(s => COMPLIANCE_QUESTIONS.push(s));
                console.log('[Framework] COMPLIANCE_QUESTIONS overridden from localStorage, sections:', COMPLIANCE_QUESTIONS.length);
            }
        }
    } catch (e) { console.warn('[Framework] Failed to apply Compliance override:', e); }
}

function renderFrameworkManagerView() {
    renderFwAZTab();
}

function renderFwAZTab() {
    document.getElementById("fw-tab-az").classList.add("active");
    document.getElementById("fw-tab-comp").classList.remove("active");
    document.getElementById("fw-panel-az").style.display = "block";
    document.getElementById("fw-panel-comp").style.display = "none";
    renderFwQuestionList("az");
}

function renderFwCompTab() {
    document.getElementById("fw-tab-comp").classList.add("active");
    document.getElementById("fw-tab-az").classList.remove("active");
    document.getElementById("fw-panel-comp").style.display = "block";
    document.getElementById("fw-panel-az").style.display = "none";
    renderFwQuestionList("comp");
}

function renderFwQuestionList(type) {
    const containerId = type === "az" ? "fw-az-questions-list" : "fw-comp-questions-list";
    const container = document.getElementById(containerId);
    if (!container) return;

    const questions = type === "az" ? AZ_QUESTIONS : COMPLIANCE_QUESTIONS;
    let html = "";

    questions.forEach((section, sIdx) => {
        const sectionTitle = type === "az"
            ? `Section ${section.letter} — ${section.title}`
            : section.section;
        const sectionKey = type === "az" ? section.letter : `comp-${sIdx}`;

        html += `
        <div class="fw-section" id="fw-section-${type}-${sectionKey}" style="margin-bottom: 1.5rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden;">
            <div class="fw-section-header" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: rgba(255,255,255,0.04); border-bottom: 1px solid var(--border-color);">
                <span class="fw-section-title" style="font-weight: 700; font-size: 0.9rem; color: var(--accent-yellow); letter-spacing: 0.03em;">${sectionTitle}</span>
                <button class="btn btn-sm btn-primary" onclick="fwAddQuestion('${type}', ${sIdx})" title="Add Question">
                    + Add Question
                </button>
            </div>
            <div class="fw-questions" id="fw-qs-${type}-${sIdx}" style="padding: 0.5rem;">
        `;

        section.questions.forEach((q, qIdx) => {
            html += `
            <div class="fw-question-row" id="fw-qrow-${q.id}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-radius: var(--radius-md); transition: background 0.15s;">
                <span class="fw-q-id" style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); white-space: nowrap; min-width: 80px; font-family: monospace;">${q.id}</span>
                <input class="fw-q-text form-input" id="fw-qtxt-${q.id}" type="text" value="${q.text.replace(/"/g, '&quot;')}" style="flex: 1; font-size: 0.875rem; padding: 0.4rem 0.6rem;" />
                <div class="fw-q-actions" style="display: flex; gap: 0.4rem; flex-shrink: 0;">
                    <button class="btn btn-sm btn-secondary" onclick="fwSaveQuestion('${type}', ${sIdx}, ${qIdx}, '${q.id}')">💾 Save</button>
                    <button class="btn btn-sm btn-danger" onclick="fwDeleteQuestion('${type}', ${sIdx}, ${qIdx})">🗑️</button>
                </div>
            </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

function fwSaveQuestion(type, sIdx, qIdx, qId) {
    const inputEl = document.getElementById(`fw-qtxt-${qId}`);
    if (!inputEl) return;
    const newText = inputEl.value.trim();
    if (!newText) { showToast("Question text cannot be empty.", "warning"); return; }

    const arr = type === "az" ? AZ_QUESTIONS : COMPLIANCE_QUESTIONS;
    arr[sIdx].questions[qIdx].text = newText;
    fwPersistOverride(type);
    showToast("Question updated.", "success");
}

function fwDeleteQuestion(type, sIdx, qIdx) {
    const arr = type === "az" ? AZ_QUESTIONS : COMPLIANCE_QUESTIONS;
    const section = arr[sIdx];
    if (!section) return;
    const removed = section.questions.splice(qIdx, 1);
    fwPersistOverride(type);
    renderFwQuestionList(type);
    showToast(`Deleted question ${removed[0]?.id || ""}.`, "success");
}

function fwAddQuestion(type, sIdx) {
    const arr = type === "az" ? AZ_QUESTIONS : COMPLIANCE_QUESTIONS;
    const section = arr[sIdx];
    if (!section) return;

    const prefix = type === "az"
        ? `AZ-${section.letter}`
        : (section.prefix || `COMP-${sIdx}`);
    const nextNum = section.questions.length + 1;
    const newId = `${prefix}-${nextNum}`;

    section.questions.push({ id: newId, text: "New compliance question?" });
    fwPersistOverride(type);
    renderFwQuestionList(type);
    showToast(`Added new question ${newId}. Edit the text above.`, "info");

    setTimeout(() => {
        const el = document.getElementById(`fw-qtxt-${newId}`);
        if (el) { el.select(); el.focus(); }
    }, 100);
}

function fwPersistOverride(type) {
    try {
        if (type === "az") {
            localStorage.setItem("AZ_QUESTIONS_OVERRIDE", JSON.stringify(AZ_QUESTIONS));
        } else {
            localStorage.setItem("COMPLIANCE_QUESTIONS_OVERRIDE", JSON.stringify(COMPLIANCE_QUESTIONS));
        }
    } catch (e) {
        console.warn("[Framework] Could not persist to localStorage:", e);
    }
}

function fwResetToDefaults(type) {
    if (!confirm(`Reset all ${type === "az" ? "A-Z" : "Compliance"} questions to factory defaults? This cannot be undone.`)) return;

    if (type === "az") {
        AZ_QUESTIONS.length = 0;
        JSON.parse(JSON.stringify(_AZ_DEFAULTS)).forEach(s => AZ_QUESTIONS.push(s));
        localStorage.removeItem("AZ_QUESTIONS_OVERRIDE");
    } else {
        COMPLIANCE_QUESTIONS.length = 0;
        JSON.parse(JSON.stringify(_COMP_DEFAULTS)).forEach(s => COMPLIANCE_QUESTIONS.push(s));
        localStorage.removeItem("COMPLIANCE_QUESTIONS_OVERRIDE");
    }

    renderFwQuestionList(type);
    showToast(`${type === "az" ? "A-Z" : "Compliance"} framework reset to defaults.`, "success");
}

async function fwUploadAndAnalyze(type) {
    const fileInput = document.getElementById(`fw-pdf-input-${type}`);
    const sectionSelect = document.getElementById(`fw-section-hint-${type}`);
    const statusEl = document.getElementById(`fw-analyze-status-${type}`);
    const previewEl = document.getElementById(`fw-preview-${type}`);

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast("Please select a PDF file first.", "warning");
        return;
    }

    const file = fileInput.files[0];
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
        showToast("Only PDF files are supported.", "warning");
        return;
    }

    const sectionHint = sectionSelect ? sectionSelect.value : "auto";

    statusEl.innerHTML = `<div class="fw-status-loading">⏳ Extracting PDF text and calling Gemini AI... (may take 20-40 seconds)</div>`;
    previewEl.innerHTML = "";

    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    try {
        const response = await fetch("/api/analyze-framework", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pdfBase64: base64,
                frameworkType: type,
                sectionHint: sectionHint
            })
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            statusEl.innerHTML = `<div class="fw-status-error" style="color:var(--danger);">❌ ${result.error || "Server error"}</div>`;
            return;
        }

        _fwPreviewData = { type, data: result };
        renderFwPreview(type, result, previewEl);
        statusEl.innerHTML = `<div class="fw-status-success" style="color:#4ade80;">✅ Gemini extracted ${result.sections?.length || 0} section(s). Review below and click Apply.</div>`;

    } catch (err) {
        statusEl.innerHTML = `<div class="fw-status-error" style="color:var(--danger);">❌ Network error: ${err.message}</div>`;
    }
}

function renderFwPreview(type, data, container) {
    if (!data.sections || data.sections.length === 0) {
        container.innerHTML = "<p style='color:var(--text-muted);'>No sections returned by AI.</p>";
        return;
    }

    let html = `<div class="fw-preview-header" style="margin-bottom:1rem;">
        <h4 style="color:var(--accent-yellow);">🤖 AI-Generated Questions Preview</h4>
        <p style="color:var(--text-muted);font-size:0.85rem;">Review the questions below, then click <strong>Apply to Framework</strong> to merge them in.</p>
    </div>`;

    data.sections.forEach((section, sIdx) => {
        const title = type === "az"
            ? `Section ${section.letter} — ${section.title}`
            : section.section;

        html += `<div class="fw-preview-section" style="background: rgba(255,200,0,0.04); border: 1px solid rgba(255,200,0,0.2); border-radius: var(--radius-lg); margin-bottom: 1rem; overflow: hidden;">
            <div class="fw-preview-section-title" style="font-weight:700;font-size:0.85rem;color:var(--accent-yellow);padding:0.6rem 1rem;background:rgba(255,200,0,0.07);border-bottom:1px solid rgba(255,200,0,0.15);">${title}</div>
            <div class="fw-preview-qs" style="padding:0.5rem;">`;

        (section.questions || []).forEach((q, qIdx) => {
            html += `<div class="fw-preview-q-row" style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.5rem;">
                <span class="fw-q-id" style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); white-space: nowrap; min-width: 80px; font-family: monospace;">${q.id}</span>
                <input class="fw-q-text form-input" id="fwprev-${sIdx}-${qIdx}" type="text" value="${q.text.replace(/"/g, '&quot;')}" style="flex:1;font-size:0.875rem;padding:0.4rem 0.6rem;" />
                <button class="btn btn-sm btn-danger fw-del-preview" onclick="fwDeletePreviewQuestion(${sIdx}, ${qIdx}, '${type}')">🗑️</button>
            </div>`;
        });

        html += `</div></div>`;
    });

    html += `<div style="margin-top:1.5rem;display:flex;gap:1rem;flex-wrap:wrap;">
        <button class="btn btn-success" onclick="fwApplyPreview('${type}')">✅ Apply to Framework</button>
        <button class="btn btn-secondary" onclick="fwClearPreview('${type}')">✖ Discard</button>
    </div>`;

    container.innerHTML = html;
}

function fwDeletePreviewQuestion(sIdx, qIdx, type) {
    if (!_fwPreviewData) return;
    _fwPreviewData.data.sections[sIdx].questions.splice(qIdx, 1);
    const previewEl = document.getElementById(`fw-preview-${type}`);
    renderFwPreview(type, _fwPreviewData.data, previewEl);
}

function fwApplyPreview(type) {
    if (!_fwPreviewData || !_fwPreviewData.data.sections) return;

    const arr = type === "az" ? AZ_QUESTIONS : COMPLIANCE_QUESTIONS;

    _fwPreviewData.data.sections.forEach((previewSection, sIdx) => {
        const updatedQuestions = previewSection.questions.map((q, qIdx) => {
            const inputEl = document.getElementById(`fwprev-${sIdx}-${qIdx}`);
            return { id: q.id, text: inputEl ? inputEl.value.trim() : q.text };
        }).filter(q => q.text);

        if (type === "az") {
            const existingIdx = arr.findIndex(s => s.letter === previewSection.letter);
            if (existingIdx >= 0) {
                updatedQuestions.forEach(newQ => {
                    const existing = arr[existingIdx].questions.find(eq => eq.id === newQ.id);
                    if (existing) {
                        existing.text = newQ.text;
                    } else {
                        arr[existingIdx].questions.push(newQ);
                    }
                });
            } else {
                arr.push({ letter: previewSection.letter, title: previewSection.title, questions: updatedQuestions });
            }
        } else {
            const existingIdx = arr.findIndex(s => s.section === previewSection.section);
            if (existingIdx >= 0) {
                updatedQuestions.forEach(newQ => {
                    const existing = arr[existingIdx].questions.find(eq => eq.id === newQ.id);
                    if (existing) {
                        existing.text = newQ.text;
                    } else {
                        arr[existingIdx].questions.push(newQ);
                    }
                });
            } else {
                arr.push({ section: previewSection.section, prefix: previewSection.prefix, questions: updatedQuestions });
            }
        }
    });

    fwPersistOverride(type);
    renderFwQuestionList(type);

    const previewEl = document.getElementById(`fw-preview-${type}`);
    if (previewEl) previewEl.innerHTML = "";
    const statusEl = document.getElementById(`fw-analyze-status-${type}`);
    if (statusEl) statusEl.innerHTML = "";

    _fwPreviewData = null;
    showToast("Questions applied to framework successfully!", "success");
}

function fwClearPreview(type) {
    _fwPreviewData = null;
    const previewEl = document.getElementById(`fw-preview-${type}`);
    if (previewEl) previewEl.innerHTML = "";
    const statusEl = document.getElementById(`fw-analyze-status-${type}`);
    if (statusEl) statusEl.innerHTML = "";
}

// Bind to window to allow inline onclick calls to work
window.renderFwAZTab = renderFwAZTab;
window.renderFwCompTab = renderFwCompTab;
window.fwSaveQuestion = fwSaveQuestion;
window.fwDeleteQuestion = fwDeleteQuestion;
window.fwAddQuestion = fwAddQuestion;
window.fwResetToDefaults = fwResetToDefaults;
window.fwUploadAndAnalyze = fwUploadAndAnalyze;
window.fwDeletePreviewQuestion = fwDeletePreviewQuestion;
window.fwApplyPreview = fwApplyPreview;
window.fwClearPreview = fwClearPreview;
