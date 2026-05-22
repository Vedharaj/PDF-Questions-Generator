import os
import json
import re
import time
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
from tqdm import tqdm
from dotenv import load_dotenv

import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

# Load environment variables from .env file
load_dotenv()

# =====================================================
# CONFIGURATION
# =====================================================

API_KEY = os.getenv("GOOGLE_API_KEY")

JSON_FILE = os.path.join("output", "OCR_PDF", "Unit-9.json")

START_PAGE = 4
END_PAGE = 5

QUESTION_COUNT = 10

DIFFICULTY = "Medium"

OUTPUT_FILE = os.path.join("output", "Questions", JSON_FILE.split("\\")[-1].split(".")[0] + ".json")

# =====================================================
# CONFIGURE GEMINI
# =====================================================

genai.configure(api_key=API_KEY)

model = genai.GenerativeModel("gemini-3.1-flash-lite")

# NOTE: JSON loading is done inside `generate_questions` to avoid
# importing this module from failing when the file doesn't exist.

# =====================================================
# PROMPT
# =====================================================
# We'll distribute QUESTION_COUNT across the selected pages and
# generate questions for each page separately so we can tag
# each question with its source `page` number.

def generate_for_page(page_num, page_text, count, difficulty, model):
    """Generate `count` questions from `page_text` and return list."""
    page_prompt = f"""
You are an expert Computer Science exam question generator.

Generate {count} MCQ questions from the given content.

Rules:
- Difficulty: {difficulty}
- Each question must have 4 options
- Mention correct answer
- Add short explanation
- Avoid duplicate questions
- Focus on conceptual understanding
- Return ONLY valid JSON

JSON FORMAT:

[
  {{
    "question": "",
    "options": ["", "", "", ""],
    "answer": "",
    "explanation": "",
    "page": {page_num}
  }}
]

CONTENT:
{page_text}
"""

    max_retries = 3
    last_raw = None

    def repair_invalid_json_escapes(text):
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

    for attempt in range(1, max_retries + 1):
        # print(f"Generating {count} questions for page {page_num} (attempt {attempt})...\n")
        try:
            resp = model.generate_content(page_prompt)
        except ResourceExhausted as e:
            last_raw = str(e)
            if attempt < max_retries:
                print("Rate limit reached. Waiting 60 seconds before retrying...")
                time.sleep(60)
                continue
            print(f"❌ Rate limit error for page {page_num} after {max_retries} attempts: {e}")
            return []

        raw = resp.text
        last_raw = raw

        cleaned = re.sub(r"```json|```", "", raw).strip()
        repaired = repair_invalid_json_escapes(cleaned)

        try:
            qlist = json.loads(repaired)
            # Ensure each question contains the page and difficulty fields
            for q in qlist:
                q["page"] = page_num
                q["difficulty"] = difficulty
            return qlist
        except Exception as e:
            print(f"Warning: failed to parse JSON (attempt {attempt}): {e}")
            if attempt < max_retries:
                print("Retrying after 30s...")
                time.sleep(30)
            else:
                print(f"❌ Failed to parse JSON for page {page_num} after {max_retries} attempts. Raw response:\n{last_raw}\n")
                return []


def generate_questions(json_file, start_page, end_page, question_count, difficulty, output_file, api_key=None, model_name=None):
    """Generate questions from `json_file` for pages in [start_page,end_page].

    Appends to `output_file` if it already exists, skipping pages that
    were previously completed, and returns the full saved list of questions.
    """
    # configure API key if provided
    if api_key:
        genai.configure(api_key=api_key)

    model_to_use = model if model_name is None else genai.GenerativeModel(model_name)

    # Build selected_text as a list of (page_num, text)
    with open(json_file, "r", encoding="utf-8") as f:
        data_local = json.load(f)

    # Collect pages from the source JSON within the requested range
    selected_pages = []
    for item in data_local:
        page = item.get("page")
        if isinstance(page, int) and start_page <= page <= end_page:
            selected_pages.append((page, item.get("text", "")))

    if not selected_pages:
        print("No pages found in the given range.")
        return []

    # Load existing output (if any) to determine progress
    existing_questions = []
    completed_pages = set()

    if os.path.exists(output_file):
        try:
            with open(output_file, "r", encoding="utf-8") as f:
                existing_questions = json.load(f)
            if not isinstance(existing_questions, list):
                existing_questions = []
            for item in existing_questions:
                page = item.get("page") if isinstance(item, dict) else None
                if isinstance(page, int):
                    completed_pages.add(page)
        except Exception:
            existing_questions = []
            completed_pages = set()

    # If output exists, compute which pages are already present and generate only the missing ones
    if completed_pages:
        # Pages requested in the selected range
        requested_pages = sorted({page_num for page_num, _ in selected_pages})
        # Pages that still need generation
        missing_pages = [p for p in requested_pages if p not in completed_pages]
        if not missing_pages:
            print(f"All requested pages from {start_page} to {end_page} are already present in {output_file}; nothing to generate.")
            return existing_questions
        print(f"Found already-generated pages: {sorted(completed_pages)}. Will generate missing pages: {missing_pages}.")
        pending_pages = [(page_num, page_text) for page_num, page_text in selected_pages if page_num in missing_pages]
    else:
        # No existing output; generate all selected pages
        pending_pages = sorted(selected_pages, key=lambda x: x[0])

    # Generate and append page results incrementally to the output file.
    for page_num, page_text in tqdm(pending_pages, desc="Question generation", unit="page"):
        # Generate `question_count` questions for each page (per-page count)
        count = question_count
        if count <= 0:
            continue

        page_questions = generate_for_page(page_num, page_text, count, difficulty, model_to_use)

        if not page_questions:
            # Nothing generated for this page (error or empty response); skip writing
            continue

        # Ensure each returned question has `page` and `difficulty`
        for q in page_questions:
            if isinstance(q, dict):
                q.setdefault("page", page_num)
                q.setdefault("difficulty", difficulty)

        # Append to in-memory existing_questions and write immediately to disk
        existing_questions.extend(page_questions)
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(existing_questions, f, indent=4, ensure_ascii=False)
            # print(f"Appended {len(page_questions)} questions for page {page_num} to: {output_file}")
        except Exception as e:
            print(f"Error saving questions after page {page_num}: {e}")

    # Final in-memory list is the saved questions
    all_questions = existing_questions

    # Ensure every question has `page` and `difficulty` fields before returning
    for q in all_questions:
        if isinstance(q, dict):
            if "page" not in q:
                q["page"] = None
            if "difficulty" not in q:
                q["difficulty"] = difficulty

    print(f"✅ Questions saved to: {output_file}")
    return all_questions


if __name__ == "__main__":
    # Run with the file-level constants
    generate_questions(JSON_FILE, START_PAGE, END_PAGE, QUESTION_COUNT, DIFFICULTY, OUTPUT_FILE, api_key=API_KEY)