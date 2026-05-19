import fitz  # PyMuPDF
import os
import sys
import json
import io
from PIL import Image
import pytesseract
from tqdm import tqdm

# Disable PIL decompression bomb protection for large PDF renderings (use with caution)
Image.MAX_IMAGE_PIXELS = None

def extract_pdf_to_json(pdf_path, output_dir="output", tess_cmd=None, dpi=300):
    """Render each page of `pdf_path` and OCR text with Tesseract.

    Returns the path to the saved JSON file.
    """
    if tess_cmd:
        pytesseract.pytesseract.tesseract_cmd = tess_cmd

    os.makedirs(output_dir, exist_ok=True)

    # Open PDF
    doc = fitz.open(pdf_path)

    all_pages_text = []

    for page_number in tqdm(range(doc.page_count), desc="OCR", unit="page"):
        print(f"Processing Page {page_number + 1}")

        # First try to extract embedded/text-layer PDF text
        page = doc.load_page(page_number)
        try:
            text = page.get_text().strip()
        except Exception:
            text = ""

        # If no embedded text, attempt OCR only if Tesseract is available
        if not text:
            try:
                pytesseract.get_tesseract_version()
                tesseract_available = True
            except Exception:
                tesseract_available = False

            if tesseract_available:
                # Render page to image at requested DPI for better OCR
                pix = page.get_pixmap(dpi=dpi)
                img = Image.open(io.BytesIO(pix.tobytes("png")))

                try:
                    text = pytesseract.image_to_string(img)
                except Exception as e:
                    text = ""
                    print(f"Warning: OCR failed on page {page_number + 1}: {e}")
            else:
                print(f"Note: no embedded text and Tesseract not available; page {page_number + 1} will be empty")

        page_entry = {
            "page": page_number + 1,
            "text": text
        }

        all_pages_text.append(page_entry)

    # Write JSON output
    base = os.path.splitext(os.path.basename(pdf_path))[0]
    output_json = os.path.join(output_dir, base + ".json")
    with open(output_json, "w", encoding="utf-8") as jf:
        json.dump(all_pages_text, jf, ensure_ascii=False, indent=2)

    print(f"\n✅ OCR Extraction Completed! JSON saved to: {output_json}")
    # Return the directory containing the OCR JSON (so callers can construct paths)
    return output_dir


if __name__ == "__main__":
    PDF_PATH = sys.argv[1] if len(sys.argv) > 1 else exit("Usage: python pdfExtracter.py <path_to_pdf>")
    # Optional: allow overriding tesseract path via env var TESSERACT_CMD
    tesseract_path = os.environ.get("TESSERACT_CMD")

    if not tesseract_path:
        raise ValueError(
        "TESSERACT_CMD environment variable not set"
    )
    extract_pdf_to_json(PDF_PATH, output_dir="output/OCR_PDF", tess_cmd=tesseract_path)