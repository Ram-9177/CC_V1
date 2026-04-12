"""
ATS Resume Templates — render config only (no DB needed).
Each template maps the same resume JSON → a different layout descriptor
consumed by the frontend renderer and the PDF generator.
"""

TEMPLATES = {
    'classic': {
        'id': 'classic',
        'name': 'Classic',
        'description': 'Single column, simple headings — best ATS compatibility.',
        'layout': 'single_column',
        'font': 'Times New Roman',
        'font_size': 11,
        'section_order': ['header', 'summary', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'],
        'heading_style': 'underline',
        'spacing': 'normal',
        'ats_score': 98,
    },
    'modern': {
        'id': 'modern',
        'name': 'Modern',
        'description': 'Bold name header with section separators.',
        'layout': 'single_column',
        'font': 'Calibri',
        'font_size': 11,
        'section_order': ['header', 'summary', 'skills', 'experience', 'education', 'projects', 'certifications', 'achievements'],
        'heading_style': 'bold_border',
        'spacing': 'relaxed',
        'ats_score': 92,
    },
    'compact': {
        'id': 'compact',
        'name': 'Compact',
        'description': 'Dense layout, minimal spacing — fits more on one page.',
        'layout': 'single_column',
        'font': 'Arial',
        'font_size': 10,
        'section_order': ['header', 'summary', 'skills', 'education', 'experience', 'projects', 'certifications', 'achievements'],
        'heading_style': 'caps',
        'spacing': 'tight',
        'ats_score': 90,
    },
    'student_focus': {
        'id': 'student_focus',
        'name': 'Student Focus',
        'description': 'Highlights projects & skills first — ideal for freshers.',
        'layout': 'single_column',
        'font': 'Georgia',
        'font_size': 11,
        'section_order': ['header', 'summary', 'skills', 'projects', 'education', 'experience', 'certifications', 'achievements'],
        'heading_style': 'bold',
        'spacing': 'normal',
        'ats_score': 94,
    },
}


def get_template(template_id: str) -> dict:
    return TEMPLATES.get(template_id, TEMPLATES['classic'])


def list_templates() -> list:
    return list(TEMPLATES.values())
