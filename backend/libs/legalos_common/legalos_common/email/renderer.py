"""Jinja2 renderer for HTML email templates."""
from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from legalos_common.email.brand import icon_url

_TEMPLATES_DIR = Path(__file__).resolve().parent / "html"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)
_env.globals["icon_url"] = icon_url


def render(template_name: str, **context: object) -> str:
    template = _env.get_template(template_name)
    return template.render(**context)
