import { create } from "zustand";

const shuffleArray = (items) => [...items].sort(() => Math.random() - 0.5);

const readSavedHistory = () => {
  if (typeof window === "undefined") {
    return [];
  }

  const savedHistory = localStorage.getItem("quizHistory");
  if (!savedHistory) {
    return [];
  }

  try {
    const parsedHistory = JSON.parse(savedHistory);
    return Array.isArray(parsedHistory) ? parsedHistory : [];
  } catch (error) {
    console.error("Failed to load quiz history:", error);
    return [];
  }
};

const persistHistory = (history) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("quizHistory", JSON.stringify(history));
};

export const useQuizStore = create((set, get) => ({
  mode: "quiz",
  files: [],
  selectedFile: "",
  allQuestions: [],
  questions: [],
  loading: false,
  loadError: "",
  pageStart: 1,
  pageEnd: 1,
  totalQuestionsWanted: 10,
  distributeQuestions: false,
  quizStarted: false,
  currentIndex: 0,
  answeredQuestions: {},
  score: 0,
  quizHistory: readSavedHistory(),
  showHistoryRecords: true,

  setMode: (mode) => set({ mode }),
  setSelectedFile: (selectedFile) => set({ selectedFile }),
  setPageStart: (pageStart) => set({ pageStart }),
  setPageEnd: (pageEnd) => set({ pageEnd }),
  setTotalQuestionsWanted: (totalQuestionsWanted) => set({ totalQuestionsWanted }),
  setDistributeQuestions: (distributeQuestions) => set({ distributeQuestions }),
  setQuizStarted: (quizStarted) => set({ quizStarted }),
  setShowHistoryRecords: (showHistoryRecords) => set({ showHistoryRecords }),
  setLoadError: (loadError) => set({ loadError }),

  resetExam: () => set({ currentIndex: 0, answeredQuestions: {}, score: 0 }),

  clearHistory: () => {
    set({ quizHistory: [] });
    persistHistory([]);
  },

  deleteHistoryEntry: (id) => {
    const updatedHistory = get().quizHistory.filter((entry) => entry.id !== id);
    set({ quizHistory: updatedHistory });
    persistHistory(updatedHistory);
  },

  loadFiles: async () => {
    set({ loading: true, loadError: "" });

    try {
      const response = await fetch("/api/files");
      if (!response.ok) {
        throw new Error(`Failed to list files (${response.status})`);
      }

      const fileList = await response.json();
      const availableFiles = Array.isArray(fileList) ? fileList : [];
      set({
        files: availableFiles,
        selectedFile: availableFiles.length ? availableFiles[0] : "",
      });
    } catch (error) {
      set({
        files: [],
        selectedFile: "",
        loadError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      set({ loading: false });
    }
  },

  loadQuestions: async (file) => {
    if (!file) {
      return;
    }

    set({ loading: true, loadError: "" });

    try {
      const response = await fetch(`/api/questions/${encodeURIComponent(file)}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${file} (${response.status})`);
      }

      const data = await response.json();
      const allQuestions = Array.isArray(data) ? data : [];
      const pages = allQuestions
        .map((item) => item?.page)
        .filter((page) => Number.isInteger(page));

      const minPage = pages.length ? Math.min(...pages) : 1;
      const maxPage = pages.length ? Math.max(...pages) : 1;

      set({
        allQuestions,
        questions: [],
        pageStart: minPage,
        pageEnd: maxPage,
        quizStarted: false,
      });

      get().resetExam();
    } catch (error) {
      set({
        questions: [],
        loadError: error instanceof Error ? error.message : "Failed to load questions",
      });
    } finally {
      set({ loading: false });
    }
  },

  startQuiz: () => {
    const { allQuestions, pageStart, pageEnd, distributeQuestions, totalQuestionsWanted } = get();

    let filteredQuestions = allQuestions.filter((question) => {
      const page = question?.page;
      return page >= pageStart && page <= pageEnd;
    });

    if (distributeQuestions && totalQuestionsWanted > 0) {
      const numPages = pageEnd - pageStart + 1;
      const questionsPerPage = Math.floor(totalQuestionsWanted / numPages);
      const remainder = totalQuestionsWanted % numPages;
      const questionsByPage = {};

      for (let page = pageStart; page <= pageEnd; page += 1) {
        questionsByPage[page] = allQuestions.filter((question) => question?.page === page);
      }

      const distributedQuestions = [];
      let extraQuestionsAdded = 0;

      for (let page = pageStart; page <= pageEnd; page += 1) {
        const pageQuestions = questionsByPage[page];
        const qPerPage = questionsPerPage + (extraQuestionsAdded < remainder ? 1 : 0);

        if (pageQuestions.length < qPerPage) {
          set({
            loadError: `Page ${page} has only ${pageQuestions.length} questions, but ${qPerPage} are needed.`,
          });
          return;
        }

        distributedQuestions.push(...shuffleArray(pageQuestions).slice(0, qPerPage));

        if (extraQuestionsAdded < remainder) {
          extraQuestionsAdded += 1;
        }
      }

      filteredQuestions = distributedQuestions;
    }

    if (!filteredQuestions.length) {
      set({ loadError: "No questions found for the selected page range." });
      return;
    }

    set({
      loadError: "",
      questions: filteredQuestions,
      answeredQuestions: {},
      score: 0,
      currentIndex: 0,
      quizStarted: true,
    });
  },

  handleAnswerClick: (option) => {
    const { answeredQuestions, currentIndex, questions, score } = get();

    if (answeredQuestions[currentIndex]) {
      return;
    }

    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) {
      return;
    }

    set({
      answeredQuestions: { ...answeredQuestions, [currentIndex]: option },
      score: option === currentQuestion.answer ? score + 1 : score,
    });
  },

  nextQuestion: () => {
    const { currentIndex, questions } = get();

    if (currentIndex < questions.length - 1) {
      set({ currentIndex: currentIndex + 1 });
      return;
    }

    get().saveQuizHistory();
  },

  prevQuestion: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  shuffleQuestions: () => {
    const { questions } = get();
    if (!questions.length) {
      return;
    }

    set({
      questions: shuffleArray(questions),
      currentIndex: 0,
      answeredQuestions: {},
      score: 0,
    });
  },

  saveQuizHistory: () => {
    const {
      selectedFile,
      questions,
      score,
      answeredQuestions,
      pageStart,
      pageEnd,
      quizHistory,
    } = get();

    if (!questions.length) {
      return;
    }

    const historyEntry = {
      id: Date.now(),
      file: selectedFile,
      totalQuestions: questions.length,
      score,
      percentage: Math.round((score / questions.length) * 100),
      timestamp: new Date().toLocaleString(),
      answers: answeredQuestions,
      pageStart,
      pageEnd,
    };

    const updatedHistory = [historyEntry, ...quizHistory];
    set({ quizHistory: updatedHistory, quizStarted: false });
    persistHistory(updatedHistory);
  },
}));
