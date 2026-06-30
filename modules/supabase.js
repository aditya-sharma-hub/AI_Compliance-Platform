// EY AI Compliance & Governance Platform - Supabase Integration Module

var _supabase = null;
window._supabase = null;
let selectedFileObject = null;
let detailSelectedFileObject = null;

async function initSupabase() {
    try {
        if (!window.supabase) {
            console.warn("Supabase JS library not available (CDN may have failed). Running in offline mode.");
            return;
        }

        // Hardcode config to bypass server.js fetch for direct deployment compat
        const config = {
            supabaseUrl: "https://kblhprlnluzusktimlmf.supabase.co",
            supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtibGhwcmxubHV6dXNrdGltbG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzM2ODAsImV4cCI6MjA5NzQwOTY4MH0.zj5_AyOI55ym-7CITVjr8ZA6LByFOIgEBOltuVNuPOM"
        };

        if (config.supabaseUrl && config.supabaseAnonKey) {
            _supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            window._supabase = _supabase;
            console.log("Supabase Client initialized successfully.");
            setupAuthListener();
        } else {
            console.error("Supabase config is missing url or key:", config);
            showToast("Supabase config is incomplete. Check initialization logic.", "error");
        }
    } catch (err) {
        console.error("Failed to initialize Supabase:", err);
        showToast("Cannot initialize Supabase.", "error");
    }
}

function setupAuthListener() {
    _supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth event:", event, session ? session.user?.email : 'null');

        if (session && session.user) {
            // Real Supabase session — fetch profile and navigate to app
            const { data: userProfile } = await _supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
                
            let isGoogleLogin = session.user.app_metadata?.provider === 'google';
            let assignedRole = session.user.user_metadata?.role;
            
            let isFreshGoogleLogin = (event === 'SIGNED_IN' && isGoogleLogin && !window.roleModalShown);
            let hasNoRoleYet = (isGoogleLogin && !userProfile && !assignedRole);

            let needsRoleSelection = false;
            if (isFreshGoogleLogin || hasNoRoleYet) {
                needsRoleSelection = true;
                window.roleModalShown = true;
            }

            if (userProfile) {
                State.currentUser = {
                    id: userProfile.id,
                    email: userProfile.email,
                    fullname: userProfile.fullname,
                    org: userProfile.org,
                    designation: userProfile.designation,
                    role: userProfile.role,
                    mobile: userProfile.mobile,
                    onboarded: userProfile.onboarded,
                    profile: userProfile.profile
                };
            } else {
                if (!assignedRole && !needsRoleSelection) {
                    assignedRole = "auditee";
                }
                State.currentUser = {
                    id: session.user.id,
                    email: session.user.email,
                    fullname: session.user.user_metadata?.fullname || session.user.user_metadata?.full_name || session.user.user_metadata?.name || "",
                    org: session.user.user_metadata?.org || "",
                    designation: session.user.user_metadata?.designation || "",
                    role: assignedRole || "auditee",
                    mobile: session.user.user_metadata?.mobile || "",
                    onboarded: false,
                    profile: null
                };
            }

            State.saveState();

            State.saveState();

            const proceedWithNavigation = () => {
                // FIX: Halt navigation if role is not selected yet
                if (State.currentUser.role === 'pending') return; 

                if (!State.currentUser.onboarded) {
                    showView(State.currentUser.role === "auditor" ? "onboarding-auditor" : "onboarding-auditee");
                } else {
                    // FIX: Ensure the app shell is visible and route to valid pages
                    showView("app-shell");
                    const dest = (State.activeView && State.activeView !== 'auth-section' && !State.activeView.startsWith('onboarding')) 
                        ? State.activeView 
                        : "dashboard"; 
                    navigateTo(dest, false);
                }
            };

            if (needsRoleSelection) {
                // Use the app's standard showModal/closeModal pattern instead of a non-existent global-alert-modal
                showModal("Select Your Role", `
                    <p style="margin-bottom: 1rem; color: var(--text-secondary);">Welcome! Please select your portal access role before continuing:</p>
                    <div style="display: flex; gap: 1.5rem; align-items: center; justify-content: center; margin: 1.5rem 0;">
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="radio" name="google-role" value="auditor" ${State.currentUser.role === 'auditor' ? 'checked' : ''} style="transform: scale(1.2);"> 
                            <span style="font-size: 1.1rem; color: var(--text-primary);">Auditor</span>
                        </label>
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="radio" name="google-role" value="auditee" ${State.currentUser.role === 'auditee' ? 'checked' : ''} style="transform: scale(1.2);"> 
                            <span style="font-size: 1.1rem; color: var(--text-primary);">Auditee</span>
                        </label>
                    </div>
                `, [
                    {
                        label: 'Continue',
                        class: 'btn-primary',
                        action: async () => {
                            const selectedRadio = document.querySelector('input[name="google-role"]:checked');
                            if (!selectedRadio) {
                                showToast("Please select a role before continuing.", "error");
                                return false; // keep modal open
                            }

                            const selectedRole = selectedRadio.value;
                            sessionStorage.setItem('ey_role_selected_this_session', 'true');
                            
                            const roleChanged = userProfile && userProfile.role !== selectedRole;

                            State.currentUser.role = selectedRole;
                            if (roleChanged) {
                                State.currentUser.onboarded = false;
                                State.currentUser.profile = null;
                            }
                            State.saveState();

                            proceedWithNavigation();

                            if (_supabase) {
                                try {
                                    await _supabase.auth.updateUser({ data: { role: selectedRole } });
                                    let dbResult;
                                    if (userProfile && roleChanged) {
                                        dbResult = await _supabase.from('users').update({ role: selectedRole, onboarded: false, profile: null }).eq('id', session.user.id);
                                    } else if (userProfile) {
                                        dbResult = await _supabase.from('users').update({ role: selectedRole }).eq('id', session.user.id);
                                    } else {
                                        dbResult = await _supabase.from('users').insert([{
                                            id: session.user.id,
                                            email: session.user.email,
                                            fullname: session.user.user_metadata?.fullname || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0],
                                            org: session.user.user_metadata?.org || "",
                                            designation: session.user.user_metadata?.designation || "",
                                            role: selectedRole,
                                            mobile: session.user.user_metadata?.mobile || "",
                                            onboarded: false,
                                            profile: null
                                        }]);
                                    }
                                    if (dbResult && dbResult.error) {
                                        console.error("Database user profile sync failed:", dbResult.error);
                                        showToast("Failed to sync profile to database: " + dbResult.error.message, "error");
                                    }
                                } catch (dbErr) {
                                    console.error("Error updating user metadata/profile:", dbErr);
                                    showToast("Profile database sync failed: " + dbErr.message, "error");
                                }
                            }
                        }
                    }
                ]);            } else {
                if (event !== 'USER_UPDATED') {
                    proceedWithNavigation();
                } else {
                    renderUserBadge(); // Just update UI softly
                }
            }

        } else {
            // No session — check if we have a local fallback user logged in
            if (State.currentUser && String(State.currentUser.id).startsWith('local-fallback-')) {
                console.log("Keeping local fallback user session:", State.currentUser.email);
                return;
            }
            
            // No session — clear any localStorage user
            State.currentUser = null;
            State.activeProjectId = null;
            State.saveState();

            // Always return to auth screen when there's no valid session
            showView("auth-section");
        }
    });
}

async function syncWithSupabase() {
    if (!_supabase || !State.currentUser) return;
    if (!State.currentUser.id || String(State.currentUser.id).startsWith('local-fallback-')) return; // Do not sync if local fallback
    
    try {
        // Sync user profile
        const { data: userProfile } = await _supabase
            .from('users')
            .select('*')
            .eq('id', State.currentUser.id)
            .single();
        if (!State.currentUser) return;
        if (userProfile) {
            State.currentUser.fullname = userProfile.fullname;
            State.currentUser.org = userProfile.org;
            State.currentUser.designation = userProfile.designation;
            State.currentUser.role = userProfile.role;
            State.currentUser.mobile = userProfile.mobile;
            State.currentUser.onboarded = userProfile.onboarded;
            State.currentUser.profile = userProfile.profile;
        }
        
        // Fetch Projects
        let query = _supabase.from('projects').select('*');
        if (!State.currentUser) return;
        if (State.currentUser.role === 'auditee') {
            query = query.eq('auditee_email', State.currentUser.email.toLowerCase().trim());
        }
        
        const { data: dbProjects, error: dbErr } = await query;
        if (dbErr) {
            console.warn("Failed to fetch projects from Supabase, keeping local state.", dbErr);
        } else if (dbProjects) {
            const projectsMapped = [];
            for (const p of dbProjects) {
                // Fetch documents
                const { data: docs } = await _supabase
                    .from('documents')
                    .select('*')
                    .eq('project_id', p.id);
                const documentsMapped = (docs || []).map(d => ({
                    id: d.id,
                    name: d.name,
                    framework: d.framework,
                    size: d.size,
                    storage_path: d.storage_path,
                    ownerEmail: d.owner_email,
                    timestamp: d.timestamp
                }));
                
                // Fetch responses
                const { data: resps } = await _supabase
                    .from('responses')
                    .select('*')
                    .eq('project_id', p.id);
                    
                const azAnswers = {};
                const complianceAnswers = {};
                (resps || []).forEach(r => {
                    if (r.question_id.startsWith('AZ-')) {
                        azAnswers[r.question_id] = { value: r.value, comment: r.comment };
                    } else if (r.question_id.startsWith('COMP-')) {
                        complianceAnswers[r.question_id] = { value: r.value, comment: r.comment };
                    }
                });
                
                const localProjects = State.projects || [];
                const localProj = localProjects.find(lp => lp.id === p.id);
                const isSubmitted = p.status === "Reviewed";
                
                const mergeAnswers = (local, db, submitted) => {
                    if (submitted) return { ...local, ...db };
                    const merged = { ...db };
                    for (const key in local) {
                        const localAns = local[key];
                        if (localAns) {
                            const localVal = localAns.value || 'unanswered';
                            const localCom = localAns.comment || '';
                            if (localVal !== 'unanswered' || localCom !== '') {
                                merged[key] = localAns;
                            }
                        }
                    }
                    return merged;
                };

                const finalAzAnswers = localProj ? mergeAnswers(localProj.azAnswers || {}, azAnswers, isSubmitted) : azAnswers;
                const finalComplianceAnswers = localProj ? mergeAnswers(localProj.complianceAnswers || {}, complianceAnswers, isSubmitted) : complianceAnswers;

                let auditeeProfile = p.auditee_profile;
                if (localProj && localProj.auditeeProfile) {
                    if (!auditeeProfile) {
                        auditeeProfile = localProj.auditeeProfile;
                    } else if (localProj.auditeeProfile.auditorNotes && !auditeeProfile.auditorNotes) {
                        auditeeProfile.auditorNotes = localProj.auditeeProfile.auditorNotes;
                    }
                }

                projectsMapped.push({
                    id: p.id,
                    title: p.title,
                    domain: p.domain,
                    desc: p.description,
                    frameworks: p.frameworks,
                    status: p.status,
                    auditeeEmail: p.auditee_email,
                    auditeeProfile: auditeeProfile,
                    auditorEmail: p.auditor_email,
                    documents: documentsMapped,
                    azAnswers: finalAzAnswers,
                    complianceAnswers: finalComplianceAnswers,
                    azSubmitted: p.az_submitted || (localProj ? localProj.azSubmitted : false),
                    complianceSubmitted: p.compliance_submitted || (localProj ? localProj.complianceSubmitted : false)
                });
            }
            
            const localProjects = State.projects || [];
            const mergedProjects = [...projectsMapped];
            
            for (const lp of localProjects) {
                if (!mergedProjects.some(mp => mp.id === lp.id)) {
                    mergedProjects.push(lp);
                }
            }
            State.projects = mergedProjects;
        }
        
        // Fetch Private Documents
        if (!State.currentUser) return;
        const { data: privateDocs } = await _supabase
            .from('documents')
            .select('*')
            .eq('owner_email', State.currentUser.email.toLowerCase().trim())
            .is('project_id', null);
            
        const docsMapped = (privateDocs || []).map(d => ({
            id: d.id,
            name: d.name,
            framework: d.framework,
            size: d.size,
            storage_path: d.storage_path,
            ownerEmail: d.owner_email,
            timestamp: d.timestamp
        }));
        
        const emailKey = State.currentUser.email.toLowerCase().trim();
        const localDocs = State.privateDocuments[emailKey] || [];
        const mergedDocs = [...docsMapped];
        for (const ld of localDocs) {
            if (!mergedDocs.some(md => md.name === ld.name)) {
                mergedDocs.push(ld);
            }
        }
        State.privateDocuments[emailKey] = mergedDocs;
        
    } catch (err) {
        console.error("Error in syncWithSupabase:", err);
    }
}
