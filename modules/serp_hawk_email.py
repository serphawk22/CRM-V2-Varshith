import os
import json
from openai import OpenAI

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def generate_serp_hawk_email(company_info, market_analysis, service_matches, contact=None, draft_type="outreach"):
    """
    Generates a personalized bilingual B2B email using OpenAI.
    Para 1: English | Para 2: Spanish translation
    Returns: { subject, english_body, spanish_body, body, body_html }
    """
    try:
        client = get_openai_client()
        
        company_name = company_info.get('company_name', 'your company')
        industry = market_analysis.get('industry', 'your industry')
        services = service_matches.get('recommended_services', [])[:3]
        
        service_list = ", ".join(
            svc.get('service_name', '') for svc in services
        ) if services else "growth and digital marketing"
        
        salutation = f"Hi {contact.get('name').split()[0]}," if contact and contact.get('name') else f"Hi {company_name} Team,"

        if draft_type == "inbound":
            prompt = f"""
You are a professional bilingual email copywriter for SERP Hawk, represented by Team DaPros from Mexico.

Write a professional inquiry email expressing interest in {company_name}'s services in the {industry} sector.

Salutation: {salutation}

The email MUST have exactly TWO paragraphs:
- Paragraph 1: In ENGLISH. Open with genuine interest in their work. Mention a specific aspect of their business that makes them a great potential partner or client. Ask about their current challenges in a thoughtful way. Close with a clear call to action (e.g., schedule a discovery call).
- Paragraph 2: The EXACT SAME message translated to SPANISH.

End the email with:
"Warm regards,
Team DaPros from Mexico | SERP Hawk Digital Agency"

Return ONLY a JSON object with these fields:
{{
    "subject": "Subject line in English",
    "english_body": "Full paragraph 1 in English WITH the signature (plain text, no HTML tags)",
    "spanish_body": "Full paragraph 2 in Spanish WITH the Spanish signature (plain text, no HTML tags)"
}}
"""
        else:
            service_details = "\n".join([
                f"- {svc.get('service_name', '')}: {svc.get('why_relevant', '')} (Expected: {svc.get('expected_impact', '')})"
                for svc in services
            ]) if services else "- Organic SEO: Improve search rankings and qualified traffic\n- Local SEO: Capture local market dominance"

            prompt = f"""
You are an expert B2B sales email writer for SERP Hawk, a full-service digital marketing agency, represented by Team DaPros from Mexico.

Write a highly detailed, personalized, and persuasive cold outreach email to {company_name} in the {industry} industry.

Salutation: {salutation}

About SERP Hawk:
SERP Hawk is a digital growth agency specializing in helping businesses rank higher on search engines, acquire more customers, and grow their online revenue. Our core services include Organic SEO, Local SEO, Google Ads Management, Content Marketing, and Conversion Rate Optimization.

Recommended services for {company_name}:
{service_details}

The email MUST follow this structure with exactly TWO paragraphs:
- Paragraph 1 (ENGLISH): 
  * Open with a compelling observation about {company_name}'s specific situation in the {industry} space.
  * Clearly explain what SERP Hawk does and WHY it matters for their goals (drive traffic, conversions, revenue).
  * Describe the specific recommended services ({service_list}) and the measurable impact they can expect.
  * Include a clear, low-friction call to action (e.g., "I'd love to set up a free 15-minute discovery call this week — would that work for you?").
  * Close with: "Warm regards, Team DaPros from Mexico | SERP Hawk Digital Agency"
- Paragraph 2: The EXACT SAME message translated to SPANISH.

Be conversational, confident, and specific — not generic.

Return ONLY a JSON object with these fields:
{{
    "subject": "Compelling subject line in English (make it specific and benefit-focused)",
    "english_body": "Full detailed paragraph in English WITH the signature (plain text, no HTML tags)",
    "spanish_body": "Full detailed paragraph in Spanish WITH the Spanish signature (plain text, no HTML tags)"
}}
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional bilingual email copywriter for SERP Hawk. Return only valid JSON with the exact fields specified."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        english = result.get("english_body", "")
        spanish = result.get("spanish_body", "")
        combined = f"{english}\n\n{spanish}"
        
        return {
            "subject": result.get("subject", f"Growth Partnership with {company_name}"),
            "english_body": english,
            "spanish_body": spanish,
            # backward-compat keys
            "body": combined,
            "body_html": f"<p>{english}</p><p>{spanish}</p>",
        }
        
    except Exception as e:
        print(f"Error in OpenAI email generation: {e}")
        error_msg = f"Could not generate email: {str(e)}"
        return {
            "subject": f"Growth for {company_name}",
            "english_body": error_msg,
            "spanish_body": "",
            "body": error_msg,
            "body_html": f"<p>{error_msg}</p>"
        }
