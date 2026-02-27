import os
import json
from openai import OpenAI

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def analyze_market(website_content, company_name):
    """
    Analyzes market position using OpenAI.
    """
    try:
        client = get_openai_client()
        prompt = f"""Analyze this company's market position and return a JSON object.
Company: {company_name}
Content: {website_content[:10000]}

Return JSON with fields: industry, sub_category, business_model, pain_points (list), growth_potential, online_presence (object with seo_status).
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Market analysis error: {e}")
        return {
            "industry": "General Business",
            "sub_category": "",
            "business_model": "B2B",
            "pain_points": ["Lead Generation", "Online Visibility"],
            "growth_potential": "High",
            "online_presence": {"seo_status": "Needs improvement"},
            "error": str(e)
        }

def match_services(market_analysis, company_info):
    """
    Matches SERP Hawk services using OpenAI.
    """
    try:
        client = get_openai_client()
        serp_hawk_services = "1. Local SEO, 2. Organic SEO, 3. Social Media, 4. Meta Ads, 5. Google Ads, 6. Consulting, 7. Web Dev, 8. App Dev, 9. Automation"

        prompt = f"""Recommend services for {company_info.get('company_name')} based on their market analysis and return a JSON object.
Available SERP Hawk services: {serp_hawk_services}
Market analysis: {json.dumps(market_analysis)[:3000]}

Return JSON with fields:
- recommended_services: list of objects with service_name, why_relevant, expected_impact
- email_hook: a compelling hook sentence
- package_suggestion: a package name (Starter/Growth/Enterprise)
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Service matching error: {e}")
        return {
            "recommended_services": [
                {"service_name": "Organic SEO", "why_relevant": "Improve online visibility", "expected_impact": "More qualified leads"},
                {"service_name": "Local SEO", "why_relevant": "Dominate local search", "expected_impact": "Increased local customers"}
            ],
            "email_hook": "Growth opportunities for your business",
            "package_suggestion": "Growth",
            "error": str(e)
        }
