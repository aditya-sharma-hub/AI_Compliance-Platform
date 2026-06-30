const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}

const PORT = 8080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

const requestHandler = (req, res) => {
  // Decode URL parameters (handling %20, etc.)
  let decodedUrl = decodeURIComponent(req.url);
  // Strip off query parameters or hashes
  const cleanUrl = decodedUrl.split('?')[0].split('#')[0];
  
  // API Endpoint to expose Supabase environment variables to frontend
  if (cleanUrl === '/api/config') {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://kblhprlnluzusktimlmf.supabase.co';
    const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtibGhwcmxubHV6dXNrdGltbG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzM2ODAsImV4cCI6MjA5NzQwOTY4MH0.zj5_AyOI55ym-7CITVjr8ZA6LByFOIgEBOltuVNuPOM').trim();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      supabaseUrl,
      supabaseAnonKey,
      supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
      configSource: fs.existsSync(envPath) ? '.env' : 'process env'
    }));
    return;
  }

  // API Endpoint to download PDF from base64 (helps bypass sandboxed iframe restrictions)
  if (cleanUrl === '/api/download-pdf' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        let pdfBase64 = '';
        let filename = 'Audit_Report.pdf';
        
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          const payload = JSON.parse(body);
          pdfBase64 = payload.pdfBase64;
          filename = payload.filename || filename;
        } else {
          const querystring = require('querystring');
          const payload = querystring.parse(body);
          pdfBase64 = payload.pdfBase64;
          filename = payload.filename || filename;
        }

        if (!pdfBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing pdfBase64 in request body.' }));
          return;
        }

        const buffer = Buffer.from(pdfBase64, 'base64');
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length
        });
        res.end(buffer);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process download: ' + err.message }));
      }
    });
    return;
  }

  // API Endpoint to proxy cross-origin downloads to enforce custom filename
  if (cleanUrl === '/api/proxy-download' && req.method === 'GET') {
    const query = decodedUrl.split('?')[1] || '';
    const querystring = require('querystring');
    const params = querystring.parse(query);
    const fileUrl = params.url;
    const filename = params.filename || 'download.pdf';

    if (!fileUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url parameter');
      return;
    }

    const https = require('https');
    https.get(fileUrl, (proxyRes) => {
      res.writeHead(200, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      });
      proxyRes.pipe(res);
    }).on('error', (e) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error fetching file: ' + e.message);
    });
    return;
  }

  // API Endpoint to call Gemini API server-side using native https module
  if (cleanUrl === '/api/generate-report' && req.method === 'POST') {
    console.log('[Server] Received POST request to /api/generate-report');
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('[Server] Request body fully read, length:', body.length);
      try {
        const payload = JSON.parse(body);
        console.log('[Server] Parsed payload for project:', payload.project?.id);
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.error('[Server] GEMINI_API_KEY is not configured on the server.');
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }));
          return;
        }

        const https = require('https');
        
        // Build the prompt content using client payload
        const prompt = `You are a Senior AI Governance and Compliance Auditor.
Generate a professional consulting-style assessment report for EY client in professional EY language.

Project Details:
- Title: ${payload.project.title}
- Domain: ${payload.project.domain}
- Description: ${payload.project.description}
- Status: ${payload.project.status}

Auditor Info:
- Name: ${payload.auditor.name}
- Organisation: ${payload.auditor.org}
- Designation: ${payload.auditor.designation}
- Experience: ${payload.auditor.experience} years
- Certifications: ${payload.auditor.certifications}

Auditee Info:
- Name: ${payload.auditee.name}
- Organisation: ${payload.auditee.org}
- Designation: ${payload.auditee.designation}
- Experience: ${payload.auditee.experience} years (AI: ${payload.auditee.aiExperience} years)
- Certifications: ${payload.auditee.certifications}

Evidence Documents Uploaded:
${payload.documents && payload.documents.length > 0 ? payload.documents.map(d => `- ${d.name} (${d.framework} Tag, Size: ${d.size})`).join('\n') : 'No documents uploaded.'}

Compliance Summary Statistics:
- Total Evaluated Questions: ${payload.stats.total}
- Pass Count: ${payload.stats.pass}
- Fail Count: ${payload.stats.fail}
- N/A Count: ${payload.stats.na}
- Compliance Percentage: ${payload.stats.score}%

Please structure your report into the following exact 11 sections. Use markdown headings:

# 1. Executive Summary
Provide a high-level summary of the compliance audit, scope, and overall status.

# 2. Overall Compliance Assessment
Explain the compliance score of ${payload.stats.score}% and what it means for the project's regulatory posture.

# 3. Key Strengths
Highlight areas where the project demonstrates robust compliance and best practices.

# 4. Key Weaknesses
Detail areas where the project has failed or is lacking critical controls.

# 5. Framework Analysis
Analyse the compliance state under:
- A-Z Framework
- Path Framework Part 1
- Path Framework Part 2
(Note: Map the compliance answers and questions logically to these sections)

# 6. Risk Assessment
Assess the severity of compliance risks (Low/Medium/High) based on the findings.

# 7. Regulatory Gaps
Detail specific gaps against regulations like the EU AI Act, NIST AI RMF, and local guidelines.

# 8. Governance Gaps
Detail gaps in human oversight, accountability, policies, or access controls.

# 9. Remediation Roadmap
Propose a phased roadmap to address identified gaps and improve compliance.

# 10. Priority Actions
List immediate, high-priority actions that the technology and audit teams must execute.

# 11. Auditor Conclusion
Provide a formal concluding statement as an EY Auditor.`;

        const geminiPayload = JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        });

        console.log('[Server] Preparing to call Gemini API...');
        const options = {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(geminiPayload)
          }
        };

        const geminiReq = https.request(options, geminiRes => {
          console.log('[Server] Gemini responded with status code:', geminiRes.statusCode);
          let geminiData = '';
          geminiRes.on('data', chunk => {
            geminiData += chunk;
          });
          geminiRes.on('end', () => {
            console.log('[Server] Gemini response read finished, length:', geminiData.length);
            if (geminiRes.statusCode === 200) {
              try {
                const geminiJSON = JSON.parse(geminiData);
                const generatedText = geminiJSON.candidates[0].content.parts[0].text;
                console.log('[Server] Successfully parsed report text, length:', generatedText.length);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ reportText: generatedText }));
              } catch (e) {
                console.error('[Server] Failed to parse Gemini response:', e.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to parse Gemini API response: ' + e.message }));
              }
            } else {
              console.error('[Server] Gemini error status:', geminiRes.statusCode, geminiData);
              res.writeHead(geminiRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Gemini API returned status ' + geminiRes.statusCode, details: geminiData }));
            }
          });
        });

        geminiReq.on('error', e => {
          console.error('[Server] Gemini request error event:', e.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Gemini API request failed: ' + e.message }));
        });

        geminiReq.write(geminiPayload);
        geminiReq.end();
        console.log('[Server] Gemini request payload written and sent');

      } catch (err) {
        console.error('[Server] Exception in generate-report endpoint:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body: ' + err.message }));
      }
    });
    return;
  }

  // ============================================================
  // API Endpoint: /api/analyze-framework
  // Accepts JSON: { pdfBase64, frameworkType, sectionHint }
  // Runs pdf_analyzer.py and returns extracted questions JSON
  // ============================================================
  if (cleanUrl === '/api/analyze-framework' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { pdfBase64, frameworkType, sectionHint } = payload;

        if (!pdfBase64 || !frameworkType) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing pdfBase64 or frameworkType' }));
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
          console.error('[Server] GEMINI_API_KEY environment variable is not configured.');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured on the server.' }));
          return;
        }

        // Build prompt
        let prompt = '';
        if (frameworkType === 'az') {
          const sectionInstruction = (sectionHint && sectionHint !== 'auto') 
            ? `Focus on section "${sectionHint.toUpperCase()}".` 
            : 'Generate for all relevant A-Z sections.';
          prompt = `You are an EY AI Governance Compliance Auditor.
Analyze the attached PDF document and generate A-Z Technical Framework compliance questions.
${sectionInstruction}

Return ONLY this JSON structure (no markdown, no explanation, no surrounding backticks):
{"framework":"az","sections":[{"letter":"A","title":"Access Control","questions":[{"id":"AZ-A-1","text":"Question?"}]}]}

Rules: 2-5 questions per section, IDs as AZ-<LETTER>-<NUM>, yes/no auditable questions, only relevant sections.`;
        } else {
          const sectionInstruction = (sectionHint && sectionHint !== 'auto') 
            ? `Focus on: "${sectionHint}".` 
            : 'Identify the relevant compliance framework from the document.';
          prompt = `You are an EY AI Governance Compliance Auditor.
Analyze the attached PDF document and generate Compliance Framework audit questions.
${sectionInstruction}

Return ONLY this JSON structure (no markdown, no explanation, no surrounding backticks):
{"framework":"compliance","sections":[{"section":"Section 1 - EU AI Act","prefix":"COMP-EU","questions":[{"id":"COMP-EU-1","text":"Question?"}]}]}

Rules: 3-9 questions per section, IDs as COMP-<CODE>-<NUM>, yes/no auditable questions.
Valid sections: "Section 1 - EU AI Act", "Section 2 - NIST AI RMF", "Section 3 - DPDP", "Section 4 - MeitY Guidelines", "Section 5 - ISO 42001".`;
        }

        const geminiPayload = JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: pdfBase64
                  }
                },
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192
          }
        });

        const https = require('https');
        console.log(`[Server] Calling Gemini for analyze-framework type="${frameworkType}" section="${sectionHint}"`);
        const options = {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(geminiPayload)
          }
        };

        const geminiReq = https.request(options, geminiRes => {
          console.log('[Server] Gemini framework analysis responded status:', geminiRes.statusCode);
          let geminiData = '';
          geminiRes.on('data', chunk => { geminiData += chunk; });
          geminiRes.on('end', () => {
            if (geminiRes.statusCode === 200) {
              try {
                const geminiJSON = JSON.parse(geminiData);
                let text = geminiJSON.candidates[0].content.parts[0].text.trim();
                
                // Extract JSON block if enclosed in markdown code fences
                if (text.startsWith("```")) {
                  const lines = text.split("\n");
                  const cleanLines = lines.filter(l => !l.trim().startsWith("```"));
                  text = cleanLines.join("\n").trim();
                }
                const startIdx = text.indexOf("{");
                const endIdx = text.lastIndexOf("}");
                if (startIdx !== -1 && endIdx !== -1) {
                  text = text.substring(startIdx, endIdx + 1);
                }

                const resultJSON = JSON.parse(text);
                console.log('[Server] Successfully parsed extracted questions.');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(resultJSON));
              } catch (e) {
                console.error('[Server] Failed to parse Gemini response or extract JSON:', e.message, geminiData.substring(0, 500));
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to process Gemini API response: ' + e.message, raw: geminiData.substring(0, 300) }));
              }
            } else {
              console.error('[Server] Gemini error:', geminiRes.statusCode, geminiData);
              res.writeHead(geminiRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Gemini API returned status ' + geminiRes.statusCode, details: geminiData }));
            }
          });
        });

        geminiReq.on('error', e => {
          console.error('[Server] Gemini request error:', e.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Gemini API request failed: ' + e.message }));
        });

        geminiReq.write(geminiPayload);
        geminiReq.end();

      } catch (err) {
        console.error('[Server] Exception in analyze-framework endpoint:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request: ' + err.message }));
      }
    });
    return;
  }

  let filePath = path.join(__dirname, cleanUrl === '/' ? 'index.html' : cleanUrl);
  
  // Prevent directory traversal attacks
  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // Check if target is a directory, if so, append index.html
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Server error: ${err.code}`);
        }
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content, 'utf-8');
      }
    });
  });
};

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('==================================================');
    console.log('  AegisAI Local Server Started Successfully!');
    console.log(`  Access the application at: http://localhost:${PORT}`);
    console.log('  Press Ctrl+C to stop the server.');
    console.log('==================================================');
  });
}

module.exports = requestHandler;
