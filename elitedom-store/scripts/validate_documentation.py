#!/usr/bin/env python3
"""Validate Elitedom's enterprise Markdown documentation contract."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DOC_ROOTS = (
    ROOT / "docs",
    ROOT / "elitedom-store" / "docs",
)

REQUIRED_FRONTMATTER = {
    "title",
    "status",
    "owner",
    "document_type",
    "verified_against",
    "review_trigger",
}

ALLOWED_STATUSES = {
    "current",
    "operational",
    "reference",
    "planned",
    "historical",
    "superseded",
}

ALLOWED_OWNERS = {
    "product",
    "architecture",
    "engineering",
    "operations",
    "delivery",
}

ALLOWED_DECISION_STATUSES = {
    "accepted",
    "superseded",
    "deprecated",
}

REQUIRED_CANONICAL_DOCS = (
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    "docs/README.md",
    "docs/governance/DOCUMENTATION_STANDARD.md",
    "docs/governance/SOURCE_OF_TRUTH.md",
    "docs/governance/STATUS_MODEL.md",
    "docs/architecture/README.md",
    "docs/architecture/decisions/README.md",
    "docs/architecture/decisions/ADR-011-Paymob.md",
    "docs/architecture/integrations/PAYMOB.md",
    "docs/operations/README.md",
    "docs/delivery/releases/STAGE_0_BASELINE.md",
    "docs/delivery/releases/STAGE_1_CLEANUP_REPORT.md",
    "docs/delivery/releases/STAGE_10_UAT_GO_LIVE.md",
    "elitedom-store/README.md",
    "elitedom-store/SETUP_AND_ENV_GUIDE.md",
    "elitedom-store/frontend/README.md",
    "elitedom-store/docs/IMPLEMENTATION_STATUS.md",
    "elitedom-store/docs/GO_LIVE_RUNBOOK.md",
)

RETIRED_DOC_PATHS = (
    "DOCUMENTATION_INDEX.md",
    "elitedom-store/docs/STAGE_0_BASELINE.md",
    "elitedom-store/docs/STAGE_1_CLEANUP_REPORT.md",
)

MARKDOWN_LINK = re.compile(r"(?<!\!)\[[^\]]+\]\(([^)]+)\)")
LEGACY_ROOT = re.compile(r"(?<![A-Za-z0-9])(?:0[0-9]|1[0-8])_[A-Z][A-Z0-9_]+/")
H1 = re.compile(r"(?m)^# [^#\n].+$")
SOURCE_SECTION = re.compile(
    r"(?ms)^## Source of truth\s*\n(.*?)(?=^##\s|\Z)"
)
INLINE_CODE = re.compile(r"`([^`\n]+)`")
SOURCE_PATH_PREFIXES = (
    ".github/",
    "docs/",
    "elitedom-store/",
)


def parse_frontmatter(content: str) -> tuple[dict[str, str], str]:
    if not content.startswith("---\n"):
        return {}, content

    end = content.find("\n---\n", 4)
    if end < 0:
        return {}, content

    metadata: dict[str, str] = {}
    for raw_line in content[4:end].splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = value[1:-1].replace('\\"', '"')
        metadata[key.strip()] = value

    return metadata, content[end + 5 :]


def governed_markdown() -> list[Path]:
    paths: list[Path] = []
    for root in DOC_ROOTS:
        if root.exists():
            paths.extend(root.rglob("*.md"))
    return sorted(paths)


def all_markdown() -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob("*.md")
        if ".git" not in path.parts and "node_modules" not in path.parts
    )


def validate_links(path: Path, body: str, errors: list[str]) -> None:
    for target in MARKDOWN_LINK.findall(body):
        target = target.strip().split("#", 1)[0]
        if not target:
            continue
        lowered = target.lower()
        if lowered.startswith(("http://", "https://", "mailto:", "tel:")):
            continue
        if target.startswith("/"):
            errors.append(
                f"{path.relative_to(ROOT)}: repository Markdown links must be relative: {target}"
            )
            continue
        resolved = (path.parent / target).resolve()
        try:
            resolved.relative_to(ROOT)
        except ValueError:
            errors.append(
                f"{path.relative_to(ROOT)}: link escapes repository root: {target}"
            )
            continue
        if not resolved.exists():
            errors.append(
                f"{path.relative_to(ROOT)}: broken relative link: {target}"
            )


def validate_source_paths(path: Path, body: str, errors: list[str]) -> None:
    for section in SOURCE_SECTION.findall(body):
        for token in INLINE_CODE.findall(section):
            candidate = token.strip().rstrip(".,;:")
            if not candidate.startswith(SOURCE_PATH_PREFIXES):
                continue
            if any(character in candidate for character in "*{}<>"):
                errors.append(
                    f"{path.relative_to(ROOT)}: Source of truth must use a concrete repository path: {candidate}"
                )
                continue
            resolved = (ROOT / candidate).resolve()
            try:
                resolved.relative_to(ROOT)
            except ValueError:
                errors.append(
                    f"{path.relative_to(ROOT)}: Source of truth escapes repository root: {candidate}"
                )
                continue
            if not resolved.exists():
                errors.append(
                    f"{path.relative_to(ROOT)}: Source of truth path does not exist: {candidate}"
                )


def validate_repository_markdown(errors: list[str]) -> None:
    """Apply basic integrity rules to every Markdown artifact in the repository."""
    for path in all_markdown():
        content = path.read_text(encoding="utf-8")
        _, body = parse_frontmatter(content)
        if LEGACY_ROOT.search(body):
            errors.append(
                f"{path.relative_to(ROOT)}: references a retired numbered documentation root."
            )
        if "DOCUMENTATION_INDEX.md" in body:
            errors.append(
                f"{path.relative_to(ROOT)}: references retired DOCUMENTATION_INDEX.md."
            )
        validate_links(path, body, errors)
        validate_source_paths(path, body, errors)


def main() -> int:
    errors: list[str] = []
    paths = governed_markdown()

    if not paths:
        print("ERROR: no governed Markdown documents found.")
        return 1

    for required in REQUIRED_CANONICAL_DOCS:
        if not (ROOT / required).is_file():
            errors.append(f"missing canonical documentation: {required}")

    for retired in RETIRED_DOC_PATHS:
        if (ROOT / retired).exists():
            errors.append(f"retired documentation path is still tracked: {retired}")

    for path in paths:
        relative = path.relative_to(ROOT)
        content = path.read_text(encoding="utf-8")
        metadata, body = parse_frontmatter(content)

        missing = sorted(REQUIRED_FRONTMATTER.difference(metadata))
        if missing:
            errors.append(
                f"{relative}: missing frontmatter fields: {', '.join(missing)}"
            )
            continue

        status = metadata["status"]
        owner = metadata["owner"]
        if status not in ALLOWED_STATUSES:
            errors.append(f"{relative}: invalid documentation status: {status}")
        if owner not in ALLOWED_OWNERS:
            errors.append(f"{relative}: invalid documentation owner: {owner}")

        title = metadata["title"].strip()
        if not title:
            errors.append(f"{relative}: frontmatter title must not be empty.")

        if len(H1.findall(body)) != 1:
            errors.append(f"{relative}: document must contain exactly one H1 heading.")

        if relative.name.startswith("STAGE_") and status != "historical":
            errors.append(f"{relative}: release-stage records must be historical.")

        if relative.parent == Path("docs/architecture/decisions") and relative.name.startswith("ADR-"):
            decision_status = metadata.get("decision_status", "").lower()
            if decision_status not in ALLOWED_DECISION_STATUSES:
                errors.append(
                    f"{relative}: ADR decision_status must be one of: "
                    f"{', '.join(sorted(ALLOWED_DECISION_STATUSES))}."
                )
            if status == "superseded" and decision_status != "superseded":
                errors.append(
                    f"{relative}: superseded ADR must also set decision_status=Superseded."
                )

        integration_status_contracts = {
            Path("docs/architecture/integrations/HEDERA.md"): "planned",
            Path("docs/architecture/integrations/ZOHO.md"): "planned",
            Path("docs/architecture/integrations/TYPEFORM.md"): "planned",
            Path("docs/architecture/integrations/STRIPE.md"): "superseded",
            Path("docs/architecture/integrations/PAYMOB.md"): "current",
        }
        required_status = integration_status_contracts.get(relative)
        if required_status and status != required_status:
            errors.append(
                f"{relative}: integration status must remain {required_status} until executable evidence changes."
            )

        if status in {"current", "operational", "reference"}:
            if "Source of truth" not in body and metadata["document_type"] not in {
                "documentation-index",
                "glossary",
                "capability-model",
                "requirements",
                "use-cases",
                "user-stories",
                "traceability",
                "development-reference",
                "testing-reference",
                "ux-reference",
                "design-reference",
                "database-reference",
                "api-reference",
                "observability-reference",
                "data-governance-reference",
                "decision-reference",
                "runbook-reference",
                "adr",
            }:
                errors.append(
                    f"{relative}: living document must identify a Source of truth section."
                )

        if status in {"current", "operational", "reference"}:
            stale_phrases = (
                "Stripe is the primary",
                "Stripe as the primary",
                "primary payment provider is Stripe",
            )
            if any(phrase in body for phrase in stale_phrases):
                errors.append(
                    f"{relative}: stale Stripe-primary assertion in living documentation."
                )

    validate_repository_markdown(errors)

    if errors:
        print("Documentation validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        f"Documentation validation passed for {len(paths)} governed Markdown files "
        f"and {len(all_markdown())} repository Markdown files."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
