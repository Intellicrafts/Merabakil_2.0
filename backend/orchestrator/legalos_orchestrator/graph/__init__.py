def build_orchestrator(**kwargs):
    from legalos_orchestrator.graph.build import build_orchestrator as _build
    return _build(**kwargs)


def __getattr__(name):
    if name == "LegalOrchestrator":
        from legalos_orchestrator.graph.build import LegalOrchestrator
        return LegalOrchestrator
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["LegalOrchestrator", "build_orchestrator"]
