import { useEffect, useMemo, useState } from "react";

import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Shuffle,
  FileText,
  Trophy,
  BookOpen,
} from "lucide-react";

import "./App.css";

function App() {

  const [files, setFiles] = useState([]);

  const [selectedFile, setSelectedFile] = useState("");

  const [allQuestions, setAllQuestions] = useState([]);

  const [questions, setQuestions] = useState([]);

  const [loading, setLoading] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [pageStart, setPageStart] = useState(1);

  const [pageEnd, setPageEnd] = useState(1);

  const [totalQuestionsWanted, setTotalQuestionsWanted] = useState(10);

  const [distributeQuestions, setDistributeQuestions] = useState(false);

  const [quizStarted, setQuizStarted] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const [showAnswer, setShowAnswer] = useState(false);

  const [score, setScore] = useState(0);

  // =================================================
  // LOAD FILE LIST
  // =================================================

  useEffect(() => {

    // Fetch available question JSON files from the Flask API
    const fetchFiles = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch('/api/files');
        if (!res.ok) throw new Error(`Failed to list files (${res.status})`);
        const fileList = await res.json();
        const availableFiles = Array.isArray(fileList) ? fileList : [];
        setFiles(availableFiles);
        setSelectedFile(availableFiles.length ? availableFiles[0] : "");
      } catch (err) {
        setFiles([]);
        setSelectedFile("");
        setLoadError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();

  }, []);

  // =================================================
  // LOAD QUESTIONS
  // =================================================

  useEffect(() => {

    if (!selectedFile) return;

    loadQuestions(selectedFile);

  }, [selectedFile]);

  useEffect(() => {

    const handleKeyDown = (event) => {

      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (isTypingField || !quizStarted || !questions.length) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextQuestion();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevQuestion();
      }

    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);

  }, [quizStarted, questions.length, currentIndex]);

  const loadQuestions = async (file) => {

    setLoading(true);

    setLoadError("");

    try {

      const response = await fetch(`/api/questions/${encodeURIComponent(file)}`);

      if (!response.ok) {

        throw new Error(
          `Failed to load ${file} (${response.status})`
        );

      }

      const data = await response.json();

      setAllQuestions(Array.isArray(data) ? data : []);
      setQuestions([]);

      const pages = (Array.isArray(data) ? data : [])
        .map((item) => item?.page)
        .filter((page) => Number.isInteger(page));

      const minPage = pages.length ? Math.min(...pages) : 1;
      const maxPage = pages.length ? Math.max(...pages) : 1;

      setPageStart(minPage);
      setPageEnd(maxPage);
      setQuizStarted(false);

      resetExam();

    } catch (error) {

      setQuestions([]);

      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load questions"
      );

    } finally {

      setLoading(false);

    }
  };

  const startQuiz = () => {

    let filteredQuestions = allQuestions.filter((question) => {

      const page = question?.page;

      return page >= pageStart && page <= pageEnd;

    });

    // If distribute mode is enabled, evenly distribute questions across pages
    if (distributeQuestions && totalQuestionsWanted > 0) {
      const numPages = pageEnd - pageStart + 1;
      const questionsPerPage = Math.floor(totalQuestionsWanted / numPages);
      const remainder = totalQuestionsWanted % numPages;

      // Group questions by page
      const questionsByPage = {};
      for (let i = pageStart; i <= pageEnd; i++) {
        questionsByPage[i] = allQuestions.filter(q => q?.page === i);
      }

      // Distribute questions
      const distributedQuestions = [];
      let extraQuestionsAdded = 0;

      for (let i = pageStart; i <= pageEnd; i++) {
        const pageQuestions = questionsByPage[i];
        const qPerPage = questionsPerPage + (extraQuestionsAdded < remainder ? 1 : 0);

        if (pageQuestions.length < qPerPage) {
          setLoadError(
            `Page ${i} has only ${pageQuestions.length} questions, but ${qPerPage} are needed.`
          );
          return;
        }

        // Randomly select questions from this page
        const shuffled = [...pageQuestions].sort(() => Math.random() - 0.5);
        distributedQuestions.push(...shuffled.slice(0, qPerPage));

        if (extraQuestionsAdded < remainder) {
          extraQuestionsAdded++;
        }
      }

      filteredQuestions = distributedQuestions;
    }

    if (!filteredQuestions.length) {

      setLoadError("No questions found for the selected page range.");

      return;
    }

    setLoadError("");
    setQuestions(filteredQuestions);
    resetExam();
    setQuizStarted(true);
  };

  // =================================================
  // RESET
  // =================================================

  const resetExam = () => {

    setCurrentIndex(0);

    setSelectedAnswer(null);

    setShowAnswer(false);

    setScore(0);
  };

  // =================================================
  // CURRENT QUESTION
  // =================================================

  const currentQuestion = useMemo(() => {

    return questions[currentIndex];

  }, [questions, currentIndex]);

  // =================================================
  // ANSWER CLICK
  // =================================================

  const handleAnswerClick = (option) => {

    if (showAnswer) return;

    setSelectedAnswer(option);

    setShowAnswer(true);

    if (option === currentQuestion.answer) {

      setScore(prev => prev + 1);
    }
  };

  // =================================================
  // NEXT
  // =================================================

  const nextQuestion = () => {

    if (currentIndex < questions.length - 1) {

      setCurrentIndex(prev => prev + 1);

      setSelectedAnswer(null);

      setShowAnswer(false);
    }
  };

  // =================================================
  // PREVIOUS
  // =================================================

  const prevQuestion = () => {

    if (currentIndex > 0) {

      setCurrentIndex(prev => prev - 1);

      setSelectedAnswer(null);

      setShowAnswer(false);
    }
  };

  // =================================================
  // SHUFFLE
  // =================================================

  const shuffleQuestions = () => {

    if (!questions.length) return;

    const shuffled = [...questions].sort(() => Math.random() - 0.5);

    setQuestions(shuffled);

    setCurrentIndex(0);

    setSelectedAnswer(null);

    setShowAnswer(false);

    setScore(0);
  };

  // =================================================
  // PROGRESS
  // =================================================

  const progress =
    questions.length > 0
      ? ((currentIndex + 1) / questions.length) * 100
      : 0;

  // =================================================
  // LOADING
  // =================================================

  if (loading) {

    return (
      <div className="loading-state">
        <div className="loading-card">
          <div className="spinner" />
          <h2>Loading questions</h2>
          <p>Reading the selected JSON file and preparing the quiz setup.</p>
        </div>
      </div>
    );
  }

  if (loadError) {

    return (
      <div className="loading-state">
        <div className="loading-card error-card">
          <h2>Unable to continue</h2>
          <p>{loadError}</p>
          <button
            className="primary-button"
            onClick={() => loadQuestions(selectedFile)}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!quizStarted) {

    return (
      <div className="app-shell landing-shell">

        <div className="landing-layout">

        <section className="hero-panel">

          <div className="hero-copy">

            <span className="eyebrow">Question setup</span>

            <h1>Choose a file, filter by page range, then start the quiz.</h1>

            <p>
              Load one JSON file at a time, set the page range you want to practice,
              and launch a focused MCQ session.
            </p>

          </div>

          <div className="hero-stats">

            <div>
              <strong>{allQuestions.length}</strong>
              <span>Questions loaded</span>
            </div>

            <div>
              <strong>{pageStart} - {pageEnd}</strong>
              <span>Current range</span>
            </div>

            <div>
              <strong>{files.length}</strong>
              <span>JSON files</span>
            </div>

          </div>

        </section>

        <section className="setup-panel">

          <div className="panel-header">
            <h2>Quiz setup</h2>
            <p>Select the source file and page range.</p>
          </div>

          <div className="setup-grid">

            <label className="field">
              <span>JSON file</span>
              <div className="field-control dropdown">
                <FileText size={18} />
                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                >
                  {files.map((file) => (
                    <option key={file} value={file}>
                      {file}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="field">
              <span>Start page</span>
              <input
                className="field-control number-input"
                type="number"
                min={1}
                max={pageEnd}
                value={pageStart}
                onChange={(e) =>
                  setPageStart(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </label>

            <label className="field">
              <span>End page</span>
              <input
                className="field-control number-input"
                type="number"
                min={pageStart}
                value={pageEnd}
                onChange={(e) =>
                  setPageEnd(Math.max(pageStart, Number(e.target.value) || pageStart))
                }
              />
            </label>

            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={distributeQuestions}
                onChange={(e) => setDistributeQuestions(e.target.checked)}
              />
              <span>Distribute questions evenly</span>
            </label>

            {distributeQuestions && (
              <label className="field">
                <span>Total questions needed</span>
                <input
                  className="field-control number-input"
                  type="number"
                  min={1}
                  value={totalQuestionsWanted}
                  onChange={(e) =>
                    setTotalQuestionsWanted(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </label>
            )}

          </div>

          <div className="setup-footer">

            <p>
              Pages available in file: <strong>1 to {Math.max(pageEnd, pageStart)}</strong>
            </p>

            <button
              className="primary-button"
              onClick={startQuiz}
              disabled={!allQuestions.length || pageStart > pageEnd}
            >
              Start Quiz
            </button>

          </div>

        </section>

        </div>

      </div>
    );
  }

  if (!currentQuestion) {

    return (
      <div className="loading-state">
        <div className="loading-card">
          <h2>No questions available</h2>
          <p>The selected page range did not return any questions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell quiz-shell">

      <header className="header">

        <div className="logo">

          <BookOpen size={34} />

          <div>
            {/* <span className="eyebrow">Active quiz</span> */}
            <h1>MCQ Exam System</h1>
            <p>{selectedFile}</p>
          </div>

        </div>

        <div className="controls">

          <div className="dropdown compact-select">

            <FileText size={18} />

            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
            >
              {files.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>

          </div>

          <button
            className="ghost-button"
            onClick={() => setQuizStarted(false)}
          >
            Change Range
          </button>

          <button
            className="shuffle-btn"
            onClick={shuffleQuestions}
          >
            <Shuffle size={18} />
            Shuffle
          </button>

        </div>

      </header>

      <div className="question-card">

        <div className="card-header-row">

        <div className="meta">

          <span className="badge difficulty">
            {currentQuestion.difficulty}
          </span>

          <span className="badge page">
            Page {currentQuestion.page}
          </span>

        </div>

        <div className="card-nav" aria-label="Question navigation">

          <button
            className="nav-icon-button"
            onClick={prevQuestion}
            disabled={currentIndex === 0}
            aria-label="Previous question"
            title="Previous question"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            className="nav-icon-button primary-nav"
            onClick={nextQuestion}
            disabled={currentIndex === questions.length - 1}
            aria-label="Next question"
            title="Next question"
          >
            <ChevronRight size={20} />
          </button>

        </div>

        </div>

        <h2 className="question">
          {currentQuestion.question}
        </h2>

        <div className={`question-content ${showAnswer ? "show-answer" : ""}`}>

          <div className="options">

            {currentQuestion.options.map((option, index) => {

              const isCorrect = option === currentQuestion.answer;

              const isSelected = option === selectedAnswer;

              return (
                <button
                  key={index}
                  className={`option ${showAnswer && isCorrect ? "correct" : ""} ${showAnswer && isSelected && !isCorrect ? "wrong" : ""}`}
                  onClick={() => handleAnswerClick(option)}
                >

                  <span>{option}</span>

                  {showAnswer && isCorrect && (
                    <CheckCircle2 size={20} />
                  )}

                  {showAnswer && isSelected && !isCorrect && (
                    <XCircle size={20} />
                  )}

                </button>
              );
            })}

          </div>

          {showAnswer && (

            <div className="explanation">

              <h3>
                <Trophy size={18} />
                Explanation
              </h3>

              <p>{currentQuestion.explanation}</p>

            </div>

          )}

        </div>

      </div>
            <div className="progress-wrapper">

        <div className="progress-info">

          <span>
            Question {currentIndex + 1} / {questions.length}
          </span>

          <span>
            Score: {score}
          </span>

        </div>

        <div className="progress-bar">

          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />

        </div>

      </div>

    </div>
  );
}

export default App;