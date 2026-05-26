# PDF Questions Generation System

A comprehensive system for extracting text from PDF documents using OCR and automatically generating multiple-choice questions (MCQs) using Google's Generative AI. Features an interactive web-based quiz application for practicing generated questions.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

This project automates the process of creating study materials from PDF documents:

1. **PDF Text Extraction**: Extracts text from PDFs using PyMuPDF and Tesseract OCR
2. **Question Generation**: Uses Google Gemini AI to generate MCQ questions with explanations
3. **Quiz Application**: Interactive React frontend for taking quizzes with scoring, shuffling, and page filtering

**Ideal for**: Educational institutions, online learning platforms, automated exam paper generation, and study material creation.

---

## Features

### Core Features
- ✅ **PDF to OCR**: Convert PDF pages to JSON with extracted text
- ✅ **AI-Powered Question Generation**: Auto-generate MCQ questions using Google Gemini AI
- ✅ **Configurable Difficulty Levels**: Easy, Medium, Hard
- ✅ **Page-Based Filtering**: Select specific page ranges for question generation
- ✅ **Question Distribution**: Evenly distribute a specified number of questions across multiple pages
- ✅ **Interactive Quiz UI**: Clean, modern web interface for taking quizzes

### Quiz Interface Features
- 🎯 **Real-time Scoring**: Track correct/incorrect answers
- 🔀 **Question Shuffling**: Randomize question order
- ⌨️ **Keyboard Navigation**: Arrow keys to navigate between questions
- 📖 **Explanations**: View detailed explanations after answering
- 📊 **Progress Tracking**: Visual progress bar and question counter
- 📄 **Multi-file Support**: Load and switch between different question files
- 🎚️ **Page Range Selection**: Choose specific page ranges before starting quiz

---

## Project Structure

```
PDF Questions Generation/
├── main.py                      # Entry point script
├── pdfExtracter.py             # PDF extraction and OCR module
├── Questions_Generator.py       # AI question generation module
├── server.py                   # Flask backend API server
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables (API keys)
├── .gitignore                  # Git ignore rules
├── start_app.bat               # Windows startup script
│
├── client/                     # React frontend
│   ├── src/
│   │   ├── App.jsx            # Main React component
│   │   ├── App.css            # Styling
│   │   ├── main.jsx           # React entry point
│   │   ├── index.css          # Global styles
│   │   └── assets/
│   ├── public/                # Static assets
│   ├── package.json           # Node dependencies
│   ├── vite.config.js         # Vite build config
│   ├── eslint.config.js       # ESLint configuration
│   └── index.html             # HTML template
│
└── data/                      # Generated files (not committed)
    ├── OCR_PDF/               # Extracted text from PDFs (JSON)
    └── Questions/             # Generated questions (JSON)
```

---

## Prerequisites

### System Requirements
- **Python**: 3.8 or higher
- **Node.js**: 16+ and npm
- **Tesseract OCR**: For PDF text extraction (optional but recommended)
- **Google API Key**: For Gemini AI access

### Required Software
1. **Python 3.8+**: Download from [python.org](https://www.python.org/)
2. **Node.js**: Download from [nodejs.org](https://nodejs.org/)
3. **Tesseract OCR**: 
   - **Windows**: Download from [GitHub UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
   - **macOS**: `brew install tesseract`
   - **Linux**: `sudo apt-get install tesseract-ocr`

### API Requirements
- **Google Cloud Project**: Create one at [Google Cloud Console](https://console.cloud.google.com/)
- **Gemini API Key**: Enable Generative AI API and create an API key

---

## Installation

### 1. Clone/Download Project
```bash
cd "e:\code\PDF Questions Generation"
```

### 2. Set Up Python Backend

#### Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

#### Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

Replace `your_gemini_api_key_here` with your actual Google Gemini API key.

**Security Note**: Never commit `.env` to version control. It's already in `.gitignore`.

### 4. Set Up Frontend

Navigate to the client directory:
```bash
cd client
npm install
```

### 5. Configure Tesseract (Optional but Recommended)

#### Windows
Set environment variable:
```bash
set TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

Or add to `.env`:
```env
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

#### macOS/Linux
Usually auto-detected, but if needed:
```bash
export TESSERACT_CMD=/usr/local/bin/tesseract
```

---

## Configuration

### Main Configuration (Questions_Generator.py)

Edit these variables to customize behavior:

```python
# API Configuration
API_KEY = os.getenv("GOOGLE_API_KEY")  # Loaded from .env

# Input PDF file
JSON_FILE = os.path.join("output", "OCR_PDF", "Unit-9.json")

# Page range to process
START_PAGE = 4
END_PAGE = 5

# Questions per page
QUESTION_COUNT = 10

# Difficulty level: "Easy", "Medium", "Hard"
DIFFICULTY = "Medium"

# Output file path
OUTPUT_FILE = os.path.join("output", "Questions", "Unit-9.json")
```

### Model Configuration

Change the Gemini model:
```python
model = genai.GenerativeModel("gemini-3.1-flash-lite")
# Other options: "gemini-3.1-flash", "gemini-3.0-pro", "gemini-2.0-flash"
```

### Flask Server Configuration (server.py)

```python
# Change host/port
app.run(host='0.0.0.0', port=8000, debug=True)
```

---

## Usage

### Workflow

#### Step 1: Extract Text from PDF (OCR)

```bash
python main.py path/to/document.pdf [start_page] [end_page]
```

**Example**:
```bash
python main.py lectures/Unit-9.pdf 1 50
```

This creates: `data/OCR_PDF/Unit-9.json`

**Output Format**:
```json
[
  {
    "page": 1,
    "text": "Extracted text from page 1..."
  },
  {
    "page": 2,
    "text": "Extracted text from page 2..."
  }
]
```

#### Step 2: Generate Questions

**Option A: Using Main Script**
```bash
python main.py lectures/Unit-9.pdf 1 20 10 Medium
```

Parameters:
- `pdf_path`: Path to PDF file
- `start_page`: Starting page number (default: 1)
- `end_page`: Ending page number (default: 99999)
- `question_count`: Questions per page (default: 10)
- `difficulty`: "Easy", "Medium", or "Hard" (default: "Medium")

**Option B: Direct Generation**
```bash
python Questions_Generator.py
```

Uses configuration from the file constants.

**Output Format**:
```json
[
  {
    "question": "What is the capital of France?",
    "options": ["Paris", "London", "Berlin", "Madrid"],
    "answer": "Paris",
    "explanation": "Paris is the capital and largest city of France.",
    "page": 5,
    "difficulty": "Easy"
  }
]
```

#### Step 3: Start the Backend Server

```bash
python server.py
```

Server runs at: `http://localhost:8000`

#### Step 4: Start the Frontend

In a new terminal:
```bash
cd client
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## API Endpoints

### 1. List Available Question Files
```
GET /api/files
```

**Response**:
```json
["Unit-9.json", "Chapter-3.json", "Lecture-5.json"]
```

---

### 2. Get Questions from File
```
GET /api/questions/<filename>
```

**Example**:
```
GET /api/questions/Unit-9.json
```

**Response**:
```json
[
  {
    "question": "What is photosynthesis?",
    "options": ["A", "B", "C", "D"],
    "answer": "A",
    "explanation": "...",
    "page": 3,
    "difficulty": "Medium"
  }
]
```

---

### 3. Health Check
```
GET /
```

**Response**:
```json
{
  "status": "ok",
  "questions_dir": "C:\\path\\to\\output\\Questions"
}
```

---

## Architecture

### System Flow

```
PDF File
    ↓
[PDF Extractor (PyMuPDF + Tesseract)]
    ↓
OCR JSON (text per page)
    ↓
[Question Generator (Gemini API)]
    ↓
Questions JSON (MCQs with explanations)
    ↓
[Flask Backend Server]
    ↓
React Frontend (Quiz UI)
```

### Component Details

#### 1. PDF Extractor (`pdfExtracter.py`)
- Uses PyMuPDF for efficient PDF rendering
- Falls back to Tesseract OCR when embedded text unavailable
- Configurable DPI for OCR quality (default: 300)
- Returns JSON with page numbers and extracted text

#### 2. Question Generator (`Questions_Generator.py`)
- Sends page text to Google Gemini API
- Generates MCQ questions with 4 options each
- Includes difficulty level and explanation
- Handles rate limiting with exponential backoff
- Incremental saving (resumes if interrupted)
- Skips already-generated pages

#### 3. Flask Backend (`server.py`)
- RESTful API for file and question retrieval
- CORS enabled for cross-origin requests
- Security checks (prevents directory traversal)
- Static file serving for JSON documents

#### 4. React Frontend (`client/src/App.jsx`)
- State management with React Hooks
- Features:
  - File selection
  - Page range filtering
  - **Question distribution mode** (new)
  - Real-time scoring
  - Keyboard navigation
  - Quiz shuffling
  - Progress tracking

---

## Question Distribution Feature

### How It Works

Enable "Distribute questions evenly" and specify total questions to evenly distribute across selected pages:

**Example**:
- Pages: 1-4 (4 pages)
- Total Questions: 8
- **Result**: 2 questions per page from each page

**With Remainder Handling**:
- Pages: 1-3 (3 pages)
- Total Questions: 10
- **Result**: Page 1: 4, Page 2: 3, Page 3: 3 questions

### Algorithm

1. Calculate `questions_per_page = total_questions ÷ num_pages`
2. Calculate `remainder = total_questions % num_pages`
3. Distribute remainder across first N pages
4. Randomly select required questions from each page
5. Validates sufficient questions per page

---

## Troubleshooting

### Common Issues

#### 1. "ModuleNotFoundError: No module named 'google'"
**Solution**:
```bash
pip install google-generativeai
```

#### 2. "pytesseract.TesseractNotFoundError"
**Solution**:
- Install Tesseract OCR (see Prerequisites)
- Set `TESSERACT_CMD` environment variable
- Or disable OCR by providing text-based PDFs

#### 3. "Failed to parse JSON" in Question Generator
**Cause**: API returning malformed JSON
**Solution**:
- Check API quota limits
- Verify `GOOGLE_API_KEY` is valid
- Try smaller page ranges or fewer questions

#### 4. "Rate limit reached"
**Cause**: Too many API requests
**Solution**:
- Script automatically waits 60 seconds
- Reduce `QUESTION_COUNT` per request
- Generate in smaller batches

#### 5. "CORS error" from frontend
**Solution**: Ensure Flask server is running:
```bash
python server.py
```

#### 6. Frontend shows "No questions available"
**Cause**: Selected page range has no questions
**Solution**:
- Regenerate questions with correct page range
- Verify output files exist in `data/Questions/`
- Check Questions JSON format

#### 7. File upload errors
**Cause**: Missing output directory
**Solution**:
```bash
mkdir -p data/OCR_PDF
mkdir -p data/Questions
```

---

## Advanced Usage

### Batch Processing Multiple PDFs

```bash
for pdf in lectures/*.pdf; do
  python main.py "$pdf" 1 50 10 Medium
done
```

### Custom Question Prompts

Edit the prompt in `generate_for_page()` function:
```python
page_prompt = f"""
You are an expert Computer Science exam question generator.

[Customize your instructions here]

Generate {count} MCQ questions...
"""
```

### API Rate Limiting

Adjust retry logic in `generate_for_page()`:
```python
max_retries = 5  # Increase for more attempts
time.sleep(30)   # Wait 30 seconds between retries
```

---

## Performance Optimization

### For Large PDFs
- Increase DPI (default 300) for better OCR: `dpi=150` for faster processing
- Reduce `QUESTION_COUNT` per page
- Generate questions in smaller page batches

### Memory Management
- Process documents in chunks (e.g., 10 pages at a time)
- Clear browser cache between sessions

---

## Development

### Tech Stack
- **Backend**: Python 3.8+, Flask, Google Gemini API
- **Frontend**: React 18, Vite, Lucide Icons
- **OCR**: PyMuPDF, Tesseract
- **Build Tool**: Vite
- **API**: RESTful

### Project Dependencies

**Python**:
- `google-generativeai`: Gemini API integration
- `PyMuPDF`: PDF rendering
- `pytesseract`: Tesseract OCR wrapper
- `Flask`: Web framework
- `flask-cors`: CORS support
- `pillow`: Image processing
- `python-dotenv`: Environment variable management
- `tqdm`: Progress bars

**JavaScript**:
- `react`: UI framework
- `vite`: Build tool
- `lucide-react`: Icons

---

## Security Best Practices

1. **API Keys**: Store in `.env`, never commit to Git
2. **CORS**: Limit to trusted domains in production
3. **File Paths**: Backend validates and prevents directory traversal
4. **Input Validation**: Page numbers and question counts are validated
5. **Error Messages**: Avoid exposing sensitive paths in production

---

## Deployment

### Production Checklist

- [ ] Set `debug=False` in Flask server
- [ ] Use production WSGI server (Gunicorn, uWSGI)
- [ ] Configure proper CORS for frontend domain
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS
- [ ] Set up proper logging
- [ ] Implement rate limiting on API
- [ ] Add authentication if needed

### Example Production Server (Gunicorn)

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 server:app
```

---

## License

This project is open source and available under the MIT License.

---

## Support & Troubleshooting

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review error messages in terminal output
3. Verify all prerequisites are installed
4. Check `.env` file configuration
5. Ensure API key is valid and has sufficient quota

---

## Future Enhancements

- [ ] User authentication and session management
- [ ] Question bank management (edit/delete questions)
- [ ] Test history and performance analytics
- [ ] Multiple question types (True/False, Fill-in-the-blank)
- [ ] Export results as PDF/CSV
- [ ] Spaced repetition for learning
- [ ] Question difficulty auto-adjustment
- [ ] Multi-language support

---

**Last Updated**: May 2026
**Version**: 1.0.0
