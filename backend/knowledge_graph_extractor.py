#!/usr/bin/env python3
"""
Educational Knowledge Graph Extraction Engine

Converts academic study material (PDF content) into deeply structured semantic topic maps.
Generates hierarchical topic trees with relationships for educational visualization systems.
"""

import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, asdict, field
from collections import defaultdict


@dataclass
class Topic:
    """Represents a single topic/concept in the knowledge graph."""
    id: str
    title: str
    description: str
    keywords: List[str] = field(default_factory=list)
    pages: List[int] = field(default_factory=list)
    children: List['Topic'] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, converting children recursively."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "keywords": self.keywords,
            "pages": sorted(list(set(self.pages))),  # Remove duplicates, sort
            "children": [child.to_dict() for child in self.children]
        }


@dataclass
class Relation:
    """Represents a semantic relationship between two topics."""
    source: str
    target: str
    type: str  # prerequisite, related_to, depends_on, part_of, compared_with, uses

    def to_dict(self) -> Dict[str, str]:
        """Convert to dictionary."""
        return asdict(self)


class KnowledgeGraphExtractor:
    """Main extraction engine for converting content to knowledge graphs."""

    VALID_RELATION_TYPES = {
        "prerequisite",
        "related_to",
        "depends_on",
        "part_of",
        "compared_with",
        "uses"
    }

    HEADING_PATTERNS = {
        "h1": r"^#{1}\s+(.+)$",
        "h2": r"^#{2}\s+(.+)$",
        "h3": r"^#{3}\s+(.+)$",
    }

    DEFINITION_PATTERNS = [
        r"(?:^|\n)([A-Z][^:]+):\s+(.{20,150}?)(?:\n|$)",  # Term: definition
        r"(?:^|\n)([A-Z][^-]+)\s*-\s*(.{20,150}?)(?:\n|$)",  # Term - definition
    ]

    def __init__(self):
        """Initialize the extractor."""
        self.topics: Dict[str, Topic] = {}
        self.relations: List[Relation] = []
        self.topic_counter = 0
        self.processed_text: Set[str] = set()

    def generate_id(self, title: str) -> str:
        """Generate unique, clean topic ID from title."""
        # Convert to lowercase, remove special chars, replace spaces with underscores
        base_id = re.sub(r"[^\w\s]", "", title.lower())
        base_id = re.sub(r"\s+", "_", base_id.strip())
        
        # Ensure uniqueness
        id_candidate = base_id
        counter = 1
        while id_candidate in self.topics:
            id_candidate = f"{base_id}_{counter}"
            counter += 1
        
        return id_candidate

    def clean_text(self, text: str) -> str:
        """Clean and normalize text content."""
        # Remove extra whitespace
        text = re.sub(r"\s+", " ", text)
        # Remove common noise patterns
        text = re.sub(r"^(page|Page|\[.*?\]|http.*?(?:\s|$))", "", text, flags=re.MULTILINE)
        return text.strip()

    def extract_definitions(self, text: str) -> List[Tuple[str, str]]:
        """Extract term-definition pairs from text."""
        definitions = []
        for pattern in self.DEFINITION_PATTERNS:
            matches = re.finditer(pattern, text, re.MULTILINE)
            for match in matches:
                term = match.group(1).strip()
                definition = match.group(2).strip()
                if 5 < len(term) < 100 and 20 < len(definition) < 200:
                    definitions.append((term, definition))
        return definitions

    def truncate_description(self, text: str, max_words: int = 25) -> str:
        """Truncate description to specified word count."""
        words = text.split()
        if len(words) > max_words:
            return " ".join(words[:max_words]) + "..."
        return text

    def create_topic(
        self,
        title: str,
        description: str,
        keywords: Optional[List[str]] = None,
        pages: Optional[List[int]] = None,
        parent_id: Optional[str] = None
    ) -> str:
        """Create a new topic and optionally add as child to parent."""
        # Validate inputs
        if not title or len(title) < 2:
            return None

        description = self.truncate_description(description)
        
        # Check for duplicates
        title_lower = title.lower()
        for existing_id, topic in self.topics.items():
            if topic.title.lower() == title_lower:
                # Merge pages and keywords
                if pages:
                    topic.pages.extend(pages)
                if keywords:
                    topic.keywords = list(set(topic.keywords) | set(keywords))
                return existing_id

        # Generate unique ID
        topic_id = self.generate_id(title)
        
        # Create topic
        new_topic = Topic(
            id=topic_id,
            title=title,
            description=description,
            keywords=list(set(keywords or [])),
            pages=list(set(pages or []))
        )
        
        self.topics[topic_id] = new_topic
        
        # Add as child if parent specified
        if parent_id and parent_id in self.topics:
            parent = self.topics[parent_id]
            # Avoid duplicate children
            if not any(child.id == topic_id for child in parent.children):
                parent.children.append(new_topic)
        
        return topic_id

    def add_relation(self, source_id: str, target_id: str, relation_type: str) -> bool:
        """Add a semantic relationship between topics."""
        if relation_type not in self.VALID_RELATION_TYPES:
            return False
        
        if source_id not in self.topics or target_id not in self.topics:
            return False
        
        # Check for duplicate relations
        for rel in self.relations:
            if rel.source == source_id and rel.target == target_id and rel.type == relation_type:
                return False
        
        self.relations.append(Relation(source_id, target_id, relation_type))
        return True

    def extract_from_pages(self, pages: List[Dict[str, Any]]) -> None:
        """Extract topics and relations from page content."""
        for page_data in pages:
            page_num = page_data.get("page", 0)
            content = page_data.get("content", "")
            # Clean/normalize content to improve regex matching
            content = self.clean_text(content)

            if not content:
                continue

            # Skip if already processed (duplicate detection)
            content_hash = hash(content)
            if content_hash in self.processed_text:
                continue
            self.processed_text.add(content_hash)
            
            # Extract headings as main topics
            for heading_level, pattern in self.HEADING_PATTERNS.items():
                matches = re.finditer(pattern, content, re.MULTILINE)
                for match in matches:
                    title = match.group(1).strip()
                    if len(title) > 3:
                        self.create_topic(
                            title=title,
                            description=f"Topic from {heading_level} heading",
                            pages=[page_num]
                        )
            
            # Extract definitions
            definitions = self.extract_definitions(content)
            for term, definition in definitions:
                self.create_topic(
                    title=term,
                    description=definition,
                    keywords=[term.lower()],
                    pages=[page_num]
                )
            
            # Extract algorithms, formulas, methods
            self._extract_methods(content, page_num)
            
            # Extract important terms
            self._extract_important_terms(content, page_num)

    def _extract_methods(self, content: str, page_num: int) -> None:
        """Extract algorithms, methods, formulas, and models."""
        # Look for common method indicators
        patterns = [
            r"(?:algorithm|method|procedure|process|formula|equation|model|architecture):\s*([^.\n]+)",
            r"(?:The\s+([A-Z][A-Za-z\s]+)\s+(?:algorithm|method|procedure|process|formula))",
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                title = match.group(1).strip()
                if 3 < len(title) < 100:
                    self.create_topic(
                        title=title,
                        description=f"Algorithm or method",
                        pages=[page_num]
                    )

    def _extract_important_terms(self, content: str, page_num: int) -> None:
        """Extract capitalized important terms and concepts."""
        # Find capitalized phrases (likely important terms)
        # Avoid common words
        common_words = {"The", "This", "That", "Is", "Are", "Was", "Were"}
        
        pattern = r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b"
        matches = re.finditer(pattern, content)
        
        term_frequency = defaultdict(int)
        for match in matches:
            term = match.group(1)
            if term not in common_words and len(term) > 3:
                term_frequency[term] += 1
        
        # Create topics for high-frequency important terms
        for term, frequency in term_frequency.items():
            if frequency >= 2:  # Appears at least twice
                self.create_topic(
                    title=term,
                    description=f"Important concept in the material",
                    keywords=[term.lower()],
                    pages=[page_num]
                )

    def build_hierarchy(self) -> None:
        """Organize topics into a logical hierarchy."""
        # Simple heuristic: organize by semantic similarity and page order
        # This is a basic implementation; more sophisticated approaches could use NLP
        
        # Group topics by page
        topics_by_page = defaultdict(list)
        for topic_id, topic in self.topics.items():
            if topic.pages:
                topics_by_page[min(topic.pages)].append(topic_id)
        
        # For now, maintain the graph structure as-is
        # Advanced hierarchies could be built using NLP similarity

    def validate_output(self, output: Dict[str, Any]) -> bool:
        """Validate output JSON structure."""
        required_keys = {"unit", "topics", "relations", "metadata"}
        if not all(key in output for key in required_keys):
            return False
        
        if not isinstance(output["topics"], list):
            return False
        
        if not isinstance(output["relations"], list):
            return False
        
        if "total_topics" not in output["metadata"]:
            return False
        
        return True

    def generate_output(self, unit_name: str) -> Dict[str, Any]:
        """Generate final JSON output."""
        # Build hierarchy
        self.build_hierarchy()
        
        # Separate root topics (no parent) and create hierarchy
        root_topics = self._identify_root_topics()
        
        output = {
            "unit": unit_name,
            "topics": [topic.to_dict() for topic in root_topics],
            "relations": [rel.to_dict() for rel in self.relations],
            "metadata": {
                "total_topics": len(self.topics),
                "total_relations": len(self.relations)
            }
        }
        
        # Validate
        if not self.validate_output(output):
            raise ValueError("Generated output fails validation")
        
        return output

    def _identify_root_topics(self) -> List[Topic]:
        """Identify topics that should be at the root level."""
        # Topics that have pages but are not children of others
        all_children_ids = set()
        for topic in self.topics.values():
            for child in topic.children:
                all_children_ids.add(child.id)
        
        root_topics = [
            topic for topic_id, topic in self.topics.items()
            if topic_id not in all_children_ids
        ]
        
        return sorted(root_topics, key=lambda t: min(t.pages) if t.pages else float('inf'))

    def extract(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Main extraction pipeline."""
        unit_name = input_data.get("unit", "Unknown Unit")
        pages = input_data.get("pages", [])
        
        if not pages:
            raise ValueError("No pages provided in input")
        
        # Extract topics from pages
        self.extract_from_pages(pages)
        
        # Generate output
        output = self.generate_output(unit_name)
        
        return output

    def to_json(self, output: Dict[str, Any], pretty: bool = True) -> str:
        """Convert output to JSON string."""
        if pretty:
            return json.dumps(output, indent=2, ensure_ascii=False)
        return json.dumps(output, ensure_ascii=False)


def main():
    """Example usage of the knowledge graph extractor."""
    # Example input
    example_input = {
        "unit": "Operating Systems Fundamentals",
        "pages": [
            {
                "page": 1,
                "content": """
                # Process Management
                
                Process Scheduling: The allocation of CPU time to different processes.
                Process States: A process can be in Running, Waiting, or Ready state.
                
                Round Robin Scheduling - A scheduling algorithm that allocates fixed time slices.
                FCFS (First Come First Serve) - The simplest scheduling algorithm.
                Priority Scheduling - Processes are scheduled based on priority levels.
                """
            },
            {
                "page": 2,
                "content": """
                ## Memory Management
                
                Virtual Memory: A memory management technique using disk space as extension.
                Paging: The process of dividing memory into fixed-size pages.
                Segmentation: Memory management by dividing into variable-size segments.
                
                Memory Fragmentation - External fragmentation occurs when free space is scattered.
                Page Replacement Algorithm - Algorithms like LRU determine which page to remove.
                """
            }
        ]
    }
    
    # Extract knowledge graph
    extractor = KnowledgeGraphExtractor()
    output = extractor.extract(example_input)
    
    # Print results
    json_output = extractor.to_json(output)
    print(json_output)
    
    # Save to file
    with open("/tmp/knowledge_graph.json", "w") as f:
        f.write(json_output)
    
    print(f"\nExtracted {output['metadata']['total_topics']} topics")
    print(f"Found {output['metadata']['total_relations']} relations")


if __name__ == "__main__":
    main()