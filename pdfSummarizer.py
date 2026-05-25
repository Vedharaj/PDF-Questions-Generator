"""
Page-wise Content Summarizer using Google Gemini API.
Reads OCR JSON content page-by-page, summarizes the selected page range,
and saves the result as a Markdown file under output/summaries/.
"""

import argparse
import json
import os
import sys
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv

from progress_ui import progress_iter

load_dotenv()

# =====================================================
# CONFIGURATION
# =====================================================

API_KEY = os.getenv("GOOGLE_API_KEY")

DEFAULT_JSON_FILE = os.path.join("output", "OCR_PDF", "Unit-9.json")
DEFAULT_START_PAGE = 4
DEFAULT_END_PAGE = 5
MODEL_NAME = "gemini-3.1-flash-lite"

OUTPUT_DIR = os.path.join("output", "summaries")
INPUT_FOLDER = os.path.join("output", "OCR_PDF")

# =====================================================
# GEMINI CONFIG
# =====================================================

if API_KEY:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel(MODEL_NAME)
else:
    model = None

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


def summarize_page_content(content, page_num):
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

    response = model.generate_content(prompt)
    return response.text.strip()


def process_pages(json_file, start_page=None, end_page=None):
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
        summary = summarize_page_content(content, page_num)

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
    if not API_KEY:
        print("\nError: GOOGLE_API_KEY is not set")
        sys.exit(1)

    args = parse_arguments()

    if args.input_file:
        json_path = Path(args.input_file)
        output_file = os.path.join(OUTPUT_DIR, f"{json_path.stem}.md")

        results = process_pages(str(json_path), args.start_page, args.end_page)
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

            results = process_pages(str(json_path))
            if results:
                save_summaries_as_markdown(results, output_file)
