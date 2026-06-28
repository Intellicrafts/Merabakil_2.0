from __future__ import annotations

from app.config import ContractReviewSettings
from legalos_common.clients import build_llm_client


class Container:
    def __init__(self, settings: ContractReviewSettings) -> None:
        self.settings = settings
        self.llm = build_llm_client(settings.llm)


_container: Container | None = None


def init_container(settings: ContractReviewSettings) -> Container:
    global _container
    _container = Container(settings)
    return _container


def get_container() -> Container:
    if _container is None:
        raise RuntimeError("Container not initialised")
    return _container
