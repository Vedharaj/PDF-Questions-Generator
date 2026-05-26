import os
import sys
import argparse
import shutil
from pdf2image import convert_from_path
import pytesseract

from progress_ui import progress_iter


def find_executable_from_env_or_path(env_vars, exe_name=None):
    for env in env_vars:
        val = os.environ.get(env)
        if val:
            return val
    if exe_name:
        which = shutil.which(exe_name)
        if which:
            return which
    return None


def ocr_pdf(input_pdf, output_txt, tesseract_cmd=None, poppler_path=None, lang="eng", dpi=300):
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    print("Converting PDF pages to images...")
    try:
        pages = convert_from_path(input_pdf, dpi=dpi, poppler_path=poppler_path)
    except Exception as e:
        print("Error converting PDF to images:", e)
        if sys.platform.startswith("win"):
            print("On Windows, ensure Poppler binaries are installed and provide --poppler-path or set POPPLER_PATH environment variable.")
            print("Download from: https://poppler.freedesktop.org/ or use a package manager. Example path: C:\\poppler\\bin")
        else:
            print("Ensure Poppler is installed (pdftoppm available on PATH).")
        raise

    all_text = []
    print(f"Processing {len(pages)} pages with OCR...\n")

    for i, page in enumerate(progress_iter(pages, "OCR progress", unit="pages")):
        try:
            text = pytesseract.image_to_string(page, lang=lang)
        except Exception as e:
            print(f"Warning: OCR failed on page {i+1}: {e}")
            text = ""

        all_text.append(f"\n\n----- PAGE {i+1} -----\n\n")
        all_text.append(text)

    with open(output_txt, "w", encoding="utf-8") as f:
        f.write("".join(all_text))

    print("\nOCR completed ✅")
    print(f"Saved output to: {output_txt}")


def main(argv=None):
    parser = argparse.ArgumentParser(description="OCR a PDF to plain text using Tesseract and pdf2image.")
    parser.add_argument("input", help="Input PDF file path")
    parser.add_argument("output", help="Output text file path")
    parser.add_argument("--tesseract", help="Full path to tesseract executable (overrides env TESSERACT_CMD)")
    parser.add_argument("--poppler-path", help="Full path to poppler binaries (if required on Windows)")
    parser.add_argument("--lang", default="eng", help="Tesseract language(s), e.g. 'eng' or 'eng+tam'")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for convert_from_path (default 300)")

    args = parser.parse_args(argv)

    # Try environment variables or PATH for tesseract
    tesseract_cmd = args.tesseract or find_executable_from_env_or_path(["TESSERACT_CMD", "TESSERACT_PATH"], "tesseract")
    if not tesseract_cmd:
        print("Error: Tesseract executable not found. Set --tesseract or the TESSERACT_CMD/TESSERACT_PATH environment variable, or ensure 'tesseract' is on PATH.")
        sys.exit(1)

    poppler_path = args.poppler_path or os.environ.get("POPPLER_PATH")

    # Try to auto-detect common Poppler locations if not provided
    def find_poppler_path(provided=None):
        if provided:
            return provided
        env = os.environ.get("POPPLER_PATH")
        if env:
            return env
        # check for pdftoppm on PATH (Unix / installed poppler)
        which_pdftoppm = shutil.which("pdftoppm")
        if which_pdftoppm:
            return os.path.dirname(which_pdftoppm)
        # common Windows locations
        if sys.platform.startswith("win"):
            import glob
            candidates = [r"C:\\poppler\\bin", r"C:\\Program Files\\poppler\\bin", r"C:\\Program Files (x86)\\poppler\\bin"]
            for pattern in [r"C:\\Program Files\\poppler*\\bin", r"C:\\Program Files (x86)\\poppler*\\bin"]:
                candidates.extend(glob.glob(pattern))
            for c in candidates:
                if os.path.isdir(c):
                    return c
        return None

    poppler_path = find_poppler_path(poppler_path)

    try:
        ocr_pdf(args.input, args.output, tesseract_cmd=tesseract_cmd, poppler_path=poppler_path, lang=args.lang, dpi=args.dpi)
    except Exception:
        sys.exit(1)


if __name__ == "__main__":
    main()