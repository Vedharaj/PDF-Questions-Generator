from flask import Flask, jsonify, send_from_directory, abort, Response
from flask_cors import CORS
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_DIR = os.path.join(BASE_DIR, "output", "Questions")
SUMMARIES_DIR = os.path.join(BASE_DIR, "output", "summaries")

app = Flask(__name__)
CORS(app)


@app.route("/api/files", methods=["GET"])
def list_files():
    """Return a JSON list of available .json files in the Questions folder."""
    if not os.path.isdir(QUESTIONS_DIR):
        return jsonify([])

    files = [f for f in os.listdir(QUESTIONS_DIR) if f.lower().endswith('.json')]
    files.sort()
    return jsonify(files)


@app.route("/api/questions/<path:filename>", methods=["GET"])
def get_question_file(filename):
    """Serve a JSON question file from the Questions folder.

    Security: only serve files that exist in the QUESTIONS_DIR and end with .json.
    """
    if not filename.lower().endswith('.json'):
        abort(400, "Only .json files are allowed")

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

    files = [f for f in os.listdir(SUMMARIES_DIR) if f.lower().endswith('.md')]
    files.sort()
    return jsonify(files)


@app.route("/api/summaries/<path:filename>", methods=["GET"])
def get_summary_file(filename):
    """Return the content of a Markdown summary file."""
    if not filename.lower().endswith('.md'):
        abort(400, "Only .md files are allowed")

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
