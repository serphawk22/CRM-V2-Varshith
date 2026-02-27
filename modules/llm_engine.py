import os
from openai import OpenAI
import json

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def analyze_content(text):
    """
    Analyzes website text using OpenAI.
    """
    try:
        client = get_openai_client()
        prompt = f"""
        Analyze the following website content and return a JSON object with this exact structure:
        {{
            "company_name": "Name of the company",
            "what_they_do": "Brief summary of their business (2-3 sentences)",
            "contacts": [
                {{
                    "name": "Full Name",
                    "role": "Job Title",
                    "email": "Email address if found, else null",
                    "context": "Any specific context or null"
                }}
            ],
            "key_value_props": ["prop1", "prop2"]
        }}

        Website Content:
        {text[:15000]}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        print(f"Error in OpenAI analysis: {e}")
        return {
            "company_name": "Unknown",
            "what_they_do": "Analysis failed",
            "contacts": [],
            "error": str(e)
        }

def generate_email(analysis, contact=None):
    """
    Generates a personalized bilingual cold email using OpenAI.
    Returns english_body (para 1) and spanish_body (para 2) separately.
    """
    try:
        client = get_openai_client()
        recipient_info = f"Recipient: {contact.get('name')} ({contact.get('role')})" if contact else "General Inbox"

        prompt = f"""
        Write a personalized B2B cold email for the following company.
        Target Company: {analysis.get('company_name')}
        What they do: {analysis.get('what_they_do')}
        {recipient_info}

        The email MUST have exactly TWO paragraphs:
        - Paragraph 1: Written in ENGLISH. Introduce yourself, reference the company specifically, and offer value.
        - Paragraph 2: The SAME message translated into SPANISH. Mirror the meaning and tone exactly.

        Return a JSON object with exactly these fields:
        {{
            "subject": "Email subject line in English",
            "english_body": "Full paragraph 1 in English",
            "spanish_body": "Full paragraph 2 in Spanish (translation of paragraph 1)"
        }}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        # Ensure backward compatibility with 'body' key
        result["body"] = result.get("english_body", "") + "\n\n" + result.get("spanish_body", "")
        return result
    except Exception as e:
        return {"subject": "Error", "english_body": str(e), "spanish_body": "", "body": str(e)}

def analyze_document(image_bytes):
    """
    Analyzes a business card or ID card image using GPT-4o Vision and returns extracted JSON.
    Tries gpt-4o-mini first, falls back to gpt-4o on failure.
    """
    import base64
    client = get_openai_client()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')

    print(f"OCR: Received image, size={len(image_bytes)} bytes")

    # Auto-detect MIME type from file magic bytes
    if len(image_bytes) >= 4 and image_bytes[:4] == b'\x89PNG':
        mime_type = "image/png"
    elif len(image_bytes) >= 2 and image_bytes[:2] == b'\xff\xd8':
        mime_type = "image/jpeg"
    elif len(image_bytes) >= 6 and image_bytes[:6] in (b'GIF87a', b'GIF89a'):
        mime_type = "image/gif"
    elif len(image_bytes) >= 12 and image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        mime_type = "image/webp"
    else:
        mime_type = "image/jpeg"

    print(f"OCR: Detected MIME type: {mime_type}")

    prompt = (
        "You are an expert at reading business cards and ID cards. "
        "Examine this image carefully and extract every piece of contact information visible.\n"
        "Look for: full names, company/organization names, phone numbers, mobile numbers, "
        "email addresses, and website URLs.\n"
        "Return ONLY a valid JSON object with exactly these keys:\n"
        '{\n'
        '  \"name\": \"Full name of the person (empty string if not found)\",\n'
        '  \"company_name\": \"Company or organization name (empty string if not found)\",\n'
        '  \"mobile\": \"Phone or mobile number (empty string if not found)\",\n'
        '  \"email\": \"Email address (empty string if not found)\",\n'
        '  \"website\": \"Website URL (empty string if not found)\"\n'
        '}\n'
        "Do not add any other fields or explanations. Return only the JSON."
    )

    # Try gpt-4o-mini first, fall back to gpt-4o if it fails
    for model in ["gpt-4o-mini", "gpt-4o"]:
        try:
            print(f"OCR: Trying model {model}...")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}",
                                    "detail": "low"
                                }
                            },
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=500
            )

            raw = response.choices[0].message.content
            print(f"OCR raw response from {model}: {raw}")
            result = json.loads(raw)

            # Ensure all required fields exist
            result.setdefault("name", "")
            result.setdefault("company_name", "")
            result.setdefault("mobile", "")
            result.setdefault("email", "")
            result.setdefault("website", "")

            print(f"OCR Success ({model}): {result}")
            return result

        except Exception as e:
            print(f"OCR Error with {model}: {type(e).__name__}: {e}")
            if model == "gpt-4o":
                # Both models failed
                return {
                    "error": f"OCR failed: {str(e)}",
                    "name": "",
                    "company_name": "",
                    "mobile": "",
                    "email": "",
                    "website": ""
                }
            continue
