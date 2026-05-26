import os
import sys
from pathlib import Path
import json

from pdfExtracter import extract_pdf_to_json
from Questions_Generator import generate_questions


BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR.parent / "data"


def main():
    if len(sys.argv) < 2:
        print("Usage: python main.py <path_to_pdf> [start_page] [end_page] [question_count] [difficulty]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    start_page = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    end_page = int(sys.argv[3]) if len(sys.argv) > 3 else 99999
    question_count = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    difficulty = sys.argv[5] if len(sys.argv) > 5 else "Medium"

    base = Path(pdf_path).stem

    # Step 1: OCR extract to OCR_PDF/<base>.json
    ocr_dir = DATA_DIR / "OCR_PDF"
    ocr_dir.mkdir(parents=True, exist_ok=True)
    ocr_json = ocr_dir / f"{base}.json"

    if ocr_json.exists():
        print(f"OCR output already exists at {ocr_json}; skipping OCR extraction.")
    else:
        # Pass TESSERACT_CMD environment variable to extractor if present
        tesseract_path = os.environ.get("TESSERACT_CMD")
        returned_dir = extract_pdf_to_json(pdf_path, output_dir=ocr_dir, tess_cmd=tesseract_path)
        # extract_pdf_to_json now returns the directory containing the OCR JSON
        ocr_json = Path(returned_dir) / f"{base}.json"

    # Step 2: Generate questions from OCR JSON and save to Questions/<base>.json
    questions_dir = DATA_DIR / "Questions"
    questions_dir.mkdir(parents=True, exist_ok=True)
    questions_out = questions_dir / f"{base}.json"

    # Read OCR JSON and determine available page range
    with open(ocr_json, "r", encoding="utf-8") as f:
        ocr_data = json.load(f)

    available_pages = [item.get("page") for item in ocr_data if isinstance(item.get("page"), int)]
    if not available_pages:
        print("No pages found in OCR output; aborting question generation.")
        sys.exit(1)

    max_page = max(available_pages)

    # Validate start/end
    if start_page > max_page:
        print(f"Start page {start_page} is beyond the PDF's last page ({max_page}). Aborting.")
        sys.exit(1)

    if end_page > max_page:
        print(f"End page {end_page} exceeds last page ({max_page}); adjusting end_page to {max_page}.")
        end_page = max_page

    generate_questions(ocr_json, start_page, end_page, question_count, difficulty, questions_out)


if __name__ == '__main__':
    main()
