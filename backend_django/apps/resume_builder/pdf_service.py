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
    """
    Prefer xhtml2pdf (declared in requirements.txt — pure Python, works without system libs).
    Optionally use WeasyPrint when installed for higher-fidelity output.
    """
    import io

    # Primary: xhtml2pdf (pisa)
    try:
        from xhtml2pdf import pisa

        buf = io.BytesIO()
        result = pisa.CreatePDF(html, dest=buf, encoding="utf-8")
        out = buf.getvalue()
        if not out:
            raise RuntimeError("xhtml2pdf produced empty PDF output")
        if result.err:
            logger.warning("xhtml2pdf completed with render warnings (err flag set)")
        return out
    except ImportError:
        logger.debug("xhtml2pdf not importable, trying weasyprint")
    except Exception as exc:
        logger.warning("xhtml2pdf failed (%s), trying weasyprint", exc)

    try:
        from weasyprint import HTML

        return HTML(string=html).write_pdf()
    except ImportError:
        pass
    except Exception as exc:
        logger.exception("WeasyPrint PDF failed: %s", exc)
        raise RuntimeError(
            "PDF rendering failed. Ensure xhtml2pdf is installed (pip install xhtml2pdf) "
            "or fix WeasyPrint system dependencies."
        ) from exc

    raise RuntimeError(
        "No PDF library available. Install: pip install xhtml2pdf"
    )
