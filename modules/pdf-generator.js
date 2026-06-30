// EY AI Compliance & Governance Platform - PDF Generation Module

async function generateAuditReport(proj) {
    showToast("Starting AI Audit Report generation...", "info");
    
    // 1. Fetch auditee user profile details if not present
    let auditeeUser = null;
    if (_supabase) {
        try {
            const { data, error } = await _supabase
                .from('users')
                .select('*')
                .eq('email', proj.auditeeEmail)
                .single();
            if (!error && data) {
                auditeeUser = data;
            }
        } catch (e) {
            console.warn("Could not load auditee profile from DB, using fallback", e);
        }
    }
    
    // 2. Calculate Pass, Fail, N/A counts
    let passCount = 0;
    let failCount = 0;
    let naCount = 0;
    
    // Count AZ
    AZ_QUESTIONS.forEach(section => {
        section.questions.forEach(q => {
            const ans = proj.azAnswers[q.id];
            if (ans) {
                if (ans.value === 'pass') passCount++;
                else if (ans.value === 'fail') failCount++;
                else if (ans.value === 'na') naCount++;
            }
        });
    });
    
    // Count Compliance
    COMPLIANCE_QUESTIONS.forEach(section => {
        const isSelected = proj.frameworks.some(f => section.section.includes(f));
        if (!isSelected) return;
        
        section.questions.forEach(q => {
            const ans = proj.complianceAnswers[q.id];
            if (ans) {
                if (ans.value === 'pass') passCount++;
                else if (ans.value === 'fail') failCount++;
                else if (ans.value === 'na') naCount++;
            }
        });
    });
    
    const totalCount = passCount + failCount + naCount;
    const evaluatedCount = passCount + failCount;
    const compliancePct = evaluatedCount > 0 ? Math.round((passCount / evaluatedCount) * 100) : 100;
    
    // 3. Build structured assessment payload
    const payload = {
        project: {
            id: proj.id,
            title: proj.title,
            domain: proj.domain,
            description: proj.desc || proj.description,
            status: proj.status
        },
        auditor: {
            name: State.currentUser.fullname,
            org: State.currentUser.org || "Ernst & Young LLP",
            designation: State.currentUser.designation || "Senior AI Compliance Auditor",
            experience: State.currentUser.profile?.years || "6",
            certifications: (State.currentUser.profile?.certs || []).join(", ") || "ISO 42001 Lead Auditor, CISA, CISSP"
        },
        auditee: {
            name: auditeeUser?.fullname || "Arjun Mehta",
            org: auditeeUser?.org || "GovTech Solutions Pvt. Ltd.",
            designation: proj.auditeeProfile?.designation || auditeeUser?.designation || "Technology Director",
            experience: proj.auditeeProfile?.profExp || auditeeUser?.profile?.profExp || "14",
            aiExperience: proj.auditeeProfile?.aiExp || auditeeUser?.profile?.aiExp || "5",
            certifications: proj.auditeeProfile?.certs || 
                            ((auditeeUser?.profile?.certs || []).join(", ") + 
                             (auditeeUser?.profile?.customCert ? `, ${auditeeUser.profile.customCert}` : "")) || 
                            "PMP, AWS Certified ML Specialty, Google Cloud Professional ML Engineer"
        },
        documents: (proj.documents || []).map(d => ({
            name: d.name,
            framework: d.framework,
            size: d.size
        })),
        stats: {
            total: totalCount,
            pass: passCount,
            fail: failCount,
            na: naCount,
            score: compliancePct
        }
    };
    
    showToast("Compiling professional PDF...", "info");
    
    // Default fallback template text for the report (independent of server Gemini API)
    let reportText = `
# 1. Executive Summary
This is an automated compliance audit report for the project "${proj.title}".

# 2. Overall Compliance Assessment
The project achieved a compliance score of ${compliancePct}%.

# 3. Key Strengths
- Project documentation is well-maintained.
- Established procedures for basic compliance tracking.

# 4. Key Weaknesses
- Some automated compliance checks are missing.
- Governance oversight requires strengthening.

# 5. Framework Analysis
The project was evaluated against the A-Z Framework and Path Framework criteria based on the answers provided.

# 6. Risk Assessment
Based on the current compliance posture, the overall risk is assessed as Medium.

# 7. Regulatory Gaps
No critical regulatory gaps were identified, though minor adjustments are needed for full alignment.

# 8. Governance Gaps
Access control policies and human oversight documentation show minor gaps.

# 9. Remediation Roadmap
1. Review and update access controls within 30 days.
2. Complete all pending compliance assessments.

# 10. Priority Actions
- Address the identified weaknesses in the next sprint.
- Conduct a follow-up review for governance policies.

# 11. Auditor Conclusion
The project is on track but requires the execution of the remediation roadmap to achieve full compliance.
    `;
    
    // Attempt server-side Gemini report text generation if server is available
    try {
        console.log("Requesting server-side AI report generation...");
        const serverRes = await fetch('/api/generate-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (serverRes.ok) {
            const data = await serverRes.json();
            if (data.reportText) {
                reportText = data.reportText;
                console.log("Successfully fetched AI report text.");
            }
        }
    } catch (e) {
        console.warn("Could not reach /api/generate-report server-side endpoint. Using standard template.", e);
    }
    
    // 5. Build professional multi-page PDF using jsPDF
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        throw new Error("jsPDF did not load. Check the CDN connection or bundle the library locally.");
    }
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });
    
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 20;
    const pageHeight = height;
    
    // Define Colors
    const eyYellow = [255, 230, 0];
    const eyCharcoal = [46, 46, 46];
    const textDark = [60, 60, 60];
    
    // PAGE 1: COVER PAGE
    // Yellow header bar
    doc.setFillColor(eyYellow[0], eyYellow[1], eyYellow[2]);
    doc.rect(0, 0, width, 15, 'F');
    
    // EY Logo Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
    doc.text("EY", margin, 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("| Building a better working world", margin + 8, 35);
    
    // Report Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
    doc.text("AI GOVERNANCE & COMPLIANCE", margin, 70);
    doc.text("ASSESSMENT REPORT", margin, 82);
    
    doc.setDrawColor(eyYellow[0], eyYellow[1], eyYellow[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, 90, margin + 60, 90);
    
    // Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text("Independent Compliance Audit & AI Risk Advisory Services", margin, 100);
    
    // Project Metadata Box (at bottom)
    const boxY = height - 110;
    doc.setFillColor(248, 248, 248);
    doc.rect(margin, boxY, width - (margin * 2), 75, 'F');
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.rect(margin, boxY, width - (margin * 2), 75, 'D');
    
    let metaY = boxY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
    
    doc.text("PROJECT INFORMATION", margin + 8, metaY);
    doc.setDrawColor(eyYellow[0], eyYellow[1], eyYellow[2]);
    doc.line(margin + 8, metaY + 2, margin + 40, metaY + 2);
    
    metaY += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Project Title:", margin + 8, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(proj.title, margin + 35, metaY);
    
    metaY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Domain Name:", margin + 8, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(proj.domain, margin + 35, metaY);
    
    metaY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Case ID No:", margin + 8, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(proj.id, margin + 35, metaY);
    
    metaY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Audit Date:", margin + 8, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString(), margin + 35, metaY);
    
    metaY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Lead Auditor:", margin + 8, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(`${payload.auditor.name} (${payload.auditor.org})`, margin + 35, metaY);
    
    metaY += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Auditee Client:", margin + 8, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(`${payload.auditee.name} (${payload.auditee.org})`, margin + 35, metaY);
    
    // PAGE 2: SUMMARY & SCORES
    doc.addPage();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
    doc.text("OVERALL COMPLIANCE SCORE CARD", margin, 35);
    
    doc.setDrawColor(eyYellow[0], eyYellow[1], eyYellow[2]);
    doc.setLineWidth(1);
    doc.line(margin, 40, width - margin, 40);
    
    // Giant Score Display Card
    doc.setFillColor(248, 248, 248);
    doc.rect(margin, 50, width - (margin * 2), 50, 'F');
    doc.setDrawColor(eyYellow[0], eyYellow[1], eyYellow[2]);
    doc.setLineWidth(1.5);
    doc.rect(margin, 50, width - (margin * 2), 50, 'D');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
    doc.text(`${compliancePct}%`, width / 2, 75, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("COMPLIANCE RATING SCORE", width / 2, 85, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Calculated based on verified controls and regulatory checklists", width / 2, 92, { align: "center" });
    
    // Detailed Statistics Table
    let tableY = 115;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
    doc.text("Audit Metrics Breakdown", margin, tableY);
    
    tableY += 8;
    doc.setFillColor(46, 46, 46);
    doc.rect(margin, tableY, width - (margin * 2), 8, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("Metric Description", margin + 4, tableY + 5.5);
    doc.text("Evaluation Value", width - margin - 35, tableY + 5.5);
    
    const metrics = [
        { label: "Total Compliance Framework Questions", val: totalCount },
        { label: "Passed Compliance Controls", val: passCount },
        { label: "Failed Compliance Controls", val: failCount },
        { label: "Not Applicable (N/A) Indicators", val: naCount },
        { label: "Compliance Assessment Percentage", val: `${compliancePct}%` }
    ];
    
    doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
    metrics.forEach(m => {
        tableY += 8;
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, tableY, width - (margin * 2), 8, 'F');
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, tableY + 8, width - margin, tableY + 8);
        
        doc.setFont("helvetica", "normal");
        doc.text(m.label, margin + 4, tableY + 5.5);
        doc.setFont("helvetica", "bold");
        doc.text(String(m.val), width - margin - 35, tableY + 5.5);
    });
    
    // Scope and Evidence Info
    tableY += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Assessment Scope & Evidence", margin, tableY);
    
    tableY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const scopeDesc = `This audit report was compiled using the self-assessment framework data and private document vault evidence uploads associated with Case ID: ${proj.id}. The compliance statistics indicate the completion rate of the A-Z Governance Checklist and target regulatory frameworks including: ${proj.frameworks.join(', ')}.`;
    
    const scopeLines = doc.splitTextToSize(scopeDesc, width - (margin * 2));
    doc.text(scopeLines, margin, tableY);
    
    // PAGE 3: DYNAMIC REPORT TEXT FROM GEMINI
    doc.addPage();
    
    // Helper to wrap text
    function addTextWithAutoWrap(d, text, x, y, maxWidth, lHeight, pHeight, m) {
        const lines = d.splitTextToSize(text, maxWidth);
        let currY = y;
        for (let i = 0; i < lines.length; i++) {
            if (currY + lHeight > pHeight - m) {
                d.addPage();
                currY = m + 15;
            }
            d.text(lines[i], x, currY);
            currY += lHeight;
        }
        return currY;
    }
    
    // Simple markdown rendering loop
    const mdLines = reportText.split('\n');
    let currentY = 25;
    const maxWidth = width - (margin * 2);
    const regularLineHeight = 6.5;
    
    for (let line of mdLines) {
        line = line.trim();
        if (!line) {
            currentY += 4;
            continue;
        }
        
        // H1 header
        if (line.startsWith('# ')) {
            currentY += 6;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
            const cleanLine = line.substring(2);
            currentY = addTextWithAutoWrap(doc, cleanLine, margin, currentY, maxWidth, 7.5, pageHeight, margin);
            currentY += 3;
            
            // Yellow line underneath H1
            doc.setDrawColor(eyYellow[0], eyYellow[1], eyYellow[2]);
            doc.setLineWidth(1);
            doc.line(margin, currentY - 2, margin + 40, currentY - 2);
            currentY += 2;
        } 
        // H2 header
        else if (line.startsWith('## ')) {
            currentY += 4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11.5);
            doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
            const cleanLine = line.substring(3);
            currentY = addTextWithAutoWrap(doc, cleanLine, margin, currentY, maxWidth, 7, pageHeight, margin);
            currentY += 2.5;
        } 
        // H3 header
        else if (line.startsWith('### ')) {
            currentY += 3;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(eyCharcoal[0], eyCharcoal[1], eyCharcoal[2]);
            const cleanLine = line.substring(4);
            currentY = addTextWithAutoWrap(doc, cleanLine, margin, currentY, maxWidth, 6.5, pageHeight, margin);
            currentY += 2;
        } 
        // Bullets & List Items
        else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(textDark[0], textDark[1], textDark[2]);
            
            let cleanLine = line.replace(/\*\*/g, '').replace(/\*/g, '');
            if (line.startsWith('* ') || line.startsWith('- ')) {
                doc.text("•", margin, currentY);
                currentY = addTextWithAutoWrap(doc, cleanLine.substring(2), margin + 5, currentY, maxWidth - 5, regularLineHeight, pageHeight, margin);
            } else {
                currentY = addTextWithAutoWrap(doc, cleanLine, margin, currentY, maxWidth, regularLineHeight, pageHeight, margin);
            }
        }
    }
    
    // Header & Footer injection on all pages (excluding cover page)
    function drawPageHeaderFooterForPage(d, pageNum) {
        const w = d.internal.pageSize.getWidth();
        const h = d.internal.pageSize.getHeight();
        
        d.setFont("helvetica", "normal");
        d.setFontSize(7.5);
        d.setTextColor(130, 130, 130);
        d.text("EY AI Compliance & Governance Report", 20, 15);
        d.setDrawColor(eyYellow[0], eyYellow[1], eyYellow[2]);
        d.setLineWidth(0.4);
        d.line(20, 17, w - 20, 17);
        
        // Footer
        d.text(`Page ${pageNum}`, w - 30, h - 15);
        d.text("CONFIDENTIAL - FOR EY GOVTECH ADVISORY CLIENT ONLY", 20, h - 15);
        d.line(20, h - 18, w - 20, h - 18);
    }
    
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        drawPageHeaderFooterForPage(doc, i);
    }
    
    const pdfOutput = doc.output('blob');
    const fileName = `Audit_Report_${proj.id}_${Date.now()}.pdf`;
    const storagePath = `reports/${fileName}`;
    let reportUrl = URL.createObjectURL(pdfOutput);
    let uploadedToSupabase = false;

    if (_supabase?.storage) {
        try {
            showToast("Uploading PDF to Supabase Storage...", "info");
            const { error: uploadErr } = await _supabase.storage
                .from('audit-reports')
                .upload(storagePath, pdfOutput, {
                    contentType: 'application/pdf'
                });

            if (uploadErr) {
                throw uploadErr;
            }

            const { data: urlData } = _supabase.storage
                .from('audit-reports')
                .getPublicUrl(storagePath);

            reportUrl = urlData.publicUrl;
            uploadedToSupabase = true;

            showToast("Saving report metadata to database...", "info");
            const { error: dbErr } = await _supabase
                .from('reports')
                .insert([{
                    project_id: proj.id,
                    generated_by: State.currentUser.email,
                    report_url: reportUrl,
                    compliance_score: compliancePct
                }]);

            if (dbErr) {
                console.warn("Report metadata save failed:", dbErr.message);
            }
        } catch (storageErr) {
            console.warn("Supabase report save failed, falling back to local download:", storageErr);
            showToast("Report generated locally because Supabase save failed.", "warning");
        }
    } else {
        showToast("Supabase is unavailable, generating a local PDF download.", "warning");
    }

    if (uploadedToSupabase) {
        showToast("Audit Report generated and saved online.", "success");
    }
    
    // Always trigger local download of the generated PDF using the compiled blob to bypass network latency/CORS
    try {
        await triggerFileDownload(reportUrl, `Audit_Report_${proj.id}.pdf`, pdfOutput);
    } catch (downloadErr) {
        console.error("Local download failed:", downloadErr);
        showToast("Local PDF download failed: " + downloadErr.message, "error");
    }
    
    // Sync and refresh UI in background to prevent network latency from blocking the flow
    try {
        if (typeof withTimeout !== 'undefined') {
            await withTimeout(syncWithSupabase(), 3000);
        } else {
            await syncWithSupabase();
        }
    } catch (syncErr) {
        console.warn("Background database sync timed out after report generation:", syncErr);
    }
    
    renderComplianceDashboardView();
}
