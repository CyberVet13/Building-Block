"""Pre-built demo plan returned when DEMO_MODE=true.

This lets the UI be explored end-to-end (wizard → generation → plan viewer →
export) without Postgres, Bedrock, or any AWS credentials.
"""

DEMO_JOB_ID = "demo-job-00000000-0000-0000-0000-000000000001"
DEMO_PLAN_ID = "demo-plan-00000000-0000-0000-0000-000000000001"

DEMO_PLAN = {
    "plan_id": DEMO_PLAN_ID,
    "title": "FreelancerOS — AI-Powered Freelance Management Platform",
    "is_preview": False,
    "version": 1,
    "created_at": "2026-06-10T10:00:00Z",
    "industry": "saas",
    "content": {
        "sections": {
            "executive_summary": (
                "FreelancerOS is a SaaS platform purpose-built for independent developers and "
                "consultants who need to run their practice like a business. We automate the "
                "administrative layer — client invoicing, time tracking, and rate optimization — "
                "so developers spend more time building and less time managing.\n\n"
                "The global freelance economy represents over $1.5 trillion in economic activity, "
                "with an estimated 73 million freelancers in the US alone. Despite this scale, "
                "the tooling remains fragmented: developers cobble together Toggl, FreshBooks, "
                "Notion, and spreadsheets. FreelancerOS replaces that stack with a single "
                "integrated platform.\n\n"
                "Our AI rate engine is the key differentiator. By analyzing real market data "
                "from 50,000+ freelance contracts, we surface personalized pricing recommendations "
                "that help users charge what the market will bear — not what they guess. Early "
                "beta users report a 23% average rate increase in their first 90 days.\n\n"
                "We target a $29/mo Starter and $79/mo Pro model, projecting $2.4M ARR at end "
                "of Year 2 at conservative conversion assumptions. The founding team brings "
                "combined experience from Stripe, Toptal, and two successful developer tool exits."
            ),
            "market_analysis": (
                "The freelance software market is large, growing, and underserved by modern tooling.\n\n"
                "Total Addressable Market (TAM): $4.2B globally (freelance management software, "
                "invoicing tools, and time-tracking platforms combined). Growing at 12% CAGR driven "
                "by the continued rise of independent work post-pandemic.\n\n"
                "Serviceable Addressable Market (SAM): $840M — English-speaking markets (US, UK, "
                "Canada, Australia) where contract law and payment infrastructure support "
                "independent consulting at scale.\n\n"
                "Serviceable Obtainable Market (SOM — Year 3): $8.4M — 1% SAM share, achievable "
                "with a focused developer community GTM strategy.\n\n"
                "Key trends driving demand:\n"
                "1. Remote-first economy normalizing independent work as a primary career track\n"
                "2. AI coding tools increasing developer productivity, enabling solo practitioners "
                "   to compete with larger agencies\n"
                "3. Payment infrastructure (Stripe, Wise) making global freelancing operationally "
                "   feasible\n"
                "4. Increasing IRS and HMRC scrutiny of contractor classification, raising demand "
                "   for clean financial records\n\n"
                "Primary customer segments:\n"
                "- Senior engineers leaving FAANG to consult ($150-350/hr, high willingness to pay)\n"
                "- Agency-of-one designers and developers (1-3 clients, project-based billing)\n"
                "- Developer coaches and technical educators (recurring retainer clients)"
            ),
            "competitive_landscape": (
                "The competitive landscape is fragmented between legacy accounting tools and "
                "point solutions that don't speak to each other.\n\n"
                "Direct competitors:\n"
                "- FreshBooks ($15-55/mo): Strong invoicing, weak time tracking, no rate intelligence. "
                "  Built for all small businesses, not developers specifically.\n"
                "- HoneyBook ($19-79/mo): CRM-first, excellent for creatives, poor developer "
                "  workflow integration.\n"
                "- Bonsai ($21-79/mo): Closest to our positioning but no AI features and "
                "  limited market data.\n\n"
                "Indirect competitors:\n"
                "- Spreadsheets + manual invoicing (40% of our target market still does this)\n"
                "- Toggl + Stripe + FreshBooks assembled stack (high switching cost opportunity)\n\n"
                "Our sustainable advantages:\n"
                "1. Rate intelligence engine: 18-month head start on proprietary market data\n"
                "2. Developer-native UX: CLI integration, GitHub sync, API-first design\n"
                "3. Community flywheel: Rate data improves with each user, creating network effects\n\n"
                "Porter's Five Forces summary: Low supplier power (AWS commodity), moderate buyer "
                "power (low switching costs offset by stickiness of financial data), low threat of "
                "new entrants (data moat), moderate substitutes (spreadsheets), moderate rivalry "
                "(fragmented but FreshBooks has brand recognition)."
            ),
            "financials": (
                "Revenue model: Monthly SaaS subscriptions\n"
                "- Starter: $29/mo — invoicing + time tracking (up to 5 clients)\n"
                "- Pro: $79/mo — unlimited clients + AI rate engine + market benchmarks\n\n"
                "Financial projections:\n\n"
                "Year 1 (launch + initial traction):\n"
                "- Target: 300 paying customers by month 12\n"
                "- Revenue mix: 60% Starter, 40% Pro → blended ARPU ~$46/mo\n"
                "- MRR at month 12: $13,800 | ARR: $165,600\n"
                "- Gross margin: 82% (SaaS infrastructure ~18% of revenue)\n"
                "- Burn: $15,000/mo (founder + 1 contractor, cloud infra)\n"
                "- Runway needed: 18 months at $270K\n\n"
                "Year 2 (growth):\n"
                "- Target: 1,800 paying customers\n"
                "- MRR: $82,800 | ARR: $993,600\n"
                "- Hire: 1 growth engineer, 1 customer success\n"
                "- CAC: $120 (content-led, community GTM)\n"
                "- LTV: $920 (average 20-month retention)\n"
                "- LTV:CAC ratio: 7.7x\n\n"
                "Year 3 (scale):\n"
                "- Target: 5,000 customers\n"
                "- MRR: $230,000 | ARR: $2,760,000\n"
                "- Break-even: Month 26\n\n"
                "Key assumptions: 3.5% monthly churn (industry median), 8% monthly organic "
                "growth via developer community, 1.2% free-to-paid conversion from developer "
                "advocacy content."
            ),
            "operations": (
                "Team and structure:\n"
                "- Founding engineer/CEO: Product, engineering, initial sales\n"
                "- Month 6: Contract growth engineer (content + SEO)\n"
                "- Month 12: First full-time hire (customer success/support)\n"
                "- Month 18: Second engineer (rate engine + data pipeline)\n\n"
                "Technology stack:\n"
                "- Backend: Python (FastAPI), PostgreSQL, Redis\n"
                "- Frontend: Next.js, deployed on Vercel\n"
                "- Payments: Stripe Billing\n"
                "- AI/ML: Fine-tuned LLM on proprietary rate data, retraining quarterly\n"
                "- Infrastructure: AWS (us-east-1), Aurora Serverless, Lambda\n\n"
                "Key operational milestones:\n"
                "- Month 1: Private beta (50 users from personal network)\n"
                "- Month 3: Public launch on Product Hunt + Hacker News\n"
                "- Month 6: Rate engine v2 (expanded to 100K contracts)\n"
                "- Month 9: GitHub integration (auto-import project hours from commits)\n"
                "- Month 12: API launch (let developers build on top of the platform)\n\n"
                "Customer support model: Self-serve documentation + async Slack community. "
                "No phone support. Response SLA: 4 hours for Pro, 24 hours for Starter."
            ),
        }
    },
}

DEMO_JOB = {
    "job_id": DEMO_JOB_ID,
    "status": "completed",
    "stage": "executive_summary",
    "is_preview": False,
    "plan": DEMO_PLAN,
}
