import asyncio
import sys

import os
import uuid
import warnings

import os
import uuid
import warnings

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import traceback

from fastapi import FastAPI, Request, Form, Depends, HTTPException, BackgroundTasks, Body, File, UploadFile
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
from sqlmodel import Session, select, func, text
from dotenv import load_dotenv

# Database & Models
from database import (
    engine, 
    Company, 
    EmailLog,
    User,
    ClientProfile,
    Project,
    Remark,
    Document,
    ActivityLog,
    ClientStatus,
    CallLog,
    SentEmail,
    create_db_and_tables, 
    get_session
)

# AI & Scraping Modules
from modules.scraper import scrape_website
from modules.llm_engine import analyze_content, generate_email, analyze_document
from modules.market_analyzer import analyze_market, match_services
from modules.serp_hawk_email import generate_serp_hawk_email
from modules.fallback_analyzer import analyze_company_name_fallback
from modules.image_generator import generate_email_image
from modules.email_sender import send_email_outlook

# Load environment variables
load_dotenv(override=True)

# Configuration
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "padilla@dapros.com") # Default sender for UI
HOURLY_EMAIL_LIMIT = int(os.getenv("HOURLY_EMAIL_LIMIT", 50))
OUTLOOK_EMAIL = os.getenv('OUTLOOK_EMAIL')
OUTLOOK_PASSWORD = os.getenv('OUTLOOK_PASSWORD')
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')

SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
IMAP_SERVER = os.getenv('IMAP_SERVER') # Optional: For saving to Sent folder if auto-detect fails

# Create output directories
os.makedirs('static/generated_images', exist_ok=True)


# Custom Exceptions
class OutreachError(Exception):
    """Base exception for outreach eligibility errors"""
    pass


class DuplicateProspectError(OutreachError):
    """Raised when a prospect has already been contacted"""
    pass


class RateLimitExceededError(OutreachError):
    """Raised when hourly email limit is reached"""
    pass

def sync_scrape_website_wrapper(url):
    """
    Wrapper to run the async scraper in a fresh nested loop.
    This fixes the NotImplementedError on Windows by ensuring a ProactorEventLoop is used.
    """
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Import here to avoid circular dependencies if any
    from modules.scraper import scrape_website
    return asyncio.run(scrape_website(url))

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan - creates tables on startup
    """
    print("Starting Cold Outreach CRM...")
    
    # Debug loop type
    try:
        loop = asyncio.get_running_loop()
        print(f"DEBUG: FastAPI is running on loop: {type(loop).__name__}")
        if sys.platform == 'win32' and 'Proactor' not in type(loop).__name__:
            print("WARNING: ProactorEventLoop NOT detected. Playwright might fail.")
    except Exception as e:
        print(f"DEBUG: Could not check loop type: {e}")

    print("Creating database tables...")
    create_db_and_tables()
    
    # Simple migrations for client_profiles and companies
    try:
        with engine.connect() as conn:
            # Companies migration
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS recommended_services VARCHAR(1000)"))
            
            # ClientProfile migrations
            conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS \"nextMilestone\" VARCHAR(255)"))
            conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS \"nextMilestoneDate\" VARCHAR(255)"))
            conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS recommended_services VARCHAR(1000)"))
            conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS \"projectId\" INTEGER"))
            conn.execute(text("ALTER TABLE remarks ADD COLUMN IF NOT EXISTS \"projectId\" INTEGER"))

            # CallLog new columns (description, work, assign, followup)
            conn.execute(text("ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS description TEXT"))
            conn.execute(text("ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS work_done TEXT"))
            conn.execute(text("ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255)"))
            conn.execute(text("ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS followup_needed BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS followup_date VARCHAR(50)"))

            # SentEmail bilingual columns
            conn.execute(text("ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS english_body TEXT"))
            conn.execute(text("ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS spanish_body TEXT"))
            
            conn.commit()
            print("Database schema updated successfully")
    except Exception as e:
        print(f"Schema update note: {e}")

    print("Database ready!")
    
    # Try to install playwright browsers if needed (optional check)
    # print("Checking Playwright browsers...")
    # os.system("playwright install chromium") 
    
    yield
    print("Shutting down Cold Outreach CRM...")


# Initialize FastAPI app
app = FastAPI(
    title="Cold Outreach CRM",
    description="A simple CRM for managing cold email outreach",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "https://crm-v2-serp-hawk.vercel.app",   # Vercel production frontend
    "https://crm-v2-varshith.vercel.app",      # alternate Vercel domain
    os.getenv("FRONTEND_URL", ""),             # override via Railway env var
]
ALLOWED_ORIGINS = [o for o in ALLOWED_ORIGINS if o]  # remove empty strings

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # allow all origins — safe for this CRM
    allow_credentials=False,      # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class ClientCreate(BaseModel):
    companyName: str
    websiteUrl: str
    email: str
    projectName: Optional[str] = None
    gmbName: Optional[str] = None
    seoStrategy: Optional[str] = None
    tagline: Optional[str] = None
    targetKeywords: Optional[List[str]] = None
    recommended_services: Optional[str] = None

class ActivityAdd(BaseModel):
    method: str
    content: str

class RemarkAdd(BaseModel):
    content: str

class EmailSend(BaseModel):
    subject: str
    body: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ClientUpdate(BaseModel):
    status: Optional[str] = None
    nextMilestone: Optional[str] = None
    nextMilestoneDate: Optional[str] = None
    projectName: Optional[str] = None
    websiteUrl: Optional[str] = None
    gmbName: Optional[str] = None
    seoStrategy: Optional[str] = None
    tagline: Optional[str] = None
    recommended_services: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "Planning"
    progress: Optional[int] = 0
    employeeIds: Optional[List[int]] = []
    internIds: Optional[List[int]] = []
    clientIds: Optional[List[int]] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    employeeIds: Optional[List[int]] = None
    internIds: Optional[List[int]] = None
    clientIds: Optional[List[int]] = None

class ProjectRemarkAdd(BaseModel):
    content: str
    isInternal: Optional[bool] = True

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

# ============================================================================
# BUSINESS LOGIC - The "Gatekeeper" Middleware
# ============================================================================

def check_outreach_eligibility(session: Session, website_url: str) -> dict:
    """
    Gatekeeper function that checks if we can send an outreach email.
    """
    result = {
        "eligible": True,
        "existing_company": None,
        "emails_sent_last_hour": 0
    }
    
    # Normalize URL for comparison
    normalized_url = website_url.strip().lower()
    if not normalized_url.startswith(('http://', 'https://')):
        normalized_url = 'https://' + normalized_url
    
    # Rule A: Duplicate Check
    statement = select(Company).where(Company.website_url == normalized_url)
    existing_company = session.exec(statement).first()
    
    if existing_company:
        result["existing_company"] = existing_company
        if existing_company.email_sent_status:
            raise DuplicateProspectError(
                f"❌ Prospecting email already sent to {existing_company.company_name} "
                f"({existing_company.website_url}) on {existing_company.created_at.strftime('%Y-%m-%d %H:%M')}"
            )
    
    # Rule B: Rate Limiter
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    
    rate_limit_statement = select(func.count(EmailLog.id)).where(
        EmailLog.sender_email == SENDER_EMAIL,
        EmailLog.sent_at > one_hour_ago
    )
    emails_sent_count = session.exec(rate_limit_statement).one()
    result["emails_sent_last_hour"] = emails_sent_count
    
    if emails_sent_count >= HOURLY_EMAIL_LIMIT:
        raise RateLimitExceededError(
            f"⏳ Hourly email limit ({HOURLY_EMAIL_LIMIT}) reached. "
            f"You've sent {emails_sent_count} emails in the last hour. "
            f"Please wait before sending more."
        )
    
    return result


# ============================================================================
# ROUTES - API
# ============================================================================

@app.get("/")
async def root():
    """
    Root endpoint - indicates API is running.
    """
    return {
        "message": "Cold Outreach CRM API is running",
        "version": "2.1.2-fallback-fix-v3",
        "frontend": "http://localhost:3000",
        "docs": "/docs"
    }




# ============================================================================
# PROCESS ROUTES - Add Lead & Send Email (CRM Style)
# ============================================================================

@app.post("/login")
async def login(data: LoginRequest, session: Session = Depends(get_session)):
    """Simple database login for CRM"""
    statement = select(User).where(User.email == data.email)
    user = session.exec(statement).first()
    
    if user and user.password == data.password:
        return {
            "success": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role
            }
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid email or password")

@app.post("/draft-lead")
async def draft_lead(
    company_name: str = Form(...),
    website_url: str = Form(...),
    primary_email: str = Form(...),
    session: Session = Depends(get_session)
):
    """
    Step 1: Check eligibility, analyze URL, and return Draft (NO SENDING)
    """
    try:
        # Normalize URL
        normalized_url = website_url.strip().lower()
        if not normalized_url.startswith(('http://', 'https://')):
            normalized_url = 'https://' + normalized_url
        
        # Check eligibility (just for info, but don't block drafting yet? Or do block?)
        # Let's BLOCK if already sent, to warn user.
        eligibility = check_outreach_eligibility(session, normalized_url)
        
        print(f"Analyzing {normalized_url} for personalization...")
        
        # Scrape & Analyze
        scraped_text = await run_in_threadpool(scrape_website, normalized_url)
        
        subject = f"Partnership Opportunity with {company_name}"
        body_html = f"<p>Hi {company_name} Team,</p><p>We'd love to partner.</p>" 
        
        if scraped_text and not scraped_text.startswith("ERROR SCRAPING"):
            company_info = await run_in_threadpool(analyze_content, scraped_text)
            market_analysis = await run_in_threadpool(analyze_market, scraped_text, company_name)
            service_matches = await run_in_threadpool(match_services, market_analysis, company_info)
        else:
            # Enhanced fallback: Use AI to analyze company name for industry hints
            company_info = await run_in_threadpool(analyze_company_name_fallback, company_name)
            # IMPORTANT: inject company_name so the email generator doesn't default to 'your company'
            company_info['company_name'] = company_name
            company_info.setdefault('contacts', [])
            market_analysis = {
                'industry': company_info.get('likely_industry', 'Unknown'), 
                'sub_category': company_info.get('sub_category', ''),
                'business_model': company_info.get('business_model', 'B2B'),
                'pain_points': company_info.get('common_pain_points', ['Lead Generation', 'Online Visibility']), 
                'growth_potential': 'High',
                'online_presence': {'seo_status': 'Needs improvement'}
            }
            # Build dynamic service recommendations from AI knowledge
            growth_opps = company_info.get('growth_opportunities', [])
            recommended_services = []
            for opp in growth_opps[:3]:
                recommended_services.append({
                    'service_name': opp,
                    'why_relevant': f"Based on {company_info.get('likely_industry', 'industry')} dynamics and {company_name}'s market position",
                    'expected_impact': 'Increased organic visibility, traffic and qualified leads'
                })
            if not recommended_services:
                recommended_services = [
                    {'service_name': 'Organic SEO', 'why_relevant': 'Improve online visibility and search rankings', 'expected_impact': 'More qualified leads from search'},
                    {'service_name': 'Local SEO', 'why_relevant': 'Dominate local search results', 'expected_impact': 'Increased local customer acquisition'}
                ]
            service_matches = {
                'recommended_services': recommended_services,
                'email_hook': f'Growth opportunities for {company_info.get("likely_industry", "your business")}',
                'package_suggestion': 'Growth'
            }

        # Extract dynamically found primary email from AI contacts if available
        ai_extracted_email = None
        if company_info and company_info.get("contacts"):
            for c in company_info["contacts"]:
                if c.get("email") and "@" in c["email"]:
                    ai_extracted_email = c["email"]
                    break
        
        # Determine the best email to use
        final_email = ai_extracted_email or primary_email or ""
        
        contact = {'name': company_name, 'email': final_email, 'role': 'Decision Maker'}
        email_draft = await run_in_threadpool(
            generate_serp_hawk_email,
            company_info, market_analysis, service_matches, contact
        )
        
        if email_draft:
            subject = email_draft.get('subject', subject)
            body_html = email_draft.get('body_html', body_html)

        # Get services string
        services = service_matches.get('recommended_services', [])
        service_names = [s.get('service_name') for s in services]
        recommended_services_str = ", ".join(service_names) if service_names else None

        return JSONResponse({
            'success': True,
            'draft': {
                'subject': subject,
                'body': body_html,
                'company_name': company_name,
                'website_url': normalized_url,
                'primary_email': final_email, # Return the dynamically extracted email
                'recommended_services': recommended_services_str
            }
        })

    except Exception as e:
        traceback.print_exc()
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


@app.post("/send-lead")
async def send_lead_merged(data: dict = Body(...), session: Session = Depends(get_session)):
    """
    Master Route for SERP Hawk Lead Processing:
    1. Sends Outbound/Inbound emails (if not manual)
    2. Creates/Updates ClientProfile
    3. Saves to SentEmail (bilingual history)
    4. Records ActivityLog
    5. Syncs to Company & EmailLog
    """
    try:
        company_name = data.get('company_name', 'Unknown')
        email = data.get('primary_email')
        website_url = data.get('website_url')
        outreach = data.get('outreach', {})
        inbound = data.get('inbound', {})
        is_manual = data.get('manual', False)
        recommended_services_str = data.get('recommended_services', '')
        if not email:
            if is_manual:
                # If they just want to log it manually and the scraper couldn't find an email,
                # generate a placeholder to satisfy the CRM's strict email requirements.
                import uuid
                email = f"unknown_contact_{uuid.uuid4().hex[:8]}@placeholder.com"
            else:
                return JSONResponse({'success': False, 'error': 'Target email is required to send emails. Please provide an email or choose Log Manually.'}, status_code=400)

        # 1. Email Sending Logic
        outbound_sent = False
        inbound_sent = False

        if not is_manual and OUTLOOK_EMAIL and OUTLOOK_PASSWORD:
            try:
                # Outbound
                send_email_outlook(
                    to_email=email,
                    subject=outreach.get('subject', f"Partnership Opportunity with {company_name}"),
                    body=outreach.get('english_body') or outreach.get('body', ''),
                    sender_email=OUTLOOK_EMAIL,
                    sender_password=OUTLOOK_PASSWORD,
                    smtp_server=SMTP_SERVER,
                    smtp_port=SMTP_PORT,
                    html=True,
                    imap_server=IMAP_SERVER
                )
                outbound_sent = True

                # Inbound (Simulated reply)
                send_email_outlook(
                    to_email=email, 
                    subject=inbound.get('subject', f"Inquiry regarding {company_name}"),
                    body=inbound.get('english_body') or inbound.get('body', ''),
                    sender_email=OUTLOOK_EMAIL,
                    sender_password=OUTLOOK_PASSWORD,
                    smtp_server=SMTP_SERVER,
                    smtp_port=SMTP_PORT,
                    html=True,
                    imap_server=IMAP_SERVER
                )
                inbound_sent = True
            except Exception as e:
                print(f"SMTP Error: {e}")
        else:
            print(f"Manual/Simulated Send Mode for {email}")
            outbound_sent = True
            inbound_sent = True

        # 2. Client Profile Persistence
        stmt = select(User).where(User.email == email)
        user = session.exec(stmt).first()
        if not user:
            user = User(email=email, password="password123", name=company_name, role="Client")
            session.add(user)
            session.commit()
            session.refresh(user)

        stmt_profile = select(ClientProfile).where(ClientProfile.userId == user.id)
        profile = session.exec(stmt_profile).first()
        
        if not profile:
            profile = ClientProfile(
                userId=user.id,
                companyName=company_name,
                websiteUrl=website_url,
                status="Active",
                recommended_services=recommended_services_str,
                services_offered=recommended_services_str,
                outbound_email_sent=outbound_sent,
                inbound_email_sent=inbound_sent
            )
            session.add(profile)
        else:
            profile.outbound_email_sent = outbound_sent
            profile.inbound_email_sent = inbound_sent
            if recommended_services_str:
                profile.recommended_services = recommended_services_str
                profile.services_offered = recommended_services_str
            session.add(profile)
        
        session.commit()
        session.refresh(profile)

        # 3. SentEmail Persistence (Bilingual History)
        # Store both outreach and inbound as separate entries or one combined? 
        # Requirement: "1st para eng, 2nd para span". 
        # We'll store the Outreach specifically as the bilingual record for the History tab.
        sent_record = SentEmail(
            client_id=profile.id,
            to_email=email,
            subject=outreach.get('subject', 'Outreach'),
            english_body=outreach.get('english_body') or outreach.get('body', ''),
            spanish_body=outreach.get('spanish_body', ''),
            sent_at=datetime.utcnow()
        )
        session.add(sent_record)

        # 4. Activity Logs
        activity = ActivityLog(
            userId=user.id,
            clientId=profile.id,
            action="Outreach Campaign",
            method="Email",
            content=f"{'[MANUAL] ' if is_manual else ''}Sent Outreach to {email}. Outcome: {outbound_sent}",
            details=f"Services: {recommended_services_str}",
            createdAt=datetime.utcnow()
        )
        session.add(activity)

        # 5. Company & EmailLog Sync
        try:
            from sqlalchemy import or_
            company_stmt = select(Company).where(or_(Company.primary_email == email, Company.website_url == website_url))
            existing_company = session.exec(company_stmt).first()
            
            if existing_company:
                existing_company.email_sent_status = outbound_sent
                if recommended_services_str:
                    existing_company.recommended_services = recommended_services_str
                session.add(existing_company)
                comp_id = existing_company.id
            else:
                new_comp = Company(
                    company_name=company_name,
                    website_url=website_url,
                    primary_email=email,
                    recommended_services=recommended_services_str,
                    email_sent_status=outbound_sent
                )
                session.add(new_comp)
                session.commit()
                session.refresh(new_comp)
                comp_id = new_comp.id

            # Add to EmailLog for rate limit tracking
            elog = EmailLog(
                company_id=comp_id,
                sender_email=OUTLOOK_EMAIL or "system@serphawk.ai",
                subject=outreach.get('subject', 'Outreach'),
                content=outreach.get('body', ''),
                sent_at=datetime.utcnow()
            )
            session.add(elog)
        except Exception as e:
            print(f"Company Sync Error: {e}")

        session.commit()

        return JSONResponse({
            'success': True,
            'outbound_sent': outbound_sent,
            'inbound_sent': inbound_sent,
            'client_id': profile.id
        })

    except Exception as e:
        traceback.print_exc()
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)



@app.get("/activities")
async def get_activities(limit: int = 10, session: Session = Depends(get_session)):
    """
    Fetch recent outreach from EmailLog joined with Company to get full email content and subjects
    """
    try:
        statement = (
            select(EmailLog, Company)
            .join(Company, EmailLog.company_id == Company.id)
            .order_by(EmailLog.sent_at.desc())
            .limit(limit)
        )
        results = session.exec(statement).all()
        
        activities = []
        for log, company in results:
            activities.append({
                'id': str(log.id),
                'company_name': company.company_name,
                'website_url': company.website_url,
                'email': log.sender_email, # or company.primary_email depending on what we want to show
                'recipient_email': company.primary_email,
                'sent_at': log.sent_at.isoformat() if log.sent_at else datetime.now().isoformat(),
                'status': 'Sent', 
                'recommended_services': company.recommended_services or '-',
                'subject': log.subject,
                'content': log.content
            })
            
        return JSONResponse({'activities': activities})
    except Exception as e:
        print(f"Error fetching activities: {e}")
        return JSONResponse({'activities': [], 'error': str(e)})


# ============================================================================
# AI ROUTES - SERP Hawk Logic
# ============================================================================

@app.post("/generate")
async def generate_ai_analysis(data: dict):
    """
    Complete SERP Hawk outreach workflow:
    1. Scrape website
    2. Analyze company
    3. Analyze market & competitors
    4. Match services
    5. Generate email
    6. Create image
    """
    urls = data.get('urls', [])
    results = []

    for url in urls:
        try:
            print(f"Processing: {url}")
            
            # Step 1: Scrape
            try:
                scraped_text = await run_in_threadpool(sync_scrape_website_wrapper, url)
                has_error = not scraped_text or "ERROR SCRAPING" in scraped_text.upper()
            except Exception as e:
                import traceback
                print(f"Exception during scraping {url}: {e}")
                scraped_text = f"ERROR SCRAPING: {str(e)}"
                has_error = True
            
            if has_error:
                # Try to derive a name from the URL for the fallback
                derived_name = url.split('//')[-1].split('/')[0].replace('www.', '').split('.')[0].replace('-', ' ').title()
                company_info = await run_in_threadpool(analyze_company_name_fallback, derived_name)
                company_name = company_info.get('company_name', derived_name)
                # IMPORTANT: inject company_name so the email generator doesn't default to 'your company'
                company_info['company_name'] = company_name
                company_info.setdefault('contacts', [])
                
                market_analysis = {
                    'industry': company_info.get('likely_industry', 'Unknown'), 
                    'sub_category': company_info.get('sub_category', ''),
                    'business_model': company_info.get('business_model', 'B2B'),
                    'pain_points': company_info.get('common_pain_points', ['Lead Generation', 'Online Visibility']), 
                    'growth_potential': 'High',
                    'online_presence': {'seo_status': 'Needs improvement'}
                }
                # Build dynamic service recommendations from AI knowledge
                growth_opps = company_info.get('growth_opportunities', [])
                recommended_services = []
                for opp in growth_opps[:3]:
                    recommended_services.append({
                        'service_name': opp,
                        'why_relevant': f"Based on {company_info.get('likely_industry', 'industry')} dynamics and {company_name}'s market position",
                        'expected_impact': 'Increased organic visibility, traffic and qualified leads'
                    })
                if not recommended_services:
                    recommended_services = [
                        {'service_name': 'Organic SEO', 'why_relevant': 'Improve online visibility and search rankings', 'expected_impact': 'More qualified leads from search'},
                        {'service_name': 'Local SEO', 'why_relevant': 'Dominate local search results', 'expected_impact': 'Increased local customer acquisition'}
                    ]
                service_matches = {
                    'recommended_services': recommended_services,
                    'email_hook': f'Growth opportunities for {company_info.get("likely_industry", "your business")}',
                    'package_suggestion': 'Growth'
                }
            else:
                # Step 2: Analyze company
                company_info = await run_in_threadpool(analyze_content, scraped_text)
                company_name = company_info.get('company_name', 'Unknown Company')

                # Step 3: Market analysis
                market_analysis = await run_in_threadpool(analyze_market, scraped_text, company_name)

                # Step 4: Match services
                service_matches = await run_in_threadpool(match_services, market_analysis, company_info)

            # Step 5: Generate email
            contacts = company_info.get('contacts', [])
            generated_emails = []
            
            if contacts:
                for contact in contacts:
                    # Type 1: Outreach (Offering)
                    outreach_draft = await run_in_threadpool(
                        generate_serp_hawk_email,
                        company_info, market_analysis, service_matches, contact, "outreach"
                    )
                    # Type 2: Inbound (Requesting)
                    inbound_draft = await run_in_threadpool(
                        generate_serp_hawk_email,
                        company_info, market_analysis, service_matches, contact, "inbound"
                    )
                    
                    generated_emails.append({
                        'to_email': contact.get('email', ''),
                        'recipient_name': contact.get('name'),
                        'role': contact.get('role'),
                        'outreach': {
                            'subject': outreach_draft.get('subject'),
                            'body': outreach_draft.get('body', outreach_draft.get('body_html', '')),
                            'english_body': outreach_draft.get('english_body', ''),
                            'spanish_body': outreach_draft.get('spanish_body', ''),
                        },
                        'inbound': {
                            'subject': inbound_draft.get('subject'),
                            'body': inbound_draft.get('body', inbound_draft.get('body_html', '')),
                            'english_body': inbound_draft.get('english_body', ''),
                            'spanish_body': inbound_draft.get('spanish_body', ''),
                        }
                    })
            else:
                # Type 1: Outreach (Offering)
                outreach_draft = await run_in_threadpool(
                    generate_serp_hawk_email,
                    company_info, market_analysis, service_matches, None, "outreach"
                )
                # Type 2: Inbound (Requesting)
                inbound_draft = await run_in_threadpool(
                    generate_serp_hawk_email,
                    company_info, market_analysis, service_matches, None, "inbound"
                )
                
                generated_emails.append({
                    'to_email': '', 
                    'recipient_name': 'General',
                    'role': 'N/A',
                    'outreach': {
                        'subject': outreach_draft.get('subject'),
                        'body': outreach_draft.get('body', outreach_draft.get('body_html', '')),
                        'english_body': outreach_draft.get('english_body', ''),
                        'spanish_body': outreach_draft.get('spanish_body', ''),
                    },
                    'inbound': {
                        'subject': inbound_draft.get('subject'),
                        'body': inbound_draft.get('body', inbound_draft.get('body_html', '')),
                        'english_body': inbound_draft.get('english_body', ''),
                        'spanish_body': inbound_draft.get('spanish_body', ''),
                    }
                })

            # Step 6: Generate beautiful email image
            services = service_matches.get('recommended_services', [])
            
            safe_company_name = "".join(c for c in company_name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_company_name = safe_company_name.replace(' ', '_')[:50]
            
            image_filename = f"{safe_company_name}_email_image.html"
            image_path = os.path.join('static', 'generated_images', image_filename)
            
            generated_image = await run_in_threadpool(
                generate_email_image,
                company_name, services, image_path
            )

            results.append({
                'url': url,
                'analysis': {
                    'company_name': company_name,
                    'what_they_do': company_info.get('summary', 'Analysis available'),
                    'contacts': contacts,
                    'error': scraped_text if has_error else None
                },
                'emails': generated_emails,
                'recommended_services': ", ".join([s.get('service_name', '') for s in service_matches.get('recommended_services', [])]) if service_matches.get('recommended_services') else None,
                'image_url': f'/static/generated_images/{image_filename}' if generated_image else None,
                'error': scraped_text if has_error else None
            })

        except Exception as e:
            traceback.print_exc()
            results.append({'url': url, 'error': str(e)})

    return JSONResponse(results)


@app.post("/send")
async def send_email_api(data: dict, session: Session = Depends(get_session)):
    """
    Send email using credentials and log to DB (AI Outreach version)
    """
    email_data = data.get('email_data')
    if not email_data:
        return JSONResponse({'success': False, 'error': 'No email data provided'}, status_code=400)

    sender_email = OUTLOOK_EMAIL
    sender_password = OUTLOOK_PASSWORD
    
    if not sender_email or not sender_password:
        return JSONResponse({'success': False, 'error': 'Email credentials not configured in .env'}), 500

    try:
        # Check eligibility/rate limit before sending
        # Note: We need a URL to check duplicates, but the AI UI sends email_data directly.
        # We'll treat this as "Ad-hoc" send, but still rate limit.
        
        # Rate Limit Check
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        rate_statement = select(func.count(EmailLog.id)).where(
            EmailLog.sender_email == SENDER_EMAIL,
            EmailLog.sent_at > one_hour_ago
        )
        emails_sent_count = session.exec(rate_statement).one()
        
        if emails_sent_count >= HOURLY_EMAIL_LIMIT:
             return JSONResponse({'success': False, 'error': 'Hourly rate limit exceeded'}, status_code=429)

        # Send Email
        await run_in_threadpool(
            send_email_outlook,
            to_email=email_data['to_email'],
            subject=email_data['subject'],
            body=email_data['body'],
            sender_email=sender_email,
            sender_password=sender_password,
            smtp_server=SMTP_SERVER,
            smtp_port=SMTP_PORT,
            html=True
        )
        
        # Log to DB
        # We might not have a Company ID if it came from the AI tool randomly.
        # For now, we'll try to find a company by email or create a "clean" one if needed.
        # But to avoid complexity, we can just log the rate limit and maybe create a minimal company.
        
        # Try to find company by email
        statement = select(Company).where(Company.primary_email == email_data['to_email'])
        company = session.exec(statement).first()
        
        if not company:
            # Create a shell company entry for logging purposes
            company = Company(
                company_name="AI Outreach Contact",
                website_url=f"ai-generated-{uuid.uuid4()}@example.com", # Placeholder
                primary_email=email_data['to_email'],
                email_sender=SENDER_EMAIL,
                email_sent_status=True
            )
            session.add(company)
            session.commit()
            session.refresh(company)
        else:
            company.email_sent_status = True
            session.add(company)
            session.commit()

        # Log to EmailLog (rate limiting)
        email_log = EmailLog(
            company_id=company.id,
            sender_email=SENDER_EMAIL,
            sent_at=datetime.utcnow(),
            subject=email_data['subject'],
            content=email_data['body']
        )
        session.add(email_log)

        # Persist to SentEmail with bilingual bodies
        # Try to find a matching ClientProfile by email
        client_profile_stmt = select(ClientProfile).join(User).where(User.email == email_data['to_email'])
        client_profile = session.exec(client_profile_stmt).first()

        sent_email = SentEmail(
            client_id=client_profile.id if client_profile else None,
            to_email=email_data['to_email'],
            subject=email_data['subject'],
            english_body=email_data.get('english_body', email_data.get('body', '')),
            spanish_body=email_data.get('spanish_body', ''),
        )
        session.add(sent_email)
        session.commit()

        return JSONResponse({'success': True})
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)

# Duplicate route removed to prevent inconsistent behavior


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    loop_type = "Unknown"
    try:
        loop_type = type(asyncio.get_running_loop()).__name__
    except:
        pass
        
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Cold Outreach CRM + AI",
        "loop": loop_type,
        "platform": sys.platform
    }


# ============================================================================
# CALL TRACKING ROUTES
# ============================================================================

class CallLogCreate(BaseModel):
    phone_number: str
    duration_seconds: Optional[int] = None
    client_id: Optional[int] = None
    description: Optional[str] = None
    work_done: Optional[str] = None
    assigned_to: Optional[str] = None
    followup_needed: bool = False
    followup_date: Optional[str] = None

@app.post("/calls")
async def log_call(data: CallLogCreate, session: Session = Depends(get_session)):
    """Log an incoming/outgoing call"""
    call = CallLog(
        phone_number=data.phone_number,
        duration_seconds=data.duration_seconds,
        client_id=data.client_id,
        description=data.description,
        work_done=data.work_done,
        assigned_to=data.assigned_to,
        followup_needed=data.followup_needed,
        followup_date=data.followup_date,
    )
    session.add(call)
    session.commit()
    session.refresh(call)
    return {"success": True, "id": call.id}

def _call_to_dict(c: CallLog):
    return {
        "id": c.id,
        "phone_number": c.phone_number,
        "received_at": c.received_at.isoformat(),
        "duration_seconds": c.duration_seconds,
        "summary": c.summary,
        "description": c.description,
        "work_done": c.work_done,
        "assigned_to": c.assigned_to,
        "followup_needed": c.followup_needed,
        "followup_date": c.followup_date,
        "client_id": c.client_id,
    }

@app.get("/calls")
async def list_calls(unsummarized: bool = False, session: Session = Depends(get_session)):
    """List all calls, optionally only those without summaries"""
    stmt = select(CallLog).order_by(CallLog.received_at.desc())
    if unsummarized:
        stmt = stmt.where(CallLog.summary == None)
    calls = session.exec(stmt).all()
    return {"calls": [_call_to_dict(c) for c in calls]}

@app.patch("/calls/{call_id}/summary")
async def add_call_summary(call_id: int, data: dict, session: Session = Depends(get_session)):
    """Add or update call summary"""
    call = session.get(CallLog, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    call.summary = data.get("summary", "")
    session.add(call)
    session.commit()
    return {"success": True}

@app.patch("/calls/{call_id}")
async def update_call(call_id: int, data: dict, session: Session = Depends(get_session)):
    """Update all call log fields"""
    call = session.get(CallLog, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    for field in ["summary", "description", "work_done", "assigned_to", "followup_needed", "followup_date"]:
        if field in data:
            setattr(call, field, data[field])
    session.add(call)
    session.commit()
    return {"success": True, "call": _call_to_dict(call)}


@app.get("/activities")
async def list_all_activities(session: Session = Depends(get_session)):
    """List all global activities for the Outreach Agent history"""
    # Merge ActivityLog and SentEmail for a complete picture
    stmt = select(ActivityLog).order_by(ActivityLog.id.desc()).limit(50)
    acts = session.exec(stmt).all()
    
    results = []
    for a in acts:
        # Try to find associated client for company name/email
        client_name = "Unknown"
        client_email = ""
        if a.clientId:
            client = session.get(ClientProfile, a.clientId)
            if client:
                client_name = client.companyName
                if client.user:
                    client_email = client.user.email
        
        # Parse subject from content if possible
        subject = ""
        if a.content:
            if "Subject: " in a.content:
                subject = a.content.split("Subject: ")[1].split("\n")[0]
            elif "Sent Email: " in a.content:
                subject = a.content.split("Sent Email: ")[1].split("\n")[0]
            
        results.append({
            "id": f"act-{a.id}",
            "company_name": client_name,
            "email": client_email or a.method or "Email",
            "recommended_services": "", # Placeholder
            "sent_at": a.createdAt.isoformat(),
            "status": "Delivered",
            "subject": subject or a.action,
            "content": a.content
        })
        
    return {"activities": results}


# ============================================================================
# SENT EMAIL HISTORY ROUTES
# ============================================================================

@app.get("/clients/{client_id}/emails")
async def get_client_emails(client_id: int, session: Session = Depends(get_session)):
    """Get all sent emails for a specific client"""
    stmt = select(SentEmail).where(SentEmail.client_id == client_id).order_by(SentEmail.sent_at.desc())
    emails = session.exec(stmt).all()
    return {"emails": [
        {
            "id": e.id,
            "to_email": e.to_email,
            "subject": e.subject,
            "english_body": e.english_body,
            "spanish_body": e.spanish_body,
            "sent_at": e.sent_at.isoformat(),
        }
        for e in emails
    ]}

@app.get("/dashboard-stats")
async def get_dashboard_stats(role: str, email: str, session: Session = Depends(get_session)):
    """Fetch stats for the dashboard based on role"""
    if role in ('Admin', 'Employee'):
        total_clients = session.exec(select(func.count(ClientProfile.id))).one()
        active_clients = session.exec(select(func.count(ClientProfile.id)).where(ClientProfile.status == 'Active')).one()
        pending_clients = session.exec(select(func.count(ClientProfile.id)).where(ClientProfile.status == 'Pending')).one()
        hold_clients = session.exec(select(func.count(ClientProfile.id)).where(ClientProfile.status == 'Hold')).one()
        total_projects = session.exec(select(func.count(Project.id))).one()
        total_emails_sent = session.exec(select(func.count(EmailLog.id))).one()
        total_activities = session.exec(select(func.count(ActivityLog.id))).one()
        total_calls = session.exec(select(func.count(CallLog.id))).one()
        total_employees = session.exec(select(func.count(User.id)).where(User.role == 'Employee')).one()
        total_interns = session.exec(select(func.count(User.id)).where(User.role == 'Intern')).one()

        # Build 7-day chart data
        from datetime import date, timedelta
        today = date.today()
        chart_labels = []
        activity_counts = []
        email_counts = []
        call_counts = []

        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_start = datetime.combine(day, datetime.min.time())
            day_end = datetime.combine(day, datetime.max.time())

            act_count = session.exec(
                select(func.count(ActivityLog.id)).where(
                    ActivityLog.createdAt >= day_start,
                    ActivityLog.createdAt <= day_end
                )
            ).one()

            email_count = session.exec(
                select(func.count(EmailLog.id)).where(
                    EmailLog.sent_at >= day_start,
                    EmailLog.sent_at <= day_end
                )
            ).one()

            call_count = session.exec(
                select(func.count(CallLog.id)).where(
                    CallLog.received_at >= day_start,
                    CallLog.received_at <= day_end
                )
            ).one()

            chart_labels.append(day.strftime("%a"))
            activity_counts.append(act_count)
            email_counts.append(email_count)
            call_counts.append(call_count)

        # Recent activities
        recent_stmt = select(ActivityLog).order_by(ActivityLog.id.desc()).limit(5)
        recent_activities = session.exec(recent_stmt).all()

        return {
            "total": total_clients,
            "active": active_clients,
            "pending": pending_clients,
            "hold": hold_clients,
            "totalProjects": total_projects,
            "totalEmailsSent": total_emails_sent,
            "totalActivities": total_activities,
            "totalCalls": total_calls,
            "totalEmployees": total_employees,
            "totalInterns": total_interns,
            "chartLabels": chart_labels,
            "activityChart": activity_counts,
            "emailChart": email_counts,
            "callChart": call_counts,
            "recentActivities": [
                {
                    "id": a.id,
                    "action": a.action,
                    "method": a.method,
                    "content": a.content,
                    "createdAt": a.createdAt.isoformat() if a.createdAt else None
                }
                for a in recent_activities
            ]
        }
    else:
        profile_stmt = select(ClientProfile).join(User).where(User.email == email)
        profile = session.exec(profile_stmt).first()
        if not profile:
            return {"error": "Profile not found"}
        return {
            "isClient": True,
            "companyName": profile.companyName,
            "projectName": profile.projectName,
            "website": profile.websiteUrl,
            "status": profile.status,
            "seoStrategy": profile.seoStrategy,
            "recommended_services": profile.recommended_services,
            "targetKeywords": profile.targetKeywords or [],
            "nextMilestone": profile.nextMilestone,
            "nextMilestoneDate": profile.nextMilestoneDate,
        }



# ============================================================================
# CLIENT STATUS ROUTES
# ============================================================================

class ClientStatusCreate(BaseModel):
    name: str
    color: Optional[str] = "bg-gray-500"

@app.get("/client-statuses")
async def get_client_statuses(session: Session = Depends(get_session)):
    """Get all available client statuses"""
    statement = select(ClientStatus).order_by(ClientStatus.name)
    statuses = session.exec(statement).all()
    return {"statuses": [
        {"id": s.id, "name": s.name, "color": s.color} 
        for s in statuses
    ]}

@app.post("/client-statuses")
async def create_client_status(data: ClientStatusCreate, session: Session = Depends(get_session)):
    """Add a new client status option"""
    try:
        status = ClientStatus(name=data.name, color=data.color)
        session.add(status)
        session.commit()
        return {"success": True, "status": {"id": status.id, "name": status.name, "color": status.color}}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/client-statuses/{status_id}")
async def delete_client_status(status_id: int, session: Session = Depends(get_session)):
    """Remove a client status option"""
    status = session.get(ClientStatus, status_id)
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")
        
    session.delete(status)
    session.commit()
    return {"success": True}


# ============================================================================
# CLIENT PROFILE ROUTES
# ============================================================================

@app.get("/clients")
async def list_clients(status: Optional[str] = None, session: Session = Depends(get_session)):
    """List all client profiles with filters"""
    # Use eager loading/joins to prevent N+1 queries when accessing p.user
    from sqlalchemy.orm import selectinload
    statement = select(ClientProfile).options(selectinload(ClientProfile.user))
    
    if status and status != 'All':
        statement = statement.where(ClientProfile.status == status)
    
    profiles = session.exec(statement).all()
    results = []
    for p in profiles:
        # User relation is now eager-loaded, avoiding DB roundtrip here
        user_email = p.user.email if (p.user and hasattr(p.user, 'email')) else "N/A"
        results.append({
            "id": p.id,
            "projectName": p.projectName or p.companyName,
            "category": p.seoStrategy or "Software Training Institute", # Placeholder category
            "email": user_email,
            "status": p.status,
            "keywords": p.targetKeywords or [],
            "website": p.websiteUrl
        })
    return {"clients": results}

@app.get("/employees")
async def list_employees(session: Session = Depends(get_session)):
    """List all users with role 'Employee' or 'Admin'"""
    statement = select(User).where(User.role.in_(['Employee', 'Admin']))
    users = session.exec(statement).all()
    return {"employees": [{"id": u.id, "name": u.name, "email": u.email, "role": u.role} for u in users]}

@app.put("/clients/{client_id}/assign-employee")
async def assign_employee(client_id: int, employee_id: int = Body(..., embed=True), session: Session = Depends(get_session)):
    """Assign an employee to a client"""
    client = session.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    employee = session.get(User, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    client.assignedEmployeeId = employee_id
    session.add(client)
    session.commit()
    return {"success": True, "assigned_to": employee.name}

@app.get("/projects")
async def list_projects(session: Session = Depends(get_session)):
    """List all projects with basic details"""
    statement = select(Project)
    projects = session.exec(statement).all()
    return {"projects": projects}

@app.post("/projects")
async def create_project(data: ProjectCreate, session: Session = Depends(get_session)):
    """Create a new advanced project"""
    project = Project(**data.model_dump())
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@app.get("/projects/{project_id}")
async def get_project_detail_view(project_id: int, session: Session = Depends(get_session)):
    """Get full details of a project including remarks and team"""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Get remarks
    remarks_stmt = select(Remark).where(Remark.projectId == project_id).order_by(Remark.createdAt.desc())
    remarks_list = session.exec(remarks_stmt).all()
    
    # Get assigned team details
    employees = session.exec(select(User).where(User.id.in_(project.employeeIds))).all() if project.employeeIds else []
    interns = session.exec(select(User).where(User.id.in_(project.internIds))).all() if project.internIds else []
    
    return {
        "project": project,
        "remarks": remarks_list,
        "team": {
            "employees": [{"id": e.id, "name": e.name, "email": e.email} for e in employees],
            "interns": [{"id": i.id, "name": i.name, "email": i.email} for i in interns]
        }
    }

@app.patch("/projects/{project_id}")
async def update_project(project_id: int, data: ProjectUpdate, session: Session = Depends(get_session)):
    """Update project progress, status, or assignments"""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    
    project.updatedAt = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@app.post("/projects/{project_id}/remarks")
async def add_project_remark(project_id: int, data: ProjectRemarkAdd, author_id: int = Body(..., embed=True), session: Session = Depends(get_session)):
    """Add a comment/remark to a project"""
    remark = Remark(
        content=data.content,
        projectId=project_id,
        authorId=author_id,
        isInternal=data.isInternal
    )
    session.add(remark)
    session.commit()
    session.refresh(remark)
    return remark

@app.get("/interns")
async def list_interns(session: Session = Depends(get_session)):
    """List all users with role 'Intern'"""
    statement = select(User).where(User.role == 'Intern')
    users = session.exec(statement).all()
    return {"interns": [{"id": u.id, "name": u.name, "email": u.email, "role": u.role} for u in users]}

@app.post("/users")
async def create_user(data: UserCreate, session: Session = Depends(get_session)):
    """Create a new user (Intern/Employee/Admin)"""
    # Check if user exists
    stmt = select(User).where(User.email == data.email)
    existing = session.exec(stmt).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user = User(
        name=data.name,
        email=data.email,
        password=data.password, # Note: Should be hashed in real app
        role=data.role
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, session: Session = Depends(get_session)):
    """Delete a user"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"success": True}

@app.patch("/clients/{client_id}")
async def update_client_profile(client_id: int, data: ClientUpdate, session: Session = Depends(get_session)):
    """Update specific fields of a client profile"""
    profile = session.get(ClientProfile, client_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Client not found")
        
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)
        
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile

@app.post("/clients/{client_id}/keywords")
async def add_keyword(client_id: int, keyword: str = Body(..., embed=True), session: Session = Depends(get_session)):
    """Add a target keyword to client profile"""
    client = session.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    current_keywords = list(client.targetKeywords) if client.targetKeywords else []
    if keyword not in current_keywords:
        current_keywords.append(keyword)
        client.targetKeywords = current_keywords
        session.add(client)
        session.commit()
        
    return {"success": True, "keywords": client.targetKeywords}

@app.delete("/clients/{client_id}/keywords")
async def remove_keyword(client_id: int, keyword: str = Body(..., embed=True), session: Session = Depends(get_session)):
    """Remove a target keyword from client profile"""
    client = session.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    current_keywords = list(client.targetKeywords) if client.targetKeywords else []
    if keyword in current_keywords:
        current_keywords.remove(keyword)
        client.targetKeywords = current_keywords
        session.add(client)
        session.commit()
        
    return {"success": True, "keywords": client.targetKeywords}

@app.get("/clients/{client_id}")
async def get_client_detail(client_id: int, session: Session = Depends(get_session)):
    """Get detailed profile for a specific client"""
    from sqlalchemy.orm import selectinload
    statement = select(ClientProfile).where(ClientProfile.id == client_id).options(selectinload(ClientProfile.user))
    profile = session.exec(statement).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get assigned employee details
    assigned_employee = None
    if profile.assignedEmployeeId:
        emp = session.get(User, profile.assignedEmployeeId)
        if emp:
            assigned_employee = {"id": emp.id, "name": emp.name, "email": emp.email}

    return {
        "id": profile.id,
        "companyName": profile.companyName,
        "website": profile.websiteUrl,
        "address": profile.address,
        "phone": profile.phone,
        "email": profile.user.email if profile.user else "",
        "seoStrategy": profile.seoStrategy,
        "tagline": profile.tagline,
        "projectName": profile.projectName,
        "gmbName": profile.gmbName,
        "targetKeywords": profile.targetKeywords or [],
        "assignedEmployee": assigned_employee,
        "status": profile.status,
        "recommended_services": profile.recommended_services,
        "nextMilestone": profile.nextMilestone,
        "nextMilestoneDate": profile.nextMilestoneDate
    }

# ============================================================================
# DOCUMENT OCR ROUTES
# ============================================================================

from modules.llm_engine import analyze_document

@app.post("/documents/ocr")
async def ocr_document(file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Upload an image and extract details using OCR"""
    try:
        contents = await file.read()
        result = analyze_document(contents)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clients")
async def create_client(
    data: ClientCreate,
    session: Session = Depends(get_session)
):
    """Manually create a new client and user"""
    # 1. Ensure User exists
    user_stmt = select(User).where(User.email == data.email)
    user = session.exec(user_stmt).first()
    if not user:
        user = User(email=data.email, password="password123", name=data.companyName, role="Client")
        session.add(user)
        session.commit()
        session.refresh(user)
    
    # 2. Create Profile
    profile = ClientProfile(
        userId=user.id,
        companyName=data.companyName,
        websiteUrl=data.websiteUrl,
        customFields={},
        status="Active",
        projectName=data.projectName,
        gmbName=data.gmbName,
        seoStrategy=data.seoStrategy,
        tagline=data.tagline,
        recommended_services=data.recommended_services,
        targetKeywords=data.targetKeywords or []
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    
    return {"id": profile.id, "companyName": profile.companyName, "status": "created"}

@app.post("/clients/{client_id}/activities")
async def add_client_activity(
    client_id: int,
    data: ActivityAdd,
    session: Session = Depends(get_session)
):
    """Add a manual activity for a client"""
    activity = ActivityLog(
        clientId=client_id,
        userId=None,
        action="Manual Activity",
        method=data.method,
        content=data.content,
        createdAt=datetime.utcnow()
    )
    session.add(activity)
    
    # Update ClientProfile lastActivity
    client = session.get(ClientProfile, client_id)
    if client:
        client.lastActivity = f"Manual Activity: {data.method} - {data.content[:50]}..."
        client.lastActivityDate = datetime.utcnow().isoformat()
        session.add(client)
        
    session.commit()
    return {"success": True}

@app.get("/clients/{client_id}/activities")
async def get_client_activities(
    client_id: int, 
    limit: int = 50,
    session: Session = Depends(get_session)
):
    """Get activities for a specific client with pagination"""
    statement = select(ActivityLog).where(ActivityLog.clientId == client_id).order_by(ActivityLog.createdAt.desc()).limit(limit)
    activities = session.exec(statement).all()
    return {"activities": [
        {
            "id": a.id,
            "method": a.method,
            "content": a.content,
            "createdAt": a.createdAt.isoformat()
        } for a in activities
    ]}

@app.post("/clients/{client_id}/remarks")
async def add_remark(client_id: int, data: RemarkAdd, session: Session = Depends(get_session)):
    """Add a remark for a client"""
    remark = Remark(
        content=data.content,
        clientId=client_id,
        authorId=None,
        isInternal=True
    )
    session.add(remark)
    session.commit()
    return {"success": True}

@app.get("/clients/{client_id}/remarks")
async def get_client_remarks(
    client_id: int, 
    limit: int = 50,
    session: Session = Depends(get_session)
):
    """Get remarks for a specific client with pagination"""
    statement = select(Remark).where(Remark.clientId == client_id).order_by(Remark.createdAt.desc()).limit(limit)
    remarks = session.exec(statement).all()
    return {"remarks": [
        {
            "id": r.id,
            "content": r.content,
            "createdAt": r.createdAt.isoformat()
        } for r in remarks
    ]}


@app.post("/clients/{client_id}/send-email")
async def send_client_email(
    client_id: int,
    data: EmailSend,
    session: Session = Depends(get_session)
):
    """Send an email to a client and log it as an activity"""
    profile = session.get(ClientProfile, client_id)
    if not profile or not profile.user:
        raise HTTPException(status_code=404, detail="Client or user not found")
    
    # In a real app, this would use an email service (SMTP/SendGrid)
    # For now we'll simulate success and log it
    print(f"📧 Sending email to {profile.user.email}...")
    print(f"Subject: {data.subject}")
    
    # Log as activity
    activity = ActivityLog(
        clientId=client_id,
        action="Manual Activity",
        method="Email",
        content=f"Sent Email: {data.subject}\n\n{data.body}",
        createdAt=datetime.utcnow()
    )
    session.add(activity)
    
    # Update ClientProfile lastActivity
    profile.lastActivity = f"Sent Email: {data.subject}"
    profile.lastActivityDate = datetime.utcnow().isoformat()
    session.add(profile)
    
    session.commit()
    
    return {"success": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
