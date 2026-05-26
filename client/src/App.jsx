import { act, useEffect, useMemo, useState } from "react";

import { BookOpen, Clock3, FileText, PanelLeftClose, PanelLeftOpen, Trash2, Network } from "lucide-react";

import HistorySecondaryContent from "./components/HistorySecondaryContent";
import QuizSecondaryContent from "./components/QuizSecondaryContent";
import SummarySecondaryContent from "./components/SummarySecondaryContent";
import MappingSecondaryContent from "./components/MappingSecondaryContent";
import MappingActiveContent from "./components/MappingActiveContent";
import HistoryPage from "./pages/HistoryPage";
import QuizPage from "./pages/QuizPage";
import FlashcardPage from "./pages/FlashcardPage";
import SummarizePage from "./pages/SummarizePage";
import WorkspaceShell from "./components/WorkspaceShell";
import { useQuizStore } from "./store/useQuizStore";

import "./App.css";

function App() {
  const [activeSection, setActiveSection] = useState("quiz");
  const [secondaryCollapsed, setSecondaryCollapsed] = useState(false);
  const [selectedHistoryFile, setSelectedHistoryFile] = useState("");
  const [summaryFiles, setSummaryFiles] = useState([]);
  const [selectedSummaryFile, setSelectedSummaryFile] = useState("");
  const [summaryContent, setSummaryContent] = useState("");
  const [summaryFilesLoading, setSummaryFilesLoading] = useState(false);
  const [summaryContentLoading, setSummaryContentLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [mappingFiles, setMappingFiles] = useState([]);
  const [selectedMappingFile, setSelectedMappingFile] = useState("");
  const [mappingContent, setMappingContent] = useState(null);
  const [mappingFilesLoading, setMappingFilesLoading] = useState(false);
  const [mappingContentLoading, setMappingContentLoading] = useState(false);
  const [mappingError, setMappingError] = useState("");
  const [selectedHistoryQuestionCount, setSelectedHistoryQuestionCount] = useState(null);

  const mode = useQuizStore((state) => state.mode);
  const contentMode = useQuizStore((state) => state.contentMode);
  const files = useQuizStore((state) => state.files);
  const selectedFile = useQuizStore((state) => state.selectedFile);
  const allQuestions = useQuizStore((state) => state.allQuestions);
  const questions = useQuizStore((state) => state.questions);
  const loading = useQuizStore((state) => state.loading);
  const loadError = useQuizStore((state) => state.loadError);
  const pageStart = useQuizStore((state) => state.pageStart);
  const pageEnd = useQuizStore((state) => state.pageEnd);
  const totalQuestionsWanted = useQuizStore((state) => state.totalQuestionsWanted);
  const distributeQuestions = useQuizStore((state) => state.distributeQuestions);
  const quizStarted = useQuizStore((state) => state.quizStarted);
  const currentIndex = useQuizStore((state) => state.currentIndex);
  const answeredQuestions = useQuizStore((state) => state.answeredQuestions);
  const score = useQuizStore((state) => state.score);
  const quizHistory = useQuizStore((state) => state.quizHistory);
  const showHistoryRecords = useQuizStore((state) => state.showHistoryRecords);

  const setMode = useQuizStore((state) => state.setMode);
  const setContentMode = useQuizStore((state) => state.setContentMode);
  const setSelectedFile = useQuizStore((state) => state.setSelectedFile);
  const setPageStart = useQuizStore((state) => state.setPageStart);
  const setPageEnd = useQuizStore((state) => state.setPageEnd);
  const setTotalQuestionsWanted = useQuizStore((state) => state.setTotalQuestionsWanted);
  const setDistributeQuestions = useQuizStore((state) => state.setDistributeQuestions);
  const setQuizStarted = useQuizStore((state) => state.setQuizStarted);
  const setShowHistoryRecords = useQuizStore((state) => state.setShowHistoryRecords);
  const loadFiles = useQuizStore((state) => state.loadFiles);
  const loadQuestions = useQuizStore((state) => state.loadQuestions);
  const startQuiz = useQuizStore((state) => state.startQuiz);
  const shuffleQuestions = useQuizStore((state) => state.shuffleQuestions);
  const nextQuestion = useQuizStore((state) => state.nextQuestion);
  const prevQuestion = useQuizStore((state) => state.prevQuestion);
  const handleAnswerClick = useQuizStore((state) => state.handleAnswerClick);
  const deleteHistoryEntry = useQuizStore((state) => state.deleteHistoryEntry);
  const clearHistory = useQuizStore((state) => state.clearHistory);

  useEffect(() => {
    loadFiles();
  }, [contentMode, loadFiles]);

  useEffect(() => {
    setMode(
      activeSection === "summaries" ? "summarize" : activeSection === "mappingTree" ? "mappingTree" : "quiz"
    );
  }, [activeSection, setMode]);

  useEffect(() => {
    if (selectedFile) {
      loadQuestions(selectedFile);
    }
  }, [loadQuestions, selectedFile]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (isTypingField || !quizStarted || mode !== "quiz") {
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
  }, [mode, nextQuestion, prevQuestion, quizStarted]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === ".") {
        event.preventDefault();
        setSecondaryCollapsed((currentValue) => !currentValue);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePlainK = (event) => {
      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (isTypingField) return;

      // Only toggle on a plain 'k' press (no modifiers)
      if (
        event.key === "k" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        setSecondaryCollapsed((currentValue) => !currentValue);
      }
    };

    window.addEventListener("keydown", handlePlainK);
    return () => window.removeEventListener("keydown", handlePlainK);
  }, [setSecondaryCollapsed]);

  useEffect(() => {
    if (mode !== "summarize") {
      return;
    }

    const loadSummaryFiles = async () => {
      setSummaryFilesLoading(true);
      setSummaryError("");

      try {
        const response = await fetch("/api/summaries");
        if (!response.ok) {
          throw new Error(`Failed to list summaries (${response.status})`);
        }

        const fileList = await response.json();
        const availableFiles = Array.isArray(fileList) ? fileList : [];
        setSummaryFiles(availableFiles);
        setSelectedSummaryFile((currentFile) => {
          if (currentFile && availableFiles.includes(currentFile)) {
            return currentFile;
          }

          return availableFiles[0] || "";
        });

        if (!availableFiles.length) {
          setSummaryContent("");
        }
      } catch (error) {
        setSummaryFiles([]);
        setSelectedSummaryFile("");
        setSummaryContent("");
        setSummaryError(error instanceof Error ? error.message : String(error));
      } finally {
        setSummaryFilesLoading(false);
      }
    };

    loadSummaryFiles();
  }, [mode]);

  useEffect(() => {
    if (activeSection !== "mappingTree") return;

    const loadMappingFiles = async () => {
      setMappingFilesLoading(true);
      setMappingError("");

      try {
        const response = await fetch("/api/mappings");
        if (!response.ok) {
          throw new Error(`Failed to list mappings (${response.status})`);
        }

        const fileList = await response.json();
        const availableFiles = Array.isArray(fileList) ? fileList : [];
        setMappingFiles(availableFiles);
        setSelectedMappingFile((currentFile) => {
          if (currentFile && availableFiles.includes(currentFile)) {
            return currentFile;
          }

          return availableFiles[0] || "";
        });

        if (!availableFiles.length) {
          setMappingContent(null);
        }
      } catch (error) {
        setMappingFiles([]);
        setSelectedMappingFile("");
        setMappingContent(null);
        setMappingError(error instanceof Error ? error.message : String(error));
      } finally {
        setMappingFilesLoading(false);
      }
    };

    loadMappingFiles();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "mappingTree" || !selectedMappingFile) {
      setMappingContent(null);
      return;
    }

    const loadMappingContent = async () => {
      setMappingContentLoading(true);
      setMappingError("");

      try {
        const response = await fetch(`/api/mappings/${encodeURIComponent(selectedMappingFile)}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${selectedMappingFile} (${response.status})`);
        }

        const data = await response.json();
        setMappingContent(data);
      } catch (error) {
        setMappingContent(null);
        setMappingError(error instanceof Error ? error.message : String(error));
      } finally {
        setMappingContentLoading(false);
      }
    };

    loadMappingContent();
  }, [activeSection, selectedMappingFile]);

  useEffect(() => {
    if (mode !== "summarize" || !selectedSummaryFile) {
      setSummaryContent("");
      return;
    }

    const loadSummaryContent = async () => {
      setSummaryContentLoading(true);
      setSummaryError("");

      try {
        const response = await fetch(`/api/summaries/${encodeURIComponent(selectedSummaryFile)}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${selectedSummaryFile} (${response.status})`);
        }

        const content = await response.text();
        setSummaryContent(content);
      } catch (error) {
        setSummaryContent("");
        setSummaryError(error instanceof Error ? error.message : String(error));
      } finally {
        setSummaryContentLoading(false);
      }
    };

    loadSummaryContent();
  }, [mode, selectedSummaryFile]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const historyChartData = useMemo(() => {
    const sourceHistory = selectedHistoryFile ? quizHistory.filter((h) => h?.file === selectedHistoryFile) : quizHistory;

    if (!sourceHistory.length) {
      return {
        bars: [],
        width: 1000,
        height: 320,
        padding: { top: 24, right: 28, bottom: 58, left: 52 },
        yMax: 100,
      };
    }
    const sortedHistory = [...sourceHistory].sort((a, b) => (a.id || 0) - (b.id || 0));
    const uniqueFiles = selectedHistoryFile
      ? [selectedHistoryFile]
      : [...new Set(sortedHistory.map((entry) => entry?.file).filter(Boolean))];

    const groupedHistory = sortedHistory.reduce((groups, entry, index) => {
      const pageStartValue = Number(entry?.pageStart) || index + 1;
      const pageEndValue = Number(entry?.pageEnd) || pageStartValue;
      const groupKey = `${pageStartValue}-${pageEndValue}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          pageStartValue,
          pageEndValue,
          totalPercentage: 0,
          count: 0,
        });
      }

      const group = groups.get(groupKey);
      const percentageValue = Number(entry?.percentage);
      const fallbackPercentage = Math.round(((Number(entry?.score) || 0) / Math.max(Number(entry?.totalQuestions) || 1, 1)) * 100);
      group.totalPercentage += Number.isFinite(percentageValue) ? percentageValue : fallbackPercentage;
      group.count += 1;

      return groups;
    }, new Map());

    const width = 1000;
    const height = 320;
    const padding = { top: 24, right: 28, bottom: 58, left: 52 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const yMax = 100;
    const bars = Array.from(groupedHistory.entries()).map(([groupKey, group], index, entries) => {
      const barWidth = Math.max(36, Math.min(88, plotWidth / Math.max(entries.length * 1.25, 1)));
      const slotWidth = plotWidth / Math.max(entries.length, 1);
      const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
      const value = Math.max(0, Math.min(100, group.totalPercentage / Math.max(group.count, 1)));
      const barHeight = (value / yMax) * plotHeight;

      return {
        key: groupKey,
        label: `${group.pageStartValue}-${group.pageEndValue}`,
        avgPercentage: Math.round(value),
        count: group.count,
        x,
        y: padding.top + plotHeight - barHeight,
        width: barWidth,
        height: barHeight,
        centerX: x + barWidth / 2,
      };
    });

    return {
      bars,
      width,
      height,
      yMax,
      padding,
      fileSummary:
        selectedHistoryFile
          ? selectedHistoryFile
          : uniqueFiles.length > 3
          ? `${uniqueFiles.slice(0, 3).join(", ")} +${uniqueFiles.length - 3} more`
          : uniqueFiles.join(", ") || "Unknown file",
    };
  }, [quizHistory, selectedHistoryFile]);

  const summaryStats = useMemo(() => {
    const sourceHistory = selectedHistoryFile ? quizHistory.filter((h) => h?.file === selectedHistoryFile) : quizHistory;
    const totalHistoryAttempts = sourceHistory.length;
    const averageScore = totalHistoryAttempts
      ? Math.round(
        sourceHistory.reduce((sum, entry) => sum + (Number(entry?.percentage) || 0), 0) / totalHistoryAttempts,
      )
      : 0;

    return {
      averageScore,
      totalHistoryAttempts,
      recentAttempts: [...sourceHistory].slice(0, 5),
      questionCount: selectedHistoryQuestionCount !== null ? selectedHistoryQuestionCount : allQuestions.length,
      availableFiles: selectedHistoryFile ? 1 : files.length,
      currentRange: `${pageStart} - ${pageEnd}`,
      currentMode: contentMode === "flashcard" ? "Flashcards" : "MCQ",
    };
  }, [allQuestions.length, contentMode, files.length, pageEnd, pageStart, quizHistory, selectedHistoryFile]);

  const handleSelectPrimary = (section) => {
    setActiveSection(section);
    if (section !== "summaries") {
      setMode("quiz");
    }
  };

  const secondaryHeader = {
    label: `${activeSection} context`,
    eyebrow:
      activeSection === "summaries"
        ? "Summary library"
        : activeSection === "history"
          ? "History"
          : activeSection === "mappingTree"
            ? "Mapping Tree"
            : "Question setup",
    title:
      activeSection === "summaries"
        ? "Markdown files"
        : activeSection === "history"
          ? "JSON files"
          : activeSection === "mappingTree"
            ? "Topics"
            : quizStarted
              ? contentMode === "flashcard"
                ? "Current flashcard session"
                : "Current quiz session"
              : contentMode === "flashcard"
                ? "Flashcard configuration"
                : "Quiz configuration",
    description:
      activeSection === "summaries"
        ? ""
        : activeSection === "history"
          ? ""
          : quizStarted
            ? "Refine the current quiz session without leaving the workspace."
            : "",
    collapseIcon: <PanelLeftClose size={18} />,
    expandIcon: <PanelLeftOpen size={18} />,
  };

  const quizSecondaryContent = (
    <QuizSecondaryContent
      quizStarted={quizStarted}
        contentMode={contentMode}
        setContentMode={setContentMode}
      selectedFile={selectedFile}
      files={files}
      setSelectedFile={setSelectedFile}
      setQuizStarted={setQuizStarted}
      shuffleQuestions={shuffleQuestions}
      currentIndex={currentIndex}
      questions={questions}
      score={score}
      progress={progress}
      quizHistory={quizHistory}
      historyChartData={historyChartData}
      showHistoryRecords={showHistoryRecords}
      setShowHistoryRecords={setShowHistoryRecords}
      deleteHistoryEntry={deleteHistoryEntry}
      clearHistory={clearHistory}
      pageStart={pageStart}
      pageEnd={pageEnd}
      setPageStart={setPageStart}
      setPageEnd={setPageEnd}
      distributeQuestions={distributeQuestions}
      setDistributeQuestions={setDistributeQuestions}
      totalQuestionsWanted={totalQuestionsWanted}
      setTotalQuestionsWanted={setTotalQuestionsWanted}
      allQuestions={allQuestions}
      startQuiz={startQuiz}
    />
  );

  const summarySecondaryContent = (
    <SummarySecondaryContent
      summaryFilesLoading={summaryFilesLoading}
      summaryFiles={summaryFiles}
      selectedSummaryFile={selectedSummaryFile}
      setSelectedSummaryFile={setSelectedSummaryFile}
    />
  );

  const mappingSecondaryContent = (
    <MappingSecondaryContent
      mappingFilesLoading={mappingFilesLoading}
      mappingFiles={mappingFiles}
      selectedMappingFile={selectedMappingFile}
      setSelectedMappingFile={setSelectedMappingFile}
    />
  );

  const historySecondaryContent = (
    <HistorySecondaryContent
      allQuestions={allQuestions}
      files={files}
      historyChartData={historyChartData}
      quizHistory={quizHistory}
      showHistoryRecords={showHistoryRecords}
      deleteHistoryEntry={deleteHistoryEntry}
      clearHistory={clearHistory}
      selectedHistoryFile={selectedHistoryFile}
      setSelectedHistoryFile={setSelectedHistoryFile}
    />
  );

  const historyForSelected = selectedHistoryFile
    ? quizHistory.filter((h) => h?.file === selectedHistoryFile)
    : quizHistory;

  useEffect(() => {
    let cancelled = false;
    const loadCount = async () => {
      if (!selectedHistoryFile) {
        setSelectedHistoryQuestionCount(null);
        return;
      }

      try {
        const resp = await fetch(`/api/questions/${encodeURIComponent(selectedHistoryFile)}`);
        if (!resp.ok) throw new Error(`Failed to load ${selectedHistoryFile} (${resp.status})`);
        const data = await resp.json();
        if (cancelled) return;
        setSelectedHistoryQuestionCount(Array.isArray(data) ? data.length : 0);
      } catch (err) {
        if (cancelled) return;
        setSelectedHistoryQuestionCount(0);
      }
    };

    loadCount();
    return () => {
      cancelled = true;
    };
  }, [selectedHistoryFile]);

  const mainWorkspace = (() => {
    if (loading && activeSection === "quiz") {
      return (
        <div className="loading-card">
          <div className="spinner" />
          <h2>Loading questions</h2>
          <p>Reading the selected JSON file and preparing the quiz setup.</p>
        </div>
      );
    }

    if (loadError && activeSection === "quiz") {
      return (
        <div className="loading-card error-card">
          <h2>Unable to continue</h2>
          <p>{loadError}</p>
          <button className="primary-button" onClick={() => loadQuestions(selectedFile)}>
            Try again
          </button>
        </div>
      );
    }

    if (activeSection === "summaries") {
      return (
        <SummarizePage
          summaryFiles={summaryFiles}
          selectedSummaryFile={selectedSummaryFile}
          summaryContent={summaryContent}
          summaryFilesLoading={summaryFilesLoading}
          summaryContentLoading={summaryContentLoading}
          summaryError={summaryError}
          onSelectSummaryFile={setSelectedSummaryFile}
          quizHistory={quizHistory}
          embedded
        />
      );
    }

    if (activeSection === "mappingTree") {
      if (mappingContentLoading) {
        return <MappingActiveContent mappingContentLoading={mappingContentLoading} />;
      }

      if (mappingError) {
        return (
          <MappingActiveContent
            mappingError={mappingError}
            onRetry={() => setSelectedMappingFile(selectedMappingFile)}
          />
        );
      }
      return (
        <MappingActiveContent
          mappingContent={mappingContent}
          mappingContentLoading={mappingContentLoading}
          mappingError={mappingError}
          selectedMappingFile={selectedMappingFile}
          onRetry={() => setSelectedMappingFile(selectedMappingFile)}
        />
      );
    }

    if (activeSection === "history") {
      return (
        <HistoryPage
          summaryStats={summaryStats}
          historyForSelected={historyForSelected}
          showHistoryRecords={showHistoryRecords}
          selectedHistoryFile={selectedHistoryFile}
          historyChartData={historyChartData}
          deleteHistoryEntry={deleteHistoryEntry}
          clearHistory={clearHistory}
        />
      );
    }

    if (quizStarted && contentMode === "flashcard") {
      return <FlashcardPage apiUrl={`/api/flashcards/${encodeURIComponent(selectedFile)}`} embedded />;
    }

    if (!quizStarted || !currentQuestion) {
      return (
        <div className="workspace-main landing-main">
          <section className="hero-panel landing-hero-panel">
            <div className="hero-copy">
              <span className="eyebrow">Question setup</span>
              <h1>Choose a file, tune the range, and launch into the quiz workspace.</h1>
              <p>
                The layout now keeps navigation in a primary rail and contextual controls in a secondary panel while the
                main stage stays focused on the active task.
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

          <section className="setup-panel launch-panel">
            <div className="panel-header">
              <h2>Workspace preview</h2>
              <p>The main area stays focused on the active task, while the sidebar handles setup.</p>
            </div>

            <div className="setup-grid">
              <div className="summary-stat-list">
                <div>
                  <strong>Range</strong>
                  <span>{pageStart} to {pageEnd}</span>
                </div>
                <div>
                  <strong>Mode</strong>
                  <span>{summaryStats.currentMode}</span>
                </div>
              </div>

              <div className="summary-empty-state">
                When you click Start Quiz, the question workspace takes over the main stage.
              </div>
            </div>
          </section>
        </div>
      );
    }

    return (
      <QuizPage
        selectedFile={selectedFile}
        files={files}
        onFileChange={setSelectedFile}
        onChangeRange={() => setQuizStarted(false)}
        onShuffle={shuffleQuestions}
        currentQuestion={currentQuestion}
        currentIndex={currentIndex}
        questions={questions}
        answeredQuestions={answeredQuestions}
        score={score}
        progress={progress}
        showAnswer={currentIndex in answeredQuestions}
        onPrevQuestion={prevQuestion}
        onNextQuestion={nextQuestion}
        onAnswerClick={handleAnswerClick}
        onDeleteHistoryEntry={deleteHistoryEntry}
        quizHistory={quizHistory}
        historyChartData={historyChartData}
        showHistoryRecords={showHistoryRecords}
        onToggleHistoryRecords={() => setShowHistoryRecords((prev) => !prev)}
        onClearHistory={clearHistory}
        embedded
      />
    );
  })();

  const primaryItems = [
    { key: "quiz", label: "Quiz page", active: activeSection === "quiz", icon: <BookOpen size={20} />, onClick: () => handleSelectPrimary("quiz") },
    { key: "history", label: "History page", active: activeSection === "history", icon: <Clock3 size={20} />, onClick: () => handleSelectPrimary("history") },
    { key: "summaries", label: "Summaries", active: activeSection === "summaries", icon: <FileText size={20} />, onClick: () => handleSelectPrimary("summaries") },
    { key: "mappingTree", label: "Mapping Tree", active: activeSection === "mappingTree", icon: <Network size={20} />, onClick: () => handleSelectPrimary("mappingTree") },
  ];

  const secondaryContent =
    activeSection === "summaries"
      ? summarySecondaryContent
      : activeSection === "history"
      ? historySecondaryContent
      : activeSection === "mappingTree"
      ? mappingSecondaryContent
      : quizSecondaryContent;

  return (
    <WorkspaceShell
      primaryItems={primaryItems}
      secondaryHeader={secondaryHeader}
      secondaryContent={secondaryContent}
      secondaryCollapsed={secondaryCollapsed}
      onToggleSecondary={() => setSecondaryCollapsed((currentValue) => !currentValue)}
    >
      {mainWorkspace}
    </WorkspaceShell>
  );

}

export default App;
