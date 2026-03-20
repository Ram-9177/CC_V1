"""
Resume Generation Service.

Uses OpenAI if OPENAI_API_KEY is set.
Otherwise uses the built-in local enhancer — no API key, no cost, works offline.
"""
import json
import logging
import random
from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a professional resume writer specialising in ATS-optimised resumes for college students.
Rules:
- Use strong action verbs (Developed, Implemented, Designed, Led, Built, Optimised)
- Keep bullet points concise (max 15 words each)
- No emojis, no tables, no graphics
- ATS-optimised plain text format
- Return ONLY valid JSON — no markdown, no explanation

Output JSON schema:
{
  "summary": "2-3 sentence professional summary",
  "skills": ["skill1", "skill2"],
  "education": [{"degree": "", "institution": "", "year": "", "gpa": ""}],
  "experience": [{"title": "", "company": "", "duration": "", "bullets": [""]}],
  "projects": [{"name": "", "tech": "", "bullets": [""]}],
  "certifications": [{"name": "", "issuer": "", "year": ""}],
  "achievements": ["achievement1"]
}"""

ACTION_VERBS = [
    "Developed", "Implemented", "Designed", "Built", "Engineered",
    "Optimised", "Delivered", "Automated", "Integrated", "Deployed",
    "Architected", "Collaborated", "Led", "Managed", "Improved",
    "Reduced", "Increased", "Created", "Maintained", "Resolved",
]


def generate_resume(profile) -> dict:
    """Entry point. Uses OpenAI if key present, else local enhancer."""
    api_key = getattr(settings, 'OPENAI_API_KEY', '') or ''
    if api_key:
        try:
            return _call_openai(api_key, profile)
        except Exception as exc:
            logger.warning(f"OpenAI generation failed, falling back to local enhancer: {exc}")
    return _local_enhance(profile)


def _call_openai(api_key: str, profile) -> dict:
    import httpx
    prompt = (
        f"Create a professional ATS-friendly resume for this student:\n"
        f"Name: {profile.full_name}\n"
        f"Course: {profile.course} | Branch: {profile.branch} | Year: {profile.year}\n"
        f"Summary: {profile.summary or 'Not provided'}\n"
        f"Skills: {json.dumps(profile.skills)}\n"
        f"Education: {json.dumps(profile.education)}\n"
        f"Projects: {json.dumps(profile.projects)}\n"
        f"Experience: {json.dumps(profile.experience)}\n"
        f"Achievements: {json.dumps(profile.achievements)}\n"
        f"Certifications: {json.dumps(profile.certifications)}\n"
        f"Return only the JSON object."
    )
    payload = {
        "model": getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini'),
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"},
    }
    base_url = getattr(settings, 'OPENAI_BASE_URL', 'https://api.openai.com/v1')
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        return json.loads(resp.json()['choices'][0]['message']['content'])


# ── Local Enhancer — no API key needed ───────────────────────────────────────

def _starts_with_action_verb(text: str) -> bool:
    first = text.strip().split()[0].rstrip('.,;:') if text.strip() else ''
    return first in ACTION_VERBS


def _enhance_bullet(bullet: str) -> str:
    bullet = bullet.strip().rstrip('.')
    if not bullet:
        return bullet
    if _starts_with_action_verb(bullet):
        return bullet
    verb = random.choice(ACTION_VERBS[:12])
    rest = bullet[0].lower() + bullet[1:] if len(bullet) > 1 else bullet.lower()
    return f"{verb} {rest}"


def _enhance_bullets(bullets: list) -> list:
    return [_enhance_bullet(b) for b in bullets if b.strip()]


def _build_summary(profile) -> str:
    if profile.summary and len(profile.summary.strip()) > 20:
        s = profile.summary.strip()
        return s if s.endswith('.') else s + '.'

    name = profile.full_name or "The candidate"
    course = profile.course or "Engineering"
    branch = profile.branch or "Technology"
    year_str = f" ({profile.year} year)" if profile.year else ""

    skill_highlight = ""
    if profile.skills:
        top = profile.skills[:3]
        skill_highlight = f" with expertise in {', '.join(top)}"

    activity = ""
    exp_count = len(profile.experience or [])
    proj_count = len(profile.projects or [])
    if exp_count:
        activity = f" Has {exp_count} internship/work experience(s)."
    elif proj_count:
        activity = f" Has built {proj_count} project(s) demonstrating practical skills."

    return (
        f"{name} is a motivated {course} student specialising in {branch}{year_str}"
        f"{skill_highlight}. Seeking opportunities to apply technical knowledge in a professional environment."
        f"{activity}"
    )


def _local_enhance(profile) -> dict:
    """
    Structures and polishes student data locally.
    Produces clean, ATS-ready output with action-verb bullet points.
    """
    return {
        "summary": _build_summary(profile),
        "skills": [s.strip() for s in (profile.skills or []) if s.strip()],
        "education": [
            {
                "degree": e.get("degree", ""),
                "institution": e.get("institution", ""),
                "year": e.get("year", ""),
                "gpa": e.get("gpa", ""),
            }
            for e in (profile.education or [])
        ],
        "experience": [
            {
                "title": e.get("title", ""),
                "company": e.get("company", ""),
                "duration": e.get("duration", ""),
                "bullets": _enhance_bullets(e.get("bullets", [])),
            }
            for e in (profile.experience or [])
        ],
        "projects": [
            {
                "name": p.get("name", ""),
                "tech": p.get("tech", ""),
                "bullets": _enhance_bullets(p.get("bullets", [])),
            }
            for p in (profile.projects or [])
        ],
        "certifications": [
            {
                "name": c.get("name", ""),
                "issuer": c.get("issuer", ""),
                "year": c.get("year", ""),
            }
            for c in (profile.certifications or [])
        ],
        "achievements": [
            _enhance_bullet(a) for a in (profile.achievements or []) if a.strip()
        ],
    }
