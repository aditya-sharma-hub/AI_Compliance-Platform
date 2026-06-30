// EY AI Compliance & Governance Tracking Platform (v2.0) Questions Database

// A-Z Checklist: 26 sections, 3 questions each = 78 questions
const AZ_QUESTIONS = [
    {
        letter: "A",
        title: "Access Control",
        questions: [
            { id: "AZ-A-1", text: "Is multi-factor authentication enforced for all administrative and auditor access to the AI system?" },
            { id: "AZ-A-2", text: "Are user access rights to model parameters and training data reviewed and audited quarterly?" },
            { id: "AZ-A-3", text: "Is there a strict principle of least privilege applied to data access and model deployment pipelines?" }
        ]
    },
    {
        letter: "B",
        title: "Bandwidth",
        questions: [
            { id: "AZ-B-1", text: "Is the network bandwidth sufficient to handle peak live camera feed loads (e.g. 40,000+ feeds)?" },
            { id: "AZ-B-2", text: "Are data compression and edge-processing protocols in place for low-bandwidth environments?" },
            { id: "AZ-B-3", text: "Is network latency monitored continuously and kept within acceptable operational thresholds?" }
        ]
    },
    {
        letter: "C",
        title: "Cybersecurity",
        questions: [
            { id: "AZ-C-1", text: "Does the AI system encrypt all data at rest using AES-256 or higher?" },
            { id: "AZ-C-2", text: "Is TLS 1.3 or higher enforced for all AI data transmitted over networks?" },
            { id: "AZ-C-3", text: "Are regular automated vulnerability scans and penetration testing conducted on all AI servers?" }
        ]
    },
    {
        letter: "D",
        title: "Data Integrity",
        questions: [
            { id: "AZ-D-1", text: "Is there a validation mechanism to detect corruption or poisoning in incoming data streams?" },
            { id: "AZ-D-2", text: "Are data cleaning, filtering, and pre-processing steps fully documented and version-controlled?" },
            { id: "AZ-D-3", text: "Are data backup and recovery procedures verified and tested at least monthly?" }
        ]
    },
    {
        letter: "E",
        title: "Explainability",
        questions: [
            { id: "AZ-E-1", text: "Can the AI system provide human-understandable explanations for its computer vision and UAV threat detections?" },
            { id: "AZ-E-2", text: "Are feature importance scores or saliency maps generated for key model predictions?" },
            { id: "AZ-E-3", text: "Is the model decision path auditable by external compliance regulators?" }
        ]
    },
    {
        letter: "F",
        title: "Fairness",
        questions: [
            { id: "AZ-F-1", text: "Are bias assessments conducted on the facial recognition and threat detection training datasets?" },
            { id: "AZ-F-2", text: "Is the model evaluated for demographic parity and equal opportunity across diverse population groups?" },
            { id: "AZ-F-3", text: "Is there a structured process to mitigate and correct identified algorithmic bias in production?" }
        ]
    },
    {
        letter: "G",
        title: "Geo-fencing",
        questions: [
            { id: "AZ-G-1", text: "Are geo-fencing boundaries configured and validated for all autonomous UAV operations?" },
            { id: "AZ-G-2", text: "Is there a fail-safe return-to-base mechanism if a UAV crosses geo-fencing coordinates or loses GPS signal?" },
            { id: "AZ-G-3", text: "Are coordinate updates digitally signed and verified to prevent unauthorized flightpath changes?" }
        ]
    },
    {
        letter: "H",
        title: "Human Oversight",
        questions: [
            { id: "AZ-H-1", text: "Is there a manual override mechanism for high-confidence AI threat alerts and automated UAV dispatches?" },
            { id: "AZ-H-2", text: "Are operator command screens designed to prevent cognitive fatigue and alert blindness?" },
            { id: "AZ-H-3", text: "Is operator feedback logged and integrated into the model refinement lifecycle?" }
        ]
    },
    {
        letter: "I",
        title: "Incident Response",
        questions: [
            { id: "AZ-I-1", text: "Is there a documented incident response plan specifically addressing AI model failures and false dispatches?" },
            { id: "AZ-I-2", text: "Are system failure logs sent to a secure, centralized logging system in real time?" },
            { id: "AZ-I-3", text: "Are incident response drills conducted annually with police command centre operators?" }
        ]
    },
    {
        letter: "J",
        title: "Jurisdictional Compliance",
        questions: [
            { id: "AZ-J-1", text: "Is all training and operational surveillance data stored in compliance with local sovereignty and data residency laws?" },
            { id: "AZ-J-2", text: "Are system operations audited against local municipal bylaws and state surveillance guidelines?" },
            { id: "AZ-J-3", text: "Are cross-border data transfer controls in place if using public cloud instances?" }
        ]
    },
    {
        letter: "K",
        title: "Key Management",
        questions: [
            { id: "AZ-K-1", text: "Are encryption keys stored in a dedicated Hardware Security Module (HSM) or secure cloud KMS?" },
            { id: "AZ-K-2", text: "Are key rotation policies enforced annually for operational databases and API gateways?" },
            { id: "AZ-K-3", text: "Is key access logged, monitored, and restricted to compliance-approved personnel?" }
        ]
    },
    {
        letter: "L",
        title: "Logging & Auditing",
        questions: [
            { id: "AZ-L-1", text: "Are all AI model predictions logged along with their inputs, confidence scores, and outputs?" },
            { id: "AZ-L-2", text: "Are system audit logs protected against unauthorized modifications and tampering?" },
            { id: "AZ-L-3", text: "Are system logs retained for a minimum of 12 months for compliance verification?" }
        ]
    },
    {
        letter: "M",
        title: "Model Drift",
        questions: [
            { id: "AZ-M-1", text: "Is there a mechanism to detect data drift and concept drift in surveillance environment changes?" },
            { id: "AZ-M-2", text: "Are model accuracy, precision, and recall metrics monitored continuously in production?" },
            { id: "AZ-M-3", text: "Is there a scheduled model retraining pipeline triggered by performance degradation?" }
        ]
    },
    {
        letter: "N",
        title: "Network Security",
        questions: [
            { id: "AZ-N-1", text: "Is all AI system traffic isolated within a secure virtual private cloud (VPC) with security groups?" },
            { id: "AZ-N-2", text: "Are intrusion detection systems (IDS) active on the network perimeter containing the camera feeds?" },
            { id: "AZ-N-3", text: "Are firewalls configured with a default-deny policy for internal and external traffic?" }
        ]
    },
    {
        letter: "O",
        title: "Operational Resilience",
        questions: [
            { id: "AZ-O-1", text: "Is the AI system designed with high availability (HA) across multiple zones to prevent service outages?" },
            { id: "AZ-O-2", text: "Is there a disaster recovery plan with a recovery time objective (RTO) under 4 hours?" },
            { id: "AZ-O-3", text: "Are failover mechanisms tested quarterly under simulated load conditions?" }
        ]
    },
    {
        letter: "P",
        title: "Privacy & Masking",
        questions: [
            { id: "AZ-P-1", text: "Does the system dynamically mask human faces and license plates in real-time camera feeds at the edge?" },
            { id: "AZ-P-2", text: "Are personally identifiable datasets anonymized or pseudonymized before model training?" },
            { id: "AZ-P-3", text: "Is access to unmasked raw surveillance feeds restricted to court-ordered or authorized personnel?" }
        ]
    },
    {
        letter: "Q",
        title: "Quality Assurance",
        questions: [
            { id: "AZ-Q-1", text: "Are model test scripts included in the continuous integration (CI) pipeline for automated verification?" },
            { id: "AZ-Q-2", text: "Is regression testing performed on the AI model before every major production update?" },
            { id: "AZ-Q-3", text: "Are test coverage reports generated for all data preprocessing and post-processing code?" }
        ]
    },
    {
        letter: "R",
        title: "Risk Management",
        questions: [
            { id: "AZ-R-1", text: "Is a comprehensive AI risk register maintained and updated quarterly by the technology team?" },
            { id: "AZ-R-2", text: "Are high-risk scenarios identified with clear, actionable mitigation strategies?" },
            { id: "AZ-R-3", text: "Is there a designated AI safety and compliance officer for the Smart City deployment?" }
        ]
    },
    {
        letter: "S",
        title: "System Safety",
        questions: [
            { id: "AZ-S-1", text: "Is there an automated emergency shutdown mechanism for physical UAVs in the event of hardware failure?" },
            { id: "AZ-S-2", text: "Are physical system hardware components rated for extreme weather, rain, and dust?" },
            { id: "AZ-S-3", text: "Does the command platform default to a safe state in the event of sudden power loss?" }
        ]
    },
    {
        letter: "T",
        title: "Transparency",
        questions: [
            { id: "AZ-T-1", text: "Is an AI system transparency statement published for public awareness and city transparency?" },
            { id: "AZ-T-2", text: "Are citizens notified when entering zones monitored by computer-vision threat detection?" },
            { id: "AZ-T-3", text: "Is the AI model lineage fully documented from raw data collection to production deployment?" }
        ]
    },
    {
        letter: "U",
        title: "User Consent",
        questions: [
            { id: "AZ-U-1", text: "Are consent mechanisms clear and easily accessible to data principals if tracking personal data?" },
            { id: "AZ-U-2", text: "Is there a simple opt-out mechanism for citizens regarding data collection?" },
            { id: "AZ-U-3", text: "Are consent logs stored securely and protected from unauthorized modification?" }
        ]
    },
    {
        letter: "V",
        title: "Vulnerability Management",
        questions: [
            { id: "AZ-V-1", text: "Are third-party library dependencies scanned weekly for security advisories and vulnerabilities?" },
            { id: "AZ-V-2", text: "Is there an active vulnerability disclosure program in place for reporting system flaws?" },
            { id: "AZ-V-3", text: "Are critical security patches applied to production systems within 48 hours of release?" }
        ]
    },
    {
        letter: "W",
        title: "Workload Balancer",
        questions: [
            { id: "AZ-W-1", text: "Is the processing workload balanced dynamically across edge and central GPU nodes?" },
            { id: "AZ-W-2", text: "Are GPU utilization rates monitored and optimized to prevent bottlenecks during high alert periods?" },
            { id: "AZ-W-3", text: "Is there an auto-scaling group configured for threat-detection prediction endpoints?" }
        ]
    },
    {
        letter: "X",
        title: "XML/Data Exchange",
        questions: [
            { id: "AZ-X-1", text: "Are XML/JSON data exchange schemas validated against strict definitions before parsing?" },
            { id: "AZ-X-2", text: "Is all incoming exchange data sanitized to prevent command injection attacks?" },
            { id: "AZ-X-3", text: "Are data exchange channels encrypted using TLS 1.3 or higher?" }
        ]
    },
    {
        letter: "Y",
        title: "Yield & Performance",
        questions: [
            { id: "AZ-Y-1", text: "Does the system meet the throughput requirement of 40,000+ camera feeds processed in real-time?" },
            { id: "AZ-Y-2", text: "Is model inference latency kept under 200 milliseconds per frame?" },
            { id: "AZ-Y-3", text: "Are resource constraints defined for edge-device deployments?" }
        ]
    },
    {
        letter: "Z",
        title: "Zero-Trust Architecture",
        questions: [
            { id: "AZ-Z-1", text: "Is identity verified continuously at every step of access (Zero-Trust) within internal APIs?" },
            { id: "AZ-Z-2", text: "Are micro-segmentation boundaries enforced between surveillance modules and the command centre?" },
            { id: "AZ-Z-3", text: "Is all internal server-to-server traffic fully encrypted and mutually authenticated?" }
        ]
    }
];

// Compliance Frameworks Checklist: 5 sections, 42 questions in total
const COMPLIANCE_QUESTIONS = [
    {
        section: "Section 1 — EU AI Act",
        questions: [
            { id: "COMP-EU-1", text: "Is the AI system classified under the EU AI Act risk classification?" },
            { id: "COMP-EU-2", text: "Is a continuous risk management system established for identifying and mitigating high-risk AI risks?" },
            { id: "COMP-EU-3", text: "Has the system undergone high-quality data governance and data checks for bias detection?" },
            { id: "COMP-EU-4", text: "Is detailed technical documentation compiled before deployment to demonstrate conformity?" },
            { id: "COMP-EU-5", text: "Does the system support automatic logging of events (traceability) during operations?" },
            { id: "COMP-EU-6", text: "Is the system designed to allow effective human oversight (HITL) and override?" },
            { id: "COMP-EU-7", text: "Does the system achieve appropriate levels of accuracy, robustness, and cybersecurity?" },
            { id: "COMP-EU-8", text: "Has the AI system been registered in the EU database for high-risk AI systems?" },
            { id: "COMP-EU-9", text: "Is the system CE marked to indicate conformity before going to market?" }
        ]
    },
    {
        section: "Section 2 — NIST AI RMF",
        questions: [
            { id: "COMP-NST-1", text: "Are AI system risks analyzed and documented in a risk register?" },
            { id: "COMP-NST-2", text: "Is there an established governance process for AI risk management?" },
            { id: "COMP-NST-3", text: "Are model biases and limitations identified and mapped?" },
            { id: "COMP-NST-4", text: "Is the AI system monitored for safety, reliability, and security?" },
            { id: "COMP-NST-5", text: "Are mechanisms in place to explain model predictions to users?" },
            { id: "COMP-NST-6", text: "Are training data sources documented and validated?" },
            { id: "COMP-NST-7", text: "Is privacy protected throughout the lifecycle of the system?" },
            { id: "COMP-NST-8", text: "Are system deployment risks assessed regularly?" },
            { id: "COMP-NST-9", text: "Are roles and responsibilities clear for AI risk management?" }
        ]
    },
    {
        section: "Section 3 — DPDP",
        questions: [
            { id: "COMP-DP-1", text: "Is personal data processed only for specified and lawful purposes?" },
            { id: "COMP-DP-2", text: "Is clear and unambiguous consent obtained from data principals?" },
            { id: "COMP-DP-3", text: "Are data principals able to access, correct, and erase their personal data?" },
            { id: "COMP-DP-4", text: "Are security safeguards implemented to prevent data breaches?" },
            { id: "COMP-DP-5", text: "Is data deleted once the purpose of processing is fulfilled?" },
            { id: "COMP-DP-6", text: "Is a Data Protection Officer (DPO) appointed if required?" },
            { id: "COMP-DP-7", text: "Is there a mechanism to handle grievances of data principals?" },
            { id: "COMP-DP-8", text: "Are subprocessors bound by data protection obligations?" }
        ]
    },
    {
        section: "Section 4 — MeitY Guidelines",
        questions: [
            { id: "COMP-MY-1", text: "Does the AI system align with MeitY guidelines for responsible AI development?" },
            { id: "COMP-MY-2", text: "Are steps taken to ensure that AI does not generate biased or discriminatory outcomes?" },
            { id: "COMP-MY-3", text: "Is there transparency in the algorithms used in public service delivery?" },
            { id: "COMP-MY-4", text: "Are safety audits conducted for citizen-facing AI deployments?" },
            { id: "COMP-MY-5", text: "Is data localization compliance maintained for citizen data?" },
            { id: "COMP-MY-6", text: "Are mechanisms in place to report algorithmic failures?" },
            { id: "COMP-MY-7", text: "Are testing records maintained for auditor verification?" },
            { id: "COMP-MY-8", text: "Is public trust and safety prioritized in the deployment design?" }
        ]
    },
    {
        section: "Section 5 — ISO 42001",
        questions: [
            { id: "COMP-ISO-1", text: "Is there an established AI Management System (AIMS) in the organization?" },
            { id: "COMP-ISO-2", text: "Are AI policies aligned with the strategic direction of the organization?" },
            { id: "COMP-ISO-3", text: "Is there a process for AI system risk assessment and treatment?" },
            { id: "COMP-ISO-4", text: "Are roles and responsibilities within the AIMS defined and communicated?" },
            { id: "COMP-ISO-5", text: "Are resources provided for the establishment, implementation, and maintenance of the AIMS?" },
            { id: "COMP-ISO-6", text: "Are internal audits of the AIMS conducted at planned intervals?" },
            { id: "COMP-ISO-7", text: "Is a management review of the AIMS conducted periodically?" },
            { id: "COMP-ISO-8", text: "Are corrective actions taken for identified nonconformities?" }
        ]
    }
];

// Seed Data for Users
const DEFAULT_USERS = [
    {
        email: "auditor@ey.com",
        password: "audit123",
        fullname: "EY Auditor",
        org: "Ernst & Young LLP",
        designation: "Lead AI Compliance Auditor",
        role: "auditor",
        mobile: "9800000001",
        onboarded: true,
        profile: {
            role: "Lead Auditor",
            years: 8,
            certs: ["ISO 42001 Lead Auditor", "CISA", "CISSP"],
            qualification: "MBA",
            specialization: "AI Governance"
        }
    },
    {
        email: "auditee@ey.com",
        password: "auditee123",
        fullname: "EY Auditee",
        org: "TechCorp India Pvt. Ltd.",
        designation: "Technology Director",
        role: "auditee",
        mobile: "9800000002",
        onboarded: true,
        profile: {
            profExp: 10,
            aiExp: 4,
            certs: ["PMP", "AWS Certified"],
            orgName: "TechCorp India",
            orgType: "Private Limited",
            industry: "Financial Services",
            size: "500-2000",
            aiSystems: 3,
            aiDomains: "Fraud Detection, KYC Automation",
            pocName: "EY Auditee",
            pocEmail: "auditee@ey.com",
            pocPhone: "9800000002"
        }
    },
    {
        email: "ramesh.k@ey.com",
        password: "password123",
        fullname: "Ramesh Krishnamurthy",
        org: "Ernst & Young LLP",
        designation: "Senior AI Compliance Auditor",
        role: "auditor",
        mobile: "9876543210",
        onboarded: true,
        profile: {
            role: "Lead Auditor",
            years: 6,
            certs: ["ISO 42001 Lead Auditor", "CISA", "CISSP"]
        }
    },
    {
        email: "arjun.mehta@govtech.in",
        password: "password123",
        fullname: "Arjun Mehta",
        org: "GovTech Solutions Pvt. Ltd.",
        designation: "Technology Director",
        role: "auditee",
        mobile: "9765432100",
        onboarded: true,
        profile: {
            profExp: 14,
            aiExp: 5,
            certs: ["PMP", "AWS Certified ML Specialty"],
            customCert: "Google Cloud Professional ML Engineer"
        }
    }
];

// Seed Project (Case ID: 84721)
const INITIAL_PROJECTS = [
    {
        id: "84721",
        title: "AI-Powered Smart City Surveillance & Command Platform",
        domain: "Safe City",
        desc: "An integrated AI surveillance and command platform for metropolitan police operations, processing 40,000+ live camera feeds using computer vision-based threat detection, crowd analytics, and autonomous UAV surveillance across 200+ urban intersections.",
        frameworks: ["EU AI Act", "NIST AI RMF", "DPDP", "MeitY Guidelines", "ISO 42001"],
        status: "Submitted — Awaiting Auditor Review",
        isSeedDemo: true,
        auditeeEmail: "arjun.mehta@govtech.in",
        auditeeProfile: {
            designation: "Technology Director",
            profExp: 14,
            aiExp: 5,
            certs: "PMP, AWS Certified ML Specialty, Google Cloud Professional ML Engineer"
        },
        documents: [
            { name: "AIMS_Policy_v2.pdf", framework: "ISO 42001", size: "2.4 MB", timestamp: "2026-06-12 10:14" },
            { name: "Risk_Assessment_Report.docx", framework: "EU AI Act", size: "1.8 MB", timestamp: "2026-06-12 10:15" },
            { name: "AI_Risk_Register_2026.pdf", framework: "NIST AI RMF", size: "3.1 MB", timestamp: "2026-06-12 10:16" }
        ],
        azAnswers: {},
        complianceAnswers: {},
        azSubmitted: false,
        complianceSubmitted: false
    }
];
