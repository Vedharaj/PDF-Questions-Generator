from flask import Flask, jsonify, send_from_directory, abort, Response
from flask_cors import CORS
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR.parent / "data"
QUESTIONS_DIR = DATA_DIR / "Questions"
SUMMARIES_DIR = DATA_DIR / "summaries"
FLASHCARDS_DIR = DATA_DIR / "Flashcards"
MAPPING_DIR = DATA_DIR / "mappingTree"

app = Flask(__name__)
CORS(app)


@app.route("/api/files", methods=["GET"])
def list_files():
    """Return a JSON list of available question file names without extension."""
    if not os.path.isdir(QUESTIONS_DIR):
        return jsonify([])

    files = [os.path.splitext(f)[0] for f in os.listdir(QUESTIONS_DIR) if f.lower().endswith('.json')]
    files.sort()
    return jsonify(files)


@app.route("/api/questions/<path:filename>", methods=["GET"])
def get_question_file(filename):
    """Serve a JSON question file from the Questions folder.

    Security: only serve files that exist in the QUESTIONS_DIR and end with .json.
    """
    if not filename.lower().endswith('.json'):
        filename = f"{filename}.json"

    # Prevent directory traversal by resolving the real path and checking prefix
    requested_path = os.path.realpath(os.path.join(QUESTIONS_DIR, filename))
    if not requested_path.startswith(os.path.realpath(QUESTIONS_DIR) + os.sep):
        abort(403)

    if not os.path.exists(requested_path):
        abort(404)

    return send_from_directory(QUESTIONS_DIR, filename)


@app.route("/api/summaries", methods=["GET"])
def list_summary_files():
    """Return a JSON list of available .md files in the summaries folder."""
    if not os.path.isdir(SUMMARIES_DIR):
        return jsonify([])

    files = [os.path.splitext(f)[0] for f in os.listdir(SUMMARIES_DIR) if f.lower().endswith('.md')]
    files.sort()
    return jsonify(files)


@app.route("/api/flashcards", methods=["GET"])
def list_flashcard_files():
    """Return a JSON list of available flashcard file names without extension."""
    if not os.path.isdir(FLASHCARDS_DIR):
        return jsonify([])

    files = [os.path.splitext(f)[0] for f in os.listdir(FLASHCARDS_DIR) if f.lower().endswith('.json')]
    files.sort()
    return jsonify(files)


@app.route("/api/flashcards/<path:filename>", methods=["GET"])
def get_flashcard_file(filename):
    """Serve a JSON flashcard file from the Flashcards folder.

    Security: only serve files that exist in the FLASHCARDS_DIR and end with .json.
    """
    if not filename.lower().endswith('.json'):
        filename = f"{filename}.json"

    requested_path = os.path.realpath(os.path.join(FLASHCARDS_DIR, filename))
    if not requested_path.startswith(os.path.realpath(FLASHCARDS_DIR) + os.sep):
        abort(403)

    if not os.path.exists(requested_path):
        abort(404)

    return send_from_directory(FLASHCARDS_DIR, filename)


@app.route("/api/mappings", methods=["GET"])
def list_mapping_files():
    """Return a JSON list of available mapping JSON file names without extension."""
    if not os.path.isdir(MAPPING_DIR):
        return jsonify([])

    files = [os.path.splitext(f)[0] for f in os.listdir(MAPPING_DIR) if f.lower().endswith('.json')]
    files.sort()
    return jsonify(files)


@app.route("/api/mappings/<path:filename>", methods=["GET"])
def get_mapping_file(filename):
    """Serve a JSON mapping file from the mappingTree folder with traversal protection."""
    if not filename.lower().endswith('.json'):
        filename = f"{filename}.json"

    requested_path = os.path.realpath(os.path.join(MAPPING_DIR, filename))
    if not requested_path.startswith(os.path.realpath(MAPPING_DIR) + os.sep):
        abort(403)

    if not os.path.exists(requested_path):
        abort(404)

    return send_from_directory(MAPPING_DIR, filename)


@app.route("/api/summaries/<path:filename>", methods=["GET"])
def get_summary_file(filename):
    """Return the content of a Markdown summary file."""
    if not filename.lower().endswith('.md'):
        filename = f"{filename}.md"

    requested_path = os.path.realpath(os.path.join(SUMMARIES_DIR, filename))
    if not requested_path.startswith(os.path.realpath(SUMMARIES_DIR) + os.sep):
        abort(403)

    if not os.path.exists(requested_path):
        abort(404)

    with open(requested_path, "r", encoding="utf-8") as handle:
        content = handle.read()

    return Response(content, mimetype="text/markdown; charset=utf-8")


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "questions_dir": os.path.abspath(QUESTIONS_DIR), "summaries_dir": os.path.abspath(SUMMARIES_DIR)})


if __name__ == '__main__':
    # Development server
    app.run(host='0.0.0.0', port=8000, debug=True)

# This file runs as a normal Flask (WSGI) app. Run with:
#   python server.py
# or for production with Gunicorn (if desired):
#   gunicorn -w 4 -b 0.0.0.0:8000 server:app
