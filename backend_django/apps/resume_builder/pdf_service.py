"""
PDF generation for resumes.
Uses weasyprint (preferred) with a fallback to xhtml2pdf.
Install: pip install weasyprint  OR  pip install xhtml2pdf
"""
import logging
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def generate_pdf(resume_data: dict, template_config: dict, profile) -> bytes:
    """Render resume HTML then convert to PDF bytes."""
    html = _render_html(resume_data, template_config, profile)
    return _html_to_pdf(html)


def _render_html(resume_data: dict, template_config: dict, profile) -> str:
    context = {
        'resume': resume_data,
        'template_config': template_config,
        'profile': profile,
    }
    return render_to_string('resume_builder/resume_pdf.html', context)


def _html_to_pdf(html: str) -> bytes:
    # Try weasyprint first
    try:
        from weasyprint import HTML
        return HTML(string=html).write_pdf()
    except ImportError:
        pass

    # Fallback: xhtml2pdf
    try:
        from xhtml2pdf import pisa
        import io
        buf = io.BytesIO()
        pisa.CreatePDF(html, dest=buf)
        return buf.getvalue()
    except ImportError:
        pass

    raise RuntimeError(
        "No PDF library found. Install weasyprint: pip install weasyprint"
    )
