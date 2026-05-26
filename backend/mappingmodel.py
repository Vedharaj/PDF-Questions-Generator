#!/usr/bin/env python3
"""Production-grade semantic knowledge graph generator.

This module converts either OCR page content or nested/enriched topic JSON into

a flat, graph-first knowledge representation optimized for React Flow, DAG
rendering, and graph databases.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, DefaultDict, Dict, Iterable, List, Optional, Sequence, Tuple

from dotenv import load_dotenv

from gemini_utils import MODEL_NAME, GeminiKeyRotator, collect_api_keys
from progress_ui import create_progress


load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR.parent / "data"
DEFAULT_INPUT_JSON = DATA_DIR / "mappingTree" / "UNIT-5_enriched.json"
DEFAULT_OUTPUT_JSON = DATA_DIR / "mappingTree" / "UNIT-5_enriched_graph.json"

MAX_PAGE_TEXT_CHARS = 2800
DEFAULT_CHUNK_SIZE = 4
DEFAULT_CONTEXT_WINDOW_SIZE = 5
MAX_GEMINI_RETRIES = 2

STRUCTURAL_RELATION_ALIASES = {
    "parent_of": "parent_of",
    "contains": "parent_of",
    "includes": "parent_of",
    "includes_topic": "parent_of",
    "part_of": "parent_of",
    "child_of": "parent_of",
    "subtopic_of": "parent_of",
}

SEMANTIC_RELATION_ALIASES = {
    "prerequisite": "prerequisite_of",
    "prerequisite_of": "prerequisite_of",
    "requires": "depends_on",
    "depends": "depends_on",
    "depends_on": "depends_on",
    "related": "related_to",
    "related_to": "related_to",
    "extends": "extends",
    "compares": "compares_with",
    "compares_with": "compares_with",
}

ALL_SEMANTIC_RELATIONS = {
    "prerequisite_of",
    "related_to",
    "depends_on",
    "extends",
    "compares_with",
}

logger = logging.getLogger("mappingmodel")


@dataclass
class GraphConfig:
    input_json: Path
    output_json: Path
    unit: Optional[str] = None
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    chunk_size: int = DEFAULT_CHUNK_SIZE
    context_window_size: int = DEFAULT_CONTEXT_WINDOW_SIZE
    use_gemini: bool = True
    max_retries: int = MAX_GEMINI_RETRIES
    model_name: str = MODEL_NAME


@dataclass
class TopicNode:
    id: str
    title: str
    description: str = ""
    keywords: List[str] = field(default_factory=list)
    pages: List[int] = field(default_factory=list)
    parent_id: Optional[str] = None
    children_ids: List[str] = field(default_factory=list)
    level: int = 0
    path: List[str] = field(default_factory=list)
    related_topics: List[str] = field(default_factory=list)
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    aliases: List[str] = field(default_factory=list, repr=False)
    source_titles: List[str] = field(default_factory=list, repr=False)

    def to_output(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "keywords": dedupe_preserve_order(self.keywords),
            "pages": sorted(unique_ints(self.pages)),
            "parent_id": self.parent_id,
            "children_ids": dedupe_preserve_order(self.children_ids),
            "level": self.level,
            "path": list(self.path),
            "related_topics": dedupe_preserve_order(self.related_topics),
            "page_start": self.page_start,
            "page_end": self.page_end,
        }


@dataclass
class GraphEdge:
    source: str
    target: str
    type: str

    def to_output(self) -> Dict[str, Any]:
        return {"source": self.source, "target": self.target, "type": self.type}


@dataclass
class PageConnection:
    page: int
    topic_id: str
    parent_topic_id: Optional[str]
    path: List[str]

    def to_output(self) -> Dict[str, Any]:
        return {
            "page": self.page,
            "topic_id": self.topic_id,
            "parent_topic_id": self.parent_topic_id,
            "path": list(self.path),
        }


@dataclass
class SourceDocument:
    unit: str
    pages: List[Dict[str, Any]] = field(default_factory=list)
    nested_topics: List[Dict[str, Any]] = field(default_factory=list)
    relations: List[Dict[str, Any]] = field(default_factory=list)


class GeminiClient:
    def __init__(self, model_name: str = MODEL_NAME, max_retries: int = MAX_GEMINI_RETRIES):
        self.model_name = model_name
        self.max_retries = max_retries
        self.keys = collect_api_keys()
        self.available = bool(self.keys)
        self.rotator = GeminiKeyRotator(self.keys) if self.keys else None

    def _clean_response_text(self, text: str) -> str:
        text = text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        return text.strip()

    def _safe_json_load(self, text: str) -> Any:
        cleaned = self._clean_response_text(text)
        try:
            return json.loads(cleaned)
        except Exception:
            start = None
            for index, char in enumerate(cleaned):
                if char in "[{":
                    start = index
                    break
            if start is None:
                raise

            end_index = max(cleaned.rfind("}"), cleaned.rfind("]"))
            if end_index <= start:
                raise

            return json.loads(cleaned[start : end_index + 1])

    def generate_json(self, prompt: str) -> Any:
        if not self.available or self.rotator is None:
            raise RuntimeError("No Gemini API keys available.")

        last_error: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.rotator.generate_content(prompt, self.model_name)
                text = getattr(response, "text", str(response))
                return self._safe_json_load(text)
            except Exception as exc:
                last_error = exc
                logger.warning("Gemini JSON parse failed on attempt %s: %s", attempt + 1, exc)

        raise RuntimeError(f"Gemini call failed after retries: {last_error}")


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def dedupe_preserve_order(values: Iterable[Any]) -> List[Any]:
    seen: set[Any] = set()
    result: List[Any] = []
    for value in values:
        if value is None:
            continue
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def unique_ints(values: Iterable[Any]) -> List[int]:
    normalized: List[int] = []
    seen: set[int] = set()
    for value in values:
        try:
            number = int(value)
        except Exception:
            continue
        if number in seen:
            continue
        seen.add(number)
        normalized.append(number)
    return sorted(normalized)


def normalize_topic_title(title: Optional[str]) -> str:
    if not title:
        return "untitled"

    cleaned = str(title).strip().lower()
    cleaned = cleaned.replace("&", " and ")
    cleaned = re.sub(r"[^a-z0-9]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "untitled"


def normalize_title_for_matching(title: Optional[str]) -> str:
    return normalize_topic_title(title).replace("_", " ")


def normalize_keywords(keywords: Optional[Iterable[Any]]) -> List[str]:
    if not keywords:
        return []

    cleaned: List[str] = []
    for keyword in keywords:
        text = str(keyword).strip()
        if not text:
            continue
        cleaned.append(text)
    return dedupe_preserve_order(cleaned)


def tokenize(text: str) -> List[str]:
    return [token for token in re.findall(r"[a-z0-9]+", text.lower()) if token]


def clip_text(text: str, limit: int = MAX_PAGE_TEXT_CHARS) -> str:
    cleaned = str(text or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def normalize_pages(values: Any) -> List[int]:
    if values is None:
        return []
    if isinstance(values, (int, str)):
        values = [values]

    pages: List[int] = []
    seen: set[int] = set()
    for value in values:
        try:
            page = int(value)
        except Exception:
            continue
        if page in seen:
            continue
        seen.add(page)
        pages.append(page)
    return sorted(pages)


def text_similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left.lower(), right.lower()).ratio()


def keyword_overlap(left: Sequence[str], right: Sequence[str]) -> float:
    left_tokens: set[str] = set()
    for keyword in left:
        left_tokens.update(tokenize(str(keyword)))
    right_tokens: set[str] = set()
    for keyword in right:
        right_tokens.update(tokenize(str(keyword)))

    if not left_tokens or not right_tokens:
        return 0.0

    intersection = left_tokens & right_tokens
    union = left_tokens | right_tokens
    return len(intersection) / max(1, len(union))


def topic_similarity(left: TopicNode, right: TopicNode) -> float:
    title_score = text_similarity(left.title, right.title)
    keyword_score = keyword_overlap(left.keywords, right.keywords)
    left_pages = set(left.pages)
    right_pages = set(right.pages)
    page_score = 0.15 if left_pages & right_pages else 0.0
    containment_score = 0.0

    left_norm = normalize_title_for_matching(left.title)
    right_norm = normalize_title_for_matching(right.title)
    if left_norm in right_norm or right_norm in left_norm:
        containment_score = 0.15

    return min(1.0, (0.55 * title_score) + (0.3 * keyword_score) + page_score + containment_score)


def relation_is_hierarchy(relation_type: Optional[str]) -> bool:
    if not relation_type:
        return False
    return relation_type.lower().strip() in STRUCTURAL_RELATION_ALIASES


def normalize_relation_type(relation_type: Optional[str]) -> Optional[str]:
    if not relation_type:
        return None
    key = relation_type.strip().lower()
    if key in STRUCTURAL_RELATION_ALIASES:
        return STRUCTURAL_RELATION_ALIASES[key]
    if key in SEMANTIC_RELATION_ALIASES:
        return SEMANTIC_RELATION_ALIASES[key]
    return None


def relation_mentions_topics(relation: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    source = relation.get("source") or relation.get("from") or relation.get("source_id") or relation.get("source_title")
    target = relation.get("target") or relation.get("to") or relation.get("target_id") or relation.get("target_title")
    return (str(source).strip() if source else None, str(target).strip() if target else None)


def collect_nested_topic_seeds(
    topics: Sequence[Dict[str, Any]],
    default_parent_id: Optional[str] = None,
) -> List[TopicNode]:
    seeds: List[TopicNode] = []
    stack: List[Tuple[Dict[str, Any], Optional[str]]] = []

    for node in reversed(list(topics)):
        stack.append((node, default_parent_id))

    while stack:
        node, parent_id = stack.pop()
        title = str(node.get("title") or node.get("name") or node.get("text") or node.get("content") or "Untitled").strip()
        topic_id = str(node.get("id") or normalize_topic_title(title))
        pages = normalize_pages(node.get("pages") or ([node.get("page")] if node.get("page") is not None else []))
        description = str(node.get("description") or node.get("summary") or "").strip()
        keywords = normalize_keywords(node.get("keywords") or node.get("tags") or [])
        related_topics: List[str] = []
        for rel_value in node.get("related_topics") or node.get("related") or []:
            if rel_value is None:
                continue
            related_topics.append(str(rel_value).strip())

        seeds.append(
            TopicNode(
                id=topic_id,
                title=title,
                description=description,
                keywords=keywords,
                pages=pages,
                parent_id=str(parent_id) if parent_id else None,
                related_topics=dedupe_preserve_order(related_topics),
                page_start=min(pages) if pages else None,
                page_end=max(pages) if pages else None,
                source_titles=[title],
            )
        )

        children = node.get("children") or []
        if isinstance(children, list) and children:
            for child in reversed(children):
                if isinstance(child, dict):
                    stack.append((child, topic_id))

    return seeds


def flatten_seed_dicts(raw_topics: Sequence[Dict[str, Any]]) -> List[TopicNode]:
    if not raw_topics:
        return []
    if any(isinstance(node, dict) and node.get("children") for node in raw_topics):
        return collect_nested_topic_seeds(raw_topics)

    seeds: List[TopicNode] = []
    for node in raw_topics:
        if not isinstance(node, dict):
            continue
        title = str(node.get("title") or node.get("name") or node.get("text") or node.get("content") or "Untitled").strip()
        topic_id = str(node.get("id") or normalize_topic_title(title))
        pages = normalize_pages(node.get("pages") or ([node.get("page")] if node.get("page") is not None else []))
        seeds.append(
            TopicNode(
                id=topic_id,
                title=title,
                description=str(node.get("description") or node.get("summary") or "").strip(),
                keywords=normalize_keywords(node.get("keywords") or node.get("tags") or []),
                pages=pages,
                parent_id=str(node.get("parent_id")).strip() if node.get("parent_id") else None,
                children_ids=[str(child).strip() for child in (node.get("children_ids") or []) if child],
                level=int(node.get("level") or 0),
                path=[str(part).strip() for part in (node.get("path") or []) if part],
                related_topics=[str(rel).strip() for rel in (node.get("related_topics") or []) if rel],
                page_start=node.get("page_start"),
                page_end=node.get("page_end"),
                source_titles=[title],
            )
        )
    return seeds


def resolve_topic_reference(
    reference: Optional[str],
    topic_by_id: Dict[str, TopicNode],
    title_index: Dict[str, str],
    alias_map: Dict[str, str],
) -> Optional[str]:
    if not reference:
        return None

    normalized = str(reference).strip()
    if not normalized:
        return None

    if normalized in alias_map:
        normalized = alias_map[normalized]

    if normalized in topic_by_id:
        return normalized

    title_key = normalize_topic_title(normalized)
    if title_key in title_index:
        return title_index[title_key]

    return None


def choose_canonical_topic(group: List[TopicNode]) -> TopicNode:
    best = group[0]
    for candidate in group[1:]:
        if len(candidate.pages) > len(best.pages):
            best = candidate
            continue
        if len(candidate.title) > len(best.title) and candidate.description:
            best = candidate
            continue
        if candidate.description and not best.description:
            best = candidate
    return best


def should_merge_topics(left: TopicNode, right: TopicNode, similarity_threshold: float = 0.82) -> bool:
    left_key = normalize_topic_title(left.title)
    right_key = normalize_topic_title(right.title)
    if left_key == right_key:
        return True

    sim = topic_similarity(left, right)
    if sim < similarity_threshold:
        return False

    keyword_score = keyword_overlap(left.keywords, right.keywords)
    has_page_overlap = bool(set(left.pages) & set(right.pages))
    title_containment = left_key in right_key or right_key in left_key

    return title_containment or keyword_score >= 0.2 or has_page_overlap


def merge_duplicate_topics(
    topics: Sequence[TopicNode],
    similarity_threshold: float = 0.82,
) -> Tuple[List[TopicNode], Dict[str, str]]:
    if not topics:
        return [], {}

    groups: List[List[TopicNode]] = []
    for topic in topics:
        placed = False
        for group in groups:
            if any(should_merge_topics(topic, candidate, similarity_threshold) for candidate in group):
                group.append(topic)
                placed = True
                break
        if not placed:
            groups.append([topic])

    merged_topics: List[TopicNode] = []
    alias_map: Dict[str, str] = {}

    for group in groups:
        canonical = choose_canonical_topic(group)
        merged_pages: List[int] = []
        merged_keywords: List[str] = []
        merged_related: List[str] = []
        merged_titles: List[str] = []
        child_candidates: List[str] = []
        parent_candidates: List[str] = []
        for topic in group:
            merged_pages.extend(topic.pages)
            merged_keywords.extend(topic.keywords)
            merged_related.extend(topic.related_topics)
            merged_titles.append(topic.title)
            child_candidates.extend(topic.children_ids)
            if topic.parent_id:
                parent_candidates.append(topic.parent_id)
            alias_map[topic.id] = canonical.id
            alias_map[normalize_topic_title(topic.title)] = canonical.id

        canonical.pages = unique_ints(merged_pages)
        canonical.keywords = dedupe_preserve_order(merged_keywords)
        canonical.related_topics = dedupe_preserve_order(merged_related)
        canonical.children_ids = dedupe_preserve_order(child_candidates)
        canonical.parent_id = parent_candidates[0] if parent_candidates and len(set(parent_candidates)) == 1 else canonical.parent_id
        canonical.page_start = min(canonical.pages) if canonical.pages else canonical.page_start
        canonical.page_end = max(canonical.pages) if canonical.pages else canonical.page_end
        canonical.source_titles = dedupe_preserve_order(merged_titles)
        merged_topics.append(canonical)

    return merged_topics, alias_map


def infer_parent_topics(
    topics: Sequence[TopicNode],
    relation_hints: Optional[Sequence[Dict[str, Any]]] = None,
    alias_map: Optional[Dict[str, str]] = None,
) -> List[TopicNode]:
    alias_map = alias_map or {}
    topic_by_id = {topic.id: topic for topic in topics}
    title_index = {normalize_topic_title(topic.title): topic.id for topic in topics}
    child_to_parent: Dict[str, str] = {}

    for relation in relation_hints or []:
        relation_type = normalize_relation_type(relation.get("type"))
        if relation_type != "parent_of":
            continue

        source_ref, target_ref = relation_mentions_topics(relation)
        source_id = resolve_topic_reference(source_ref, topic_by_id, title_index, alias_map)
        target_id = resolve_topic_reference(target_ref, topic_by_id, title_index, alias_map)
        if not source_id or not target_id:
            continue
        child_to_parent[target_id] = source_id

    for topic in topics:
        if topic.parent_id:
            topic.parent_id = resolve_topic_reference(topic.parent_id, topic_by_id, title_index, alias_map) or topic.parent_id
            continue

        if topic.id in child_to_parent:
            topic.parent_id = child_to_parent[topic.id]
            continue

        candidate_score = 0.0
        candidate_parent: Optional[TopicNode] = None

        for other in topics:
            if other.id == topic.id:
                continue
            if other.page_start is None and other.page_end is None and not other.pages:
                continue

            score = 0.0
            if other.page_start is not None and topic.page_start is not None:
                if other.page_start <= topic.page_start <= (other.page_end or other.page_start):
                    score += 0.2
                if topic.page_end is not None and other.page_end is not None and other.page_start <= topic.page_start and topic.page_end <= other.page_end:
                    score += 0.25

            title_score = text_similarity(other.title, topic.title)
            if normalize_title_for_matching(other.title) in normalize_title_for_matching(topic.title):
                score += 0.3
            score += 0.35 * title_score
            score += 0.15 * keyword_overlap(other.keywords, topic.keywords)

            if len(other.title.split()) <= len(topic.title.split()):
                score += 0.05

            if score > candidate_score and score >= 0.58:
                candidate_score = score
                candidate_parent = other

        if candidate_parent is not None:
            topic.parent_id = candidate_parent.id

    return list(topics)


def generate_topic_paths(topics: Sequence[TopicNode]) -> List[TopicNode]:
    topic_by_id = {topic.id: topic for topic in topics}

    for topic in topics:
        path: List[str] = []
        visited: set[str] = set()
        current_id: Optional[str] = topic.id

        while current_id and current_id in topic_by_id and current_id not in visited:
            visited.add(current_id)
            path.append(current_id)
            parent_id = topic_by_id[current_id].parent_id
            if not parent_id or parent_id not in topic_by_id:
                break
            current_id = parent_id

        topic.path = list(reversed(path)) if path else [topic.id]
        if not topic.path:
            topic.path = [topic.id]

    return list(topics)


def calculate_topic_levels(topics: Sequence[TopicNode]) -> List[TopicNode]:
    for topic in topics:
        topic.level = max(0, len(topic.path) - 1)
    return list(topics)


def build_hierarchy_edges(topics: Sequence[TopicNode]) -> List[GraphEdge]:
    edges: List[GraphEdge] = []
    seen: set[Tuple[str, str, str]] = set()
    for topic in topics:
        if not topic.parent_id:
            continue
        key = (topic.parent_id, topic.id, "parent_of")
        if key in seen:
            continue
        seen.add(key)
        edges.append(GraphEdge(source=topic.parent_id, target=topic.id, type="parent_of"))
    return edges


def generate_page_connections(topics: Sequence[TopicNode]) -> List[PageConnection]:
    connections: List[PageConnection] = []
    seen: set[Tuple[int, str, Optional[str]]] = set()
    for topic in topics:
        for page in topic.pages:
            key = (page, topic.id, topic.parent_id)
            if key in seen:
                continue
            seen.add(key)
            connections.append(
                PageConnection(
                    page=page,
                    topic_id=topic.id,
                    parent_topic_id=topic.parent_id,
                    path=list(topic.path) if topic.path else [topic.id],
                )
            )
    connections.sort(key=lambda item: (item.page, item.topic_id))
    return connections


def infer_semantic_relations(
    topics: Sequence[TopicNode],
    relation_hints: Optional[Sequence[Dict[str, Any]]] = None,
    hierarchy_edges: Optional[Sequence[GraphEdge]] = None,
    alias_map: Optional[Dict[str, str]] = None,
) -> List[GraphEdge]:
    alias_map = alias_map or {}
    topic_by_id = {topic.id: topic for topic in topics}
    title_index = {normalize_topic_title(topic.title): topic.id for topic in topics}
    hierarchy_pairs = {(edge.source, edge.target) for edge in hierarchy_edges or []}

    relations: List[GraphEdge] = []
    seen: set[Tuple[str, str, str]] = set()

    def add_edge(source_id: Optional[str], target_id: Optional[str], relation_type: str) -> None:
        if not source_id or not target_id or source_id == target_id:
            return
        if (source_id, target_id) in hierarchy_pairs:
            return
        key = (source_id, target_id, relation_type)
        if key in seen:
            return
        seen.add(key)
        relations.append(GraphEdge(source=source_id, target=target_id, type=relation_type))

    for relation in relation_hints or []:
        relation_type = normalize_relation_type(relation.get("type"))
        if not relation_type or relation_type == "parent_of":
            continue
        source_ref, target_ref = relation_mentions_topics(relation)
        source_id = resolve_topic_reference(source_ref, topic_by_id, title_index, alias_map)
        target_id = resolve_topic_reference(target_ref, topic_by_id, title_index, alias_map)
        add_edge(source_id, target_id, relation_type)

    ordered_topics = sorted(topics, key=lambda item: (item.page_start if item.page_start is not None else 10**9, item.level, item.title.lower()))
    max_pairs_per_topic = 10

    for index, left in enumerate(ordered_topics):
        neighbors = ordered_topics[index + 1 : index + 1 + max_pairs_per_topic]
        for right in neighbors:
            if left.id == right.id:
                continue
            if (left.id, right.id) in hierarchy_pairs or (right.id, left.id) in hierarchy_pairs:
                continue

            similarity = topic_similarity(left, right)
            page_gap = None
            if left.page_end is not None and right.page_start is not None:
                page_gap = right.page_start - left.page_end

            keyword_score = keyword_overlap(left.keywords, right.keywords)
            left_norm = normalize_title_for_matching(left.title)
            right_norm = normalize_title_for_matching(right.title)

            if similarity >= 0.9 and keyword_score >= 0.2:
                source_id, target_id = sorted([left.id, right.id])
                add_edge(source_id, target_id, "related_to")
                continue

            if left_norm in right_norm or right_norm in left_norm:
                more_specific = right if len(right_norm) >= len(left_norm) else left
                broader = left if more_specific is right else right
                add_edge(more_specific.id, broader.id, "extends")
                continue

            if page_gap is not None and 0 <= page_gap <= 3 and keyword_score >= 0.12:
                add_edge(left.id, right.id, "prerequisite_of")
                continue

            if keyword_score >= 0.35 and similarity >= 0.72:
                source_id, target_id = sorted([left.id, right.id])
                add_edge(source_id, target_id, "compares_with")
                continue

            if similarity >= 0.68:
                source_id, target_id = sorted([left.id, right.id])
                add_edge(source_id, target_id, "related_to")

    return relations


def build_metadata(
    unit: str,
    topics: Sequence[TopicNode],
    hierarchy_edges: Sequence[GraphEdge],
    semantic_relations: Sequence[GraphEdge],
    page_connections: Sequence[PageConnection],
    config: GraphConfig,
) -> Dict[str, Any]:
    all_pages = sorted({connection.page for connection in page_connections})
    max_depth = max((topic.level for topic in topics), default=0)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "unit": unit,
        "total_topics": len(topics),
        "total_edges": len(hierarchy_edges) + len(semantic_relations),
        "max_depth": max_depth,
        "total_pages": len(all_pages),
        "page_span": [all_pages[0], all_pages[-1]] if all_pages else [],
        "chunk_size": config.chunk_size,
        "context_window_size": config.context_window_size,
        "used_gemini": config.use_gemini,
        "model_name": config.model_name if config.use_gemini else None,
        "input_file": str(config.input_json),
    }


def build_topic_registry(
    seed_topics: Sequence[TopicNode],
    relation_hints: Optional[Sequence[Dict[str, Any]]] = None,
) -> Tuple[List[TopicNode], Dict[str, str]]:
    merged_topics, alias_map = merge_duplicate_topics(seed_topics)
    infer_parent_topics(merged_topics, relation_hints=relation_hints, alias_map=alias_map)
    generate_topic_paths(merged_topics)
    calculate_topic_levels(merged_topics)

    topic_by_id = {topic.id: topic for topic in merged_topics}
    for topic in merged_topics:
        topic.children_ids = []
    for topic in merged_topics:
        if topic.parent_id and topic.parent_id in topic_by_id:
            topic_by_id[topic.parent_id].children_ids.append(topic.id)

    for topic in merged_topics:
        topic.pages = unique_ints(topic.pages)
        if topic.pages:
            topic.page_start = min(topic.pages)
            topic.page_end = max(topic.pages)
        elif topic.page_start is not None and topic.page_end is not None:
            try:
                topic.page_start = int(topic.page_start)
                topic.page_end = int(topic.page_end)
            except Exception:
                topic.page_start = None
                topic.page_end = None

    merged_topics.sort(key=lambda item: (item.page_start if item.page_start is not None else 10**9, item.level, item.title.lower()))
    return merged_topics, alias_map


def build_window_payload(page_records: Sequence[Dict[str, Any]], anchor_page: int, window_index: int) -> Dict[str, Any]:
    context_pages = []
    window_start = None
    window_end = None
    for page in page_records:
        page_number = page.get("page")
        if page_number is None:
            continue
        try:
            page_number = int(page_number)
        except Exception:
            continue
        window_start = page_number if window_start is None else min(window_start, page_number)
        window_end = page_number if window_end is None else max(window_end, page_number)
        context_pages.append(
            {
                "page": page_number,
                "text": clip_text(page.get("text") or page.get("content") or ""),
            }
        )

    return {
        "window_index": window_index,
        "anchor_page": anchor_page,
        "window_start": window_start,
        "window_end": window_end,
        "context_pages": context_pages,
    }


def build_pass_one_prompt(unit: str, windows: Sequence[Dict[str, Any]]) -> str:
    payload = json.dumps(windows, ensure_ascii=False)
    return (
        f"Unit: {unit}\n"
        "You are extracting semantic topic candidates from multi-page context windows.\n"
        "Return ONLY valid JSON using this schema:\n"
        "{\n"
        '  "windows": [\n'
        "    {\n"
        '      "anchor_page": 1,\n'
        '      "summary": "...",\n'
        '      "topics": [\n'
        "        {\n"
        '          "title": "...",\n'
        '          "description": "...",\n'
        '          "keywords": [],\n'
        '          "pages": [],\n'
        '          "related_topics": [],\n'
        '          "parent_hint": null\n'
        "        }\n"
        "      ],\n"
        '      "relations": [\n'
        "        {\n"
        '          "source": "...",\n'
        '          "target": "...",\n'
        '          "type": "related_to"\n'
        "        }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Use the window context to preserve parent-child continuity, sibling detection, and dependency direction.\n"
        f"Windows: {payload}\n"
    )


def parse_pass_one_response(response: Any, fallback_windows: Sequence[Dict[str, Any]]) -> List[TopicNode]:
    extracted: List[TopicNode] = []
    windows: Sequence[Dict[str, Any]] = []

    if isinstance(response, dict):
        windows = response.get("windows") or response.get("results") or []
    elif isinstance(response, list):
        windows = response

    if not windows:
        windows = fallback_windows

    for window in windows:
        if not isinstance(window, dict):
            continue
        anchor_page = window.get("anchor_page")
        try:
            anchor_page = int(anchor_page) if anchor_page is not None else None
        except Exception:
            anchor_page = None

        base_pages = normalize_pages(window.get("pages") or [])
        if anchor_page is not None and anchor_page not in base_pages:
            base_pages.append(anchor_page)
        if not base_pages and anchor_page is not None:
            base_pages = [anchor_page]

        for topic in window.get("topics") or window.get("mini_topics") or []:
            if not isinstance(topic, dict):
                continue
            title = str(topic.get("title") or topic.get("name") or "Untitled").strip()
            topic_id = str(topic.get("id") or normalize_topic_title(title))
            topic_pages = normalize_pages(topic.get("pages") or base_pages)
            if not topic_pages and anchor_page is not None:
                topic_pages = [anchor_page]

            extracted.append(
                TopicNode(
                    id=topic_id,
                    title=title,
                    description=str(topic.get("description") or topic.get("summary") or "").strip(),
                    keywords=normalize_keywords(topic.get("keywords") or topic.get("tags") or []),
                    pages=topic_pages,
                    parent_id=str(topic.get("parent_hint")).strip() if topic.get("parent_hint") else None,
                    related_topics=[str(value).strip() for value in (topic.get("related_topics") or []) if value],
                    page_start=min(topic_pages) if topic_pages else None,
                    page_end=max(topic_pages) if topic_pages else None,
                    source_titles=[title],
                )
            )

    return extracted


def fallback_topics_from_pages(pages: Sequence[Dict[str, Any]]) -> List[TopicNode]:
    extracted: List[TopicNode] = []
    for page in pages:
        page_number = page.get("page")
        try:
            page_number = int(page_number)
        except Exception:
            continue

        raw_text = str(page.get("text") or page.get("content") or "")
        candidate_title = None
        for line in raw_text.splitlines():
            cleaned = line.strip().strip("-–—•*")
            if not cleaned:
                continue
            if cleaned.lower().startswith("unit-"):
                continue
            if len(cleaned.split()) <= 10:
                candidate_title = cleaned
                break

        title = candidate_title or f"Page {page_number}"
        extracted.append(
            TopicNode(
                id=normalize_topic_title(title),
                title=title,
                description=clip_text(raw_text, 180),
                keywords=[],
                pages=[page_number],
                page_start=page_number,
                page_end=page_number,
                source_titles=[title],
            )
        )
    return extracted


def chunked(sequence: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    size = max(1, int(size))
    for index in range(0, len(sequence), size):
        yield sequence[index : index + size]


def build_context_windows(pages: Sequence[Dict[str, Any]], context_window_size: int) -> List[Dict[str, Any]]:
    if not pages:
        return []

    radius = max(1, context_window_size // 2)
    windows: List[Dict[str, Any]] = []
    for index, page in enumerate(pages):
        anchor_page = page.get("page")
        try:
            anchor_page_int = int(anchor_page)
        except Exception:
            continue

        start = max(0, index - radius)
        end = min(len(pages), index + radius + 1)
        windows.append(build_window_payload(pages[start:end], anchor_page_int, index))
    return windows


def load_source_document(path: Path, unit_override: Optional[str] = None) -> SourceDocument:
    raw = json.loads(path.read_text(encoding="utf-8"))
    unit = unit_override or None
    pages: List[Dict[str, Any]] = []
    nested_topics: List[Dict[str, Any]] = []
    relations: List[Dict[str, Any]] = []

    if isinstance(raw, dict):
        unit = unit_override or str(raw.get("unit") or path.stem)
        if isinstance(raw.get("pages"), list):
            pages = [page for page in raw["pages"] if isinstance(page, dict)]
        if isinstance(raw.get("topics"), list):
            nested_topics = [topic for topic in raw["topics"] if isinstance(topic, dict)]
        if isinstance(raw.get("relations"), list):
            relations = [relation for relation in raw["relations"] if isinstance(relation, dict)]
    elif isinstance(raw, list):
        unit = unit_override or path.stem
        if raw and isinstance(raw[0], dict) and ("page" in raw[0] or "text" in raw[0] or "content" in raw[0]):
            pages = [page for page in raw if isinstance(page, dict)]
        else:
            nested_topics = [topic for topic in raw if isinstance(topic, dict)]
    else:
        raise ValueError(f"Unsupported JSON root type in {path}: {type(raw).__name__}")

    return SourceDocument(unit=unit or path.stem, pages=pages, nested_topics=nested_topics, relations=relations)


def prune_page_range_seed_topics(
    topics: Sequence[TopicNode],
    start_page: Optional[int],
    end_page: Optional[int],
) -> List[TopicNode]:
    if start_page is None and end_page is None:
        return list(topics)

    filtered: List[TopicNode] = []
    for topic in topics:
        pages = [page for page in topic.pages if (start_page is None or page >= start_page) and (end_page is None or page <= end_page)]
        if not pages:
            continue
        topic.pages = pages
        topic.page_start = min(pages)
        topic.page_end = max(pages)
        filtered.append(topic)
    return filtered


def process_page_windows(
    pages: Sequence[Dict[str, Any]],
    unit: str,
    config: GraphConfig,
) -> List[TopicNode]:
    if not pages:
        return []

    windows = build_context_windows(pages, config.context_window_size)
    if not windows:
        return []

    if not config.use_gemini:
        logger.info("Gemini disabled; using deterministic fallback topic extraction.")
        return fallback_topics_from_pages(pages)

    client = GeminiClient(model_name=config.model_name, max_retries=config.max_retries)
    if not client.available:
        logger.warning("No Gemini API keys found; using deterministic fallback topic extraction.")
        return fallback_topics_from_pages(pages)

    extracted: List[TopicNode] = []
    with create_progress() as progress:
        task_id = progress.add_task("Pass 1: extracting contextual topics", total=len(windows), unit="window")
        for batch in chunked(windows, config.chunk_size):
            prompt = build_pass_one_prompt(unit, batch)
            try:
                response = client.generate_json(prompt)
                extracted.extend(parse_pass_one_response(response, batch))
            except Exception as exc:
                logger.warning("Gemini pass 1 failed for a batch: %s", exc)
                for window in batch:
                    extracted.extend(parse_pass_one_response({}, [window]))
            progress.advance(task_id, len(batch))

    return extracted


def validate_graph_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    required_keys = {"unit", "topics", "hierarchy_edges", "semantic_relations", "page_connections", "metadata"}
    missing = required_keys - set(payload)
    if missing:
        raise ValueError(f"Graph payload missing keys: {sorted(missing)}")
    if not isinstance(payload["topics"], list):
        raise ValueError("topics must be a list")
    if not isinstance(payload["hierarchy_edges"], list):
        raise ValueError("hierarchy_edges must be a list")
    if not isinstance(payload["semantic_relations"], list):
        raise ValueError("semantic_relations must be a list")
    if not isinstance(payload["page_connections"], list):
        raise ValueError("page_connections must be a list")
    if not isinstance(payload["metadata"], dict):
        raise ValueError("metadata must be an object")
    return payload


def generate_graph(config: GraphConfig) -> Dict[str, Any]:
    source = load_source_document(config.input_json, config.unit)
    logger.info("Loaded %s with unit '%s'", config.input_json, source.unit)

    seed_topics = collect_nested_topic_seeds(source.nested_topics)

    if source.pages:
        if config.start_page is not None or config.end_page is not None:
            filtered_pages: List[Dict[str, Any]] = []
            for page in source.pages:
                try:
                    page_number = int(page.get("page", 0))
                except Exception:
                    continue
                if config.start_page is not None and page_number < config.start_page:
                    continue
                if config.end_page is not None and page_number > config.end_page:
                    continue
                filtered_pages.append(page)
            source.pages = filtered_pages
        seed_topics.extend(process_page_windows(source.pages, source.unit, config))

    seed_topics.extend(flatten_seed_dicts(source.nested_topics))
    if config.start_page is not None or config.end_page is not None:
        seed_topics = prune_page_range_seed_topics(seed_topics, config.start_page, config.end_page)

    with create_progress() as progress:
        task_id = progress.add_task("Pass 2: building flat graph registry", total=max(1, len(seed_topics)), unit="topic")
        topics, alias_map = build_topic_registry(seed_topics, relation_hints=source.relations)
        progress.advance(task_id, max(1, len(seed_topics)))

    hierarchy_edges = build_hierarchy_edges(topics)
    semantic_relations = infer_semantic_relations(
        topics,
        relation_hints=source.relations,
        hierarchy_edges=hierarchy_edges,
        alias_map=alias_map,
    )
    page_connections = generate_page_connections(topics)

    related_by_topic: DefaultDict[str, List[str]] = defaultdict(list)
    for edge in semantic_relations:
        if edge.type not in ALL_SEMANTIC_RELATIONS:
            continue
        related_by_topic[edge.source].append(edge.target)
        if edge.type in {"related_to", "compares_with"}:
            related_by_topic[edge.target].append(edge.source)

    topic_lookup = {topic.id: topic for topic in topics}
    for topic in topics:
        topic.related_topics = dedupe_preserve_order(topic.related_topics + related_by_topic.get(topic.id, []))
        if topic.page_start is None and topic.pages:
            topic.page_start = min(topic.pages)
        if topic.page_end is None and topic.pages:
            topic.page_end = max(topic.pages)
        if topic.parent_id and topic.parent_id not in topic_lookup:
            topic.parent_id = None
        topic.children_ids = dedupe_preserve_order(topic.children_ids)

    metadata = build_metadata(
        unit=source.unit,
        topics=topics,
        hierarchy_edges=hierarchy_edges,
        semantic_relations=semantic_relations,
        page_connections=page_connections,
        config=config,
    )

    result = {
        "unit": source.unit,
        "topics": [topic.to_output() for topic in topics],
        "hierarchy_edges": [edge.to_output() for edge in hierarchy_edges],
        "semantic_relations": [edge.to_output() for edge in semantic_relations],
        "page_connections": [connection.to_output() for connection in page_connections],
        "metadata": metadata,
    }
    return validate_graph_payload(result)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a flat semantic knowledge graph from topic or OCR JSON.")
    parser.add_argument("--input-json", help="Path to the source JSON file.")
    parser.add_argument("--output-json", help="Path to write the graph JSON.")
    parser.add_argument("--unit", help="Override the unit name stored in output.")
    parser.add_argument("--topic", help="Alias for --unit.")
    parser.add_argument("--start-page", type=int, help="Optional 1-based start page filter for OCR inputs.")
    parser.add_argument("--end-page", type=int, help="Optional 1-based end page filter for OCR inputs.")
    parser.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE, help="Number of context windows per Gemini batch.")
    parser.add_argument(
        "--context-window-size",
        type=int,
        default=DEFAULT_CONTEXT_WINDOW_SIZE,
        help="Sliding context window size used for OCR page analysis.",
    )
    parser.add_argument("--no-gemini", action="store_true", help="Disable Gemini and use deterministic fallback extraction.")
    parser.add_argument("--max-retries", type=int, default=MAX_GEMINI_RETRIES, help="Gemini JSON parse retry count.")
    parser.add_argument("--model-name", default=MODEL_NAME, help="Gemini model name.")
    parser.add_argument("--log-level", default="INFO", help="Logging level.")
    return parser.parse_args()


def resolve_input_path(value: Optional[str]) -> Path:
    if value:
        return Path(value)
    if DEFAULT_INPUT_JSON.exists():
        return DEFAULT_INPUT_JSON
    return DATA_DIR / "OCR_PDF" / "UNIT-1-ocr.json"


def resolve_output_path(input_path: Path, value: Optional[str]) -> Path:
    if value:
        output = Path(value)
    else:
        output = DATA_DIR / "mappingTree" / f"{input_path.stem}_graph.json"
    if not output.is_absolute():
        output = BACKEND_DIR / output
    return output


def main() -> int:
    args = parse_args()
    configure_logging(args.log_level)

    input_path = resolve_input_path(args.input_json)
    unit_override = args.topic or args.unit
    output_path = resolve_output_path(input_path, args.output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    config = GraphConfig(
        input_json=input_path,
        output_json=output_path,
        unit=unit_override,
        start_page=args.start_page,
        end_page=args.end_page,
        chunk_size=max(1, args.chunk_size),
        context_window_size=max(1, args.context_window_size),
        use_gemini=not args.no_gemini,
        max_retries=max(0, args.max_retries),
        model_name=args.model_name,
    )

    try:
        graph = generate_graph(config)
        output_path.write_text(json.dumps(graph, indent=2, ensure_ascii=False), encoding="utf-8")
        logger.info("Saved graph JSON to %s", output_path)
        print(f"Saved: {output_path}")
        return 0
    except Exception as exc:
        logger.exception("Graph generation failed")
        print(f"Graph generation failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
