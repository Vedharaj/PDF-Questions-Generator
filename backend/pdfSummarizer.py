"""
Page-wise Content Summarizer using Google Gemini API.
Reads OCR JSON content page-by-page, summarizes the selected page range,
and saves the result as a Markdown file under data/summaries/.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

from progress_ui import progress_iter
from gemini_utils import GeminiKeyRotator, collect_api_keys

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR.parent / "data"

import warnings

warnings.filterwarnings(
    "ignore",
    message=".*google.generativeai.*"
)

warnings.filterwarnings(
    "ignore",
    message=".*Python version.*"
)

# =====================================================
# CONFIGURATION
# =====================================================

API_KEY = os.getenv("GOOGLE_API_KEY")
API_KEYS = collect_api_keys(API_KEY)
API_ROTATOR = GeminiKeyRotator(API_KEYS)

DEFAULT_JSON_FILE = DATA_DIR / "OCR_PDF" / "Unit-9.json"
DEFAULT_START_PAGE = 4
DEFAULT_END_PAGE = 5
from gemini_utils import MODEL_NAME

OUTPUT_DIR = DATA_DIR / "summaries"
INPUT_FOLDER = DATA_DIR / "OCR_PDF"

# =====================================================
# HELPERS
# =====================================================

def load_content_from_json(file_path):
    """Load OCR page content from a JSON file."""
    try:
        with open(file_path, "r", encoding="utf-8") as handle:
            data = json.load(handle)

        if not isinstance(data, list):
            raise ValueError("JSON content must be a list of objects")

        pages = []
        for item in data:
            if not isinstance(item, dict):
                continue

            page = item.get("page")
            text = item.get("text", item.get("content", ""))

            if isinstance(page, int):
                pages.append({"page": page, "text": text})

        return pages
    except json.JSONDecodeError as error:
        print(f"\nError parsing JSON: {error}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"\nFile not found: {file_path}")
        sys.exit(1)


def summarize_page_content(content, page_num, api_rotator):
    """Summarize a single page using Gemini."""
    prompt = f"""You are an expert study-material summarizer.

Summarize the following page in a concise, clear, and well-structured way.
Focus on key concepts, important definitions, and main ideas.
Keep the summary easy to study from.

Page {page_num} Content:
---
{content}
---

Return only the summary text.
"""

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            response = api_rotator.generate_content(
                prompt,
                MODEL_NAME,
                max_attempts=1,
                error_label=f"Page {page_num}",
            )
            return response.text.strip()
        except Exception as error:
            message = str(error)
            is_retryable_quota_error = (
                "Please retry in" in message
                or "retry_delay" in message
                or "quota" in message.lower()
                or "rate limit" in message.lower()
            )

            if not is_retryable_quota_error or attempt == max_attempts:
                raise

            retry_delay = 60
            retry_match = re.search(r"Please retry in ([0-9]+(?:\.[0-9]+)?)s", message)
            if retry_match:
                retry_delay = max(60, int(float(retry_match.group(1))))

            print(f"\nRate limit reached for page {page_num}. Waiting {retry_delay} seconds before retry {attempt + 1}/{max_attempts}...")
            time.sleep(retry_delay)


def process_pages(json_file, api_rotator, start_page=None, end_page=None):
    """Summarize pages in the selected range and return page-wise results."""
    pages_data = load_content_from_json(json_file)

    if start_page is None or end_page is None:
        selected_pages = pages_data
    else:
        selected_pages = [
            page_data
            for page_data in pages_data
            if start_page <= page_data["page"] <= end_page
        ]

    if not selected_pages:
        if start_page is None or end_page is None:
            print(f"\nNo pages found in {json_file}.")
        else:
            print("\nNo pages found in the given range.")
        return []

    if start_page is None or end_page is None:
        print(f"\nProcessing {len(selected_pages)} pages from {json_file}...")
    else:
        print(f"\nProcessing {len(selected_pages)} pages from {start_page} to {end_page}...")

    results = []
    for page_data in progress_iter(selected_pages, f"Summarizing {Path(json_file).name}", unit="pages"):
        page_num = page_data["page"]
        content = page_data["text"]

        # print(f"\nSummarizing page {page_num}...")
        summary = summarize_page_content(content, page_num, api_rotator)

        results.append(
            {
                "page": page_num,
                "original_content": content,
                "summary": summary,
            }
        )

    return results


def save_summaries_as_markdown(results, output_file):
    """Save summarized content as a Markdown file."""
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    try:
        with open(output_file, "w", encoding="utf-8") as handle:
            handle.write("# Study Material Summaries\n\n")
            handle.write(f"*Generated summaries of study material across {len(results)} pages*\n\n")
            handle.write("## Table of Contents\n\n")

            for result in results:
                handle.write(f"- [Page {result['page']}](#page-{result['page']})\n")

            handle.write("\n---\n\n")

            for result in results:
                page_num = result["page"]
                summary = result["summary"]

                handle.write(f"## Page {page_num}\n\n")
                handle.write(f"{summary}\n\n")
                handle.write("---\n\n")

        print(f"\n✓ Summaries saved to: {output_file}")
        print(f"\n  Total pages processed: {len(results)}")
    except IOError as error:
        print(f"\nError writing to file {output_file}: {error}")
        sys.exit(1)


def list_input_json_files(input_folder):
    """Return all JSON files in the OCR output folder."""
    folder_path = Path(input_folder)
    if not folder_path.exists():
        print(f"\nInput folder not found: {input_folder}")
        return []

    return sorted(folder_path.glob("*.json"))


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Summarize OCR JSON files into Markdown.")
    parser.add_argument("input_file", nargs="?", help="Path to a single OCR JSON file")
    parser.add_argument("--start-page", type=int, default=DEFAULT_START_PAGE, help="Start page for single-file mode")
    parser.add_argument("--end-page", type=int, default=DEFAULT_END_PAGE, help="End page for single-file mode")
    return parser.parse_args()


# =====================================================
# MAIN
# =====================================================

if __name__ == "__main__":
    if not API_KEYS:
        print("\nError: GOOGLE_API_KEY is not set")
        sys.exit(1)

    args = parse_arguments()

    if args.input_file:
        json_path = Path(args.input_file)
        output_file = os.path.join(OUTPUT_DIR, f"{json_path.stem}.md")

        results = process_pages(str(json_path), API_ROTATOR, args.start_page, args.end_page)
        if results:
            save_summaries_as_markdown(results, output_file)
    else:
        json_files = list_input_json_files(INPUT_FOLDER)
        if not json_files:
            print("\nNo JSON files found to summarize.")
            sys.exit(0)

        for json_path in progress_iter(json_files, "Processing summaries", unit="files"):
            output_file = os.path.join(OUTPUT_DIR, f"{json_path.stem}.md")

            if os.path.exists(output_file):
                print(f"\nSkipping existing file: {output_file}")
                continue

            results = process_pages(str(json_path), API_ROTATOR)
            if results:
                save_summaries_as_markdown(results, output_file)
