import json
import argparse
import os
import re
import time
from pathlib import Path
from dotenv import load_dotenv

import google.generativeai as genai
from tqdm import tqdm

from progress_ui import progress_iter
from gemini_utils import GeminiKeyRotator, collect_api_keys, MODEL_NAME

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR.parent / "data"

# =========================================================
# CONFIG
# =========================================================

# Load env vars (supports GOOGLE_API_KEY / GOOGLE_API_KEYS)
load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")

# MODEL_NAME is imported from gemini_utils

# Input pages (same schema as previous scripts)
INPUT_JSON = os.getenv("INPUT_JSON", str(DATA_DIR / "pages.json"))
INPUT_FOLDER = os.getenv("INPUT_FOLDER", str(DATA_DIR / "OCR_PDF"))

# Create a dedicated folder for flashcard outputs
OUTPUT_FOLDER = DATA_DIR / "Flashcards"
OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

OUTPUT_JSON = OUTPUT_FOLDER / "flashcards.json"


MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))

REQUEST_DELAY = int(os.getenv("REQUEST_DELAY", "2"))

MIN_CONTENT_LENGTH = int(os.getenv("MIN_CONTENT_LENGTH", "50"))

# Optional page range
START_PAGE = int(os.getenv("START_PAGE", "0"))
END_PAGE = int(os.getenv("END_PAGE", "999999"))

# =========================================================
# SETUP
# =========================================================

genai.configure(api_key=API_KEY)

# We'll use a key rotator for resilient requests
API_KEYS = collect_api_keys(API_KEY)
API_ROTATOR = GeminiKeyRotator(API_KEYS)

# =========================================================
# LOAD PAGE DATA (loaded per-input file later)
# =========================================================

# =========================================================
# PROMPT
# =========================================================

SYSTEM_PROMPT = """
You are an advanced educational AI system.

Your task:
Generate high-quality educational flashcards from page content.

Generate flashcards dynamically:
- Small/simple page → fewer flashcards
- Dense technical page → more flashcards
- Formula-heavy page → additional formula cards
- Concept-heavy page → additional conceptual cards

IMPORTANT:
Every flashcard MUST include:
- question
- answer
- concept
- difficulty
- bloom_taxonomy_level
- card_type
- keywords
- page_number

=========================================================

Bloom Taxonomy Levels:
- remember
- understand
- apply
- analyze
- evaluate
- create

=========================================================

Difficulty Values:
- easy
- medium
- hard

=========================================================

Card Types:
- definition
- conceptual
- formula
- process
- example
- comparison
- application
- mcq
- true_false

=========================================================

Rules:
- Avoid duplicate flashcards
- Make concise but informative answers
- Use technically accurate language
- Create strong revision-oriented flashcards
- Include important formulas if present
- Include process explanations if present
- Generate application-based questions when possible
- Generate analytical questions for advanced topics

=========================================================

Output ONLY valid JSON.

Do NOT output markdown.

Do NOT explain anything.

JSON FORMAT:

{
  "flashcards": [
    {
      "question": "...",
      "answer": "...",
      "concept": "...",
      "difficulty": "easy",
      "bloom_taxonomy_level": "understand",
      "card_type": "definition",
      "keywords": ["...", "..."],
      "page_number": 1
    }
  ]
}
"""

# =========================================================
# CLEAN RESPONSE
# =========================================================

def clean_json_response(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```json", "", text)
    text = re.sub(r"^```", "", text)
    text = re.sub(r"```$", "", text)
    return text.strip()


def repair_invalid_json_escapes(text: str) -> str:
    """Escape stray backslashes inside JSON strings without touching valid escapes."""
    valid_escapes = set('"\\/bfnrtu')
    repaired = []
    in_string = False
    i = 0
    while i < len(text):
        char = text[i]
        if char == '"':
            repaired.append(char)
            escaped = False
            j = i - 1
            while j >= 0 and text[j] == '\\':
                escaped = not escaped
                j -= 1
            if not escaped:
                in_string = not in_string
            i += 1
            continue

        if in_string and char == '\\':
            next_char = text[i + 1] if i + 1 < len(text) else ''
            if next_char not in valid_escapes:
                repaired.append('\\\\')
                i += 1
                continue

        repaired.append(char)
        i += 1

    return ''.join(repaired)

# =========================================================
# GENERATE FLASHCARDS
# =========================================================

def generate_flashcards(page_no: int, content: str, model_name: str, api_rotator: GeminiKeyRotator):
    prompt = f"""
{SYSTEM_PROMPT}

PAGE NUMBER:
{page_no}

PAGE CONTENT:
{content}
"""

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = api_rotator.generate_content(prompt, model_name, max_attempts=1, error_label=f"Page {page_no}")
        except Exception as e:
            print(f"[ERROR] Page {page_no} | Attempt {attempt}/{MAX_RETRIES} -> {e}")
            if attempt < MAX_RETRIES:
                time.sleep(3 + attempt * 2)
                continue
            return {"page": page_no, "flashcard_count": 0, "flashcards": [], "failed": True}

        raw_text = getattr(resp, "text", str(resp))

        cleaned = clean_json_response(raw_text)
        repaired = repair_invalid_json_escapes(cleaned)

        try:
            parsed = json.loads(repaired)
        except Exception as e:
            print(f"Warning: failed to parse JSON for page {page_no}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(3 + attempt * 2)
                continue
            return {"page": page_no, "flashcard_count": 0, "flashcards": [], "failed": True, "raw": raw_text}

        flashcards = parsed.get("flashcards", []) if isinstance(parsed, dict) else []

        validated_cards = []

        for card in flashcards:
            if not isinstance(card, dict):
                continue

            validated_card = {
                "question": str(card.get("question", "")).strip(),
                "answer": str(card.get("answer", "")).strip(),
                "concept": str(card.get("concept", "")).strip(),
                "difficulty": card.get("difficulty", "medium"),
                "bloom_taxonomy_level": card.get("bloom_taxonomy_level", "Remember"),
                "card_type": card.get("card_type", "conceptual"),
                "keywords": card.get("keywords", []),
                "page_number": page_no,
            }

            if validated_card["question"] and validated_card["answer"]:
                validated_cards.append(validated_card)

        return {"page": page_no, "flashcard_count": len(validated_cards), "flashcards": validated_cards}

# =========================================================
# PROCESSING: per-file approach
# If `--input-json` provided, process a single file. Otherwise process all JSONs in INPUT_FOLDER.
# =========================================================


def process_input_file(input_path: str):
    out_stem = Path(input_path).stem
    out_json = OUTPUT_FOLDER / f"{out_stem}_flashcards.json"
    failed_json = OUTPUT_FOLDER / f"{out_stem}_failed_pages.json"

    # Load page data for this input
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            pages = json.load(f)
    except Exception as e:
        print(f"Error reading {input_path}: {e}")
        return

    # Reset per-file accumulators
    existing_questions = []
    completed_pages = set()
    failed_pages = []
    total_flashcards = 0

    if os.path.exists(out_json):
        try:
            with open(out_json, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
            if isinstance(existing_data, dict) and "pages" in existing_data:
                existing_pages = existing_data.get("pages", [])
            elif isinstance(existing_data, list):
                existing_pages = existing_data
            else:
                existing_pages = []

            for item in existing_pages:
                page = item.get("page") if isinstance(item, dict) else None
                if isinstance(page, int):
                    completed_pages.add(page)
                    existing_questions.append(item)
        except Exception:
            existing_questions = []
            completed_pages = set()

    # Collect selected pages within requested range
    selected_pages = []
    for item in pages:
        page = item.get("page")
        if isinstance(page, int) and START_PAGE <= page <= END_PAGE:
            # Support both `text` and `content` keys coming from different pipelines
            page_text = item.get("text", item.get("content", ""))
            selected_pages.append((page, page_text))

    if not selected_pages:
        print(f"No pages found in {input_path} within the given range.")
        return

    if completed_pages:
        requested_pages = sorted({p for p, _ in selected_pages})
        missing_pages = [p for p in requested_pages if p not in completed_pages]
        if not missing_pages:
            print(f"All requested pages from {START_PAGE} to {END_PAGE} are already present in {out_json}; nothing to generate.")
            return
        else:
            print(f"Found already-generated pages: {sorted(completed_pages)}. Will generate missing pages: {missing_pages}.")
            pending_pages = [(p, text) for p, text in selected_pages if p in missing_pages]
    else:
        pending_pages = sorted(selected_pages, key=lambda x: x[0])

    # Generate and append page results incrementally to the output file.
    for page_num, page_text in progress_iter(pending_pages, f"Generating flashcards for {out_stem}", unit="pages"):
        content = page_text.strip()
        if len(content) < MIN_CONTENT_LENGTH:
            print(f"\n[SKIPPED] Page {page_num} too small.\n")
            continue

        result = generate_flashcards(page_num, content, MODEL_NAME, API_ROTATOR)

        if not result or result.get("flashcard_count", 0) == 0:
            if result.get("failed"):
                failed_pages.append(page_num)
            continue

        existing_questions.append(result)
        try:
            with open(out_json, "w", encoding="utf-8") as f:
                total_flashcards = sum(item.get("flashcard_count", 0) for item in existing_questions)
                out = {
                    "metadata": {"model": MODEL_NAME, "total_pages_processed": len(existing_questions), "total_flashcards": total_flashcards, "failed_pages": failed_pages},
                    "pages": existing_questions,
                }
                json.dump(out, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving questions after page {page_num}: {e}")

        total_flashcards += result.get("flashcard_count", 0)

        time.sleep(REQUEST_DELAY)

    final_output = {
        "metadata": {
            "model": MODEL_NAME,
            "total_pages_processed": len(existing_questions),
            "total_flashcards": total_flashcards,
            "failed_pages": failed_pages
        },
        "pages": existing_questions
    }

    try:
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(final_output, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error writing final outputs for {input_path}: {e}")

    print("\n====================================")
    print("FLASHCARD GENERATION COMPLETE")
    print("====================================")

    print(f"Pages Processed : {len(existing_questions)}")
    print(f"Total Flashcards: {total_flashcards}")
    print(f"Failed Pages    : {len(failed_pages)}")

    print(f"\nSaved Output:")
    print(f"-> {out_json}")


def main():
    parser = argparse.ArgumentParser(description="Generate flashcards from OCR JSON files.")
    parser.add_argument("--input-json", help="Path to a single OCR JSON file")
    args = parser.parse_args()

    # Determine files to process
    if args.input_json:
        files_to_process = [args.input_json]
    else:
        folder = Path(INPUT_FOLDER)
        if not folder.exists():
            print(f"Input folder not found: {INPUT_FOLDER}")
            return
        files_to_process = sorted([str(p) for p in folder.glob("*.json")])

    if not files_to_process:
        print("No JSON files found to process.")
        return

    print("\nGenerating Flashcards...\n")
    for fpath in files_to_process:
        print(f"\nProcessing input: {fpath}")
        process_input_file(fpath)


if __name__ == "__main__":
    main()