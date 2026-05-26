import { useEffect, useState } from "react";

import {
	ChevronLeft,
	ChevronRight,
	CheckCircle2,
	XCircle,
	Shuffle,
	FileText,
	Trophy,
	BookOpen,
	Trash2,
} from "lucide-react";

function QuizPage({
	contentMode,
	selectedFile,
	files,
	onFileChange,
	onChangeRange,
	onShuffle,
	currentQuestion,
	currentIndex,
	questions,
	answeredQuestions,
	score,
	progress,
	showAnswer,
	onPrevQuestion,
	onNextQuestion,
	onAnswerClick,
	onDeleteHistoryEntry,
	quizHistory,
	historyChartData,
	showHistoryRecords,
	onToggleHistoryRecords,
	onClearHistory,
	embedded = false,
}) {
	const isFlashcardMode = contentMode === "flashcard";
	const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

	useEffect(() => {
		setShowFlashcardAnswer(false);
	}, [contentMode, currentIndex, currentQuestion?.question]);

	if (isFlashcardMode) {
		const flashcardWorkspace = (
			<div className="question-card flashcard-card">
				<div className="card-header-row">
					<div className="meta">
						<span className="badge difficulty">{currentQuestion?.difficulty || "flashcard"}</span>
						<span className="badge page">Page {currentQuestion?.page_number ?? currentQuestion?.page}</span>
					</div>

					<div className="card-nav" aria-label="Flashcard navigation">
						<button
							className="nav-icon-button"
							onClick={onPrevQuestion}
							disabled={currentIndex === 0}
							aria-label="Previous flashcard"
							title="Previous flashcard"
						>
							<ChevronLeft size={20} />
						</button>

						<button
							className={`nav-icon-button ${currentIndex === questions.length - 1 ? "finish-btn" : "primary-nav"}`}
							onClick={onNextQuestion}
							aria-label={currentIndex === questions.length - 1 ? "Finish flashcards" : "Next flashcard"}
							title={currentIndex === questions.length - 1 ? "Finish flashcards" : "Next flashcard"}
						>
							{currentIndex === questions.length - 1 ? <Trophy size={20} /> : <ChevronRight size={20} />}
						</button>
					</div>
				</div>

				<h2 className="question">{currentQuestion?.question}</h2>

				<div className="flashcard-stage">
					<button
						type="button"
						className={`flashcard-face ${showFlashcardAnswer ? "revealed" : ""}`}
						onClick={() => setShowFlashcardAnswer((currentValue) => !currentValue)}
						aria-pressed={showFlashcardAnswer}
					>
						<div className="flashcard-face-label">Prompt</div>
						<p className="flashcard-face-text">{currentQuestion?.question}</p>
						{currentQuestion?.concept ? <div className="flashcard-concept">{currentQuestion.concept}</div> : null}
					</button>

					<div className="flashcard-actions">
						<button type="button" className="ghost-button" onClick={() => setShowFlashcardAnswer((currentValue) => !currentValue)}>
							{showFlashcardAnswer ? "Hide answer" : "Show answer"}
						</button>
					</div>

					{showFlashcardAnswer ? (
						<div className="explanation flashcard-answer">
							<h3>
								<Trophy size={18} />
								Answer
							</h3>
							<p>{currentQuestion?.answer}</p>
						</div>
					) : (
						<div className="flashcard-hint">Click the card or use Show answer to reveal the back.</div>
					)}
				</div>
			</div>
		);

		return embedded ? flashcardWorkspace : <div className="app-shell quiz-shell">{flashcardWorkspace}</div>;
	}

	const questionWorkspace = (
		<div className="question-card">
			<div className="card-header-row">
				<div className="meta">
					<span className="badge difficulty">{currentQuestion?.difficulty}</span>
					<span className="badge page">Page {currentQuestion?.page}</span>
				</div>

				<div className="card-nav" aria-label="Question navigation">
					<button
						className="nav-icon-button"
						onClick={onPrevQuestion}
						disabled={currentIndex === 0}
						aria-label="Previous question"
						title="Previous question"
					>
						<ChevronLeft size={20} />
					</button>

					<button
						className={`nav-icon-button ${currentIndex === questions.length - 1 ? "finish-btn" : "primary-nav"}`}
						onClick={onNextQuestion}
						aria-label={currentIndex === questions.length - 1 ? "Finish quiz" : "Next question"}
						title={currentIndex === questions.length - 1 ? "Finish quiz" : "Next question"}
					>
						{currentIndex === questions.length - 1 ? <Trophy size={20} /> : <ChevronRight size={20} />}
					</button>
				</div>
			</div>

			<h2 className="question">{currentQuestion?.question}</h2>

			<div className={`question-content ${showAnswer ? "show-answer" : ""}`}>
				<div className="options">
					{currentQuestion?.options?.map((option, index) => {
						const isCorrect = option === currentQuestion.answer;
						const userAnswer = answeredQuestions[currentIndex];
						const isSelected = option === userAnswer;
						const isAnswered = currentIndex in answeredQuestions;

						return (
							<button
								key={index}
								className={`option ${isAnswered && isCorrect ? "correct" : ""} ${isAnswered && isSelected && !isCorrect ? "wrong" : ""}`}
								onClick={() => onAnswerClick(option)}
								disabled={isAnswered}
							>
								<span>{option}</span>

								{isAnswered && isCorrect && <CheckCircle2 size={20} />}
								{isAnswered && isSelected && !isCorrect && <XCircle size={20} />}
							</button>
						);
					})}
				</div>

				{currentIndex in answeredQuestions && (
					<div className="explanation">
						<h3>
							<Trophy size={18} />
							Explanation
						</h3>
						<p>{currentQuestion?.explanation}</p>
					</div>
				)}
			</div>
		</div>
	);

	if (embedded) {
		return questionWorkspace;
	}

	return (
		<div className="app-shell quiz-shell">
			<div className="workspace-layout quiz-workspace">
				<aside className="workspace-sidebar quiz-sidebar">
					<div className="sidebar-section sidebar-brand">
						<div className="logo">
							<BookOpen size={34} />
							<div>
								<h1>MCQ Exam System</h1>
								<p>{selectedFile}</p>
							</div>
						</div>
					</div>

					<div className="sidebar-section">
						<div className="section-heading">
							<span className="eyebrow">Quiz source</span>
							<h2>File and range</h2>
						</div>

						<div className="stacked-controls">
							<label className="field">
								<span>JSON file</span>
								<div className="field-control dropdown">
									<FileText size={18} />
									<select value={selectedFile} onChange={(e) => onFileChange(e.target.value)}>
										{files.map((file) => (
											<option key={file} value={file}>
												{file}
											</option>
										))}
									</select>
								</div>
							</label>

							<div className="sidebar-button-row">
								<button className="ghost-button" onClick={onChangeRange}>
									Change Range
								</button>

								<button className="shuffle-btn" onClick={onShuffle}>
									<Shuffle size={18} />
									Shuffle
								</button>
							</div>
						</div>
					</div>

					<div className="sidebar-section">
						<div className="section-heading">
							<span className="eyebrow">Session</span>
							<h2>Progress</h2>
						</div>

						<div className="progress-wrapper sidebar-progress">
							<div className="progress-info">
								<span>
									Question {currentIndex + 1} / {questions.length}
								</span>
								<span>Score: {score}</span>
							</div>

							<div className="progress-bar">
								<div className="progress-fill" style={{ width: `${progress}%` }} />
							</div>
						</div>
					</div>

					{quizHistory.length > 0 && (
						<div className="sidebar-section sidebar-history">
							<div className="history-panel-header compact-panel-header">
								<div className="panel-header">
									<span className="eyebrow">History</span>
									<h2>Attempts</h2>
									<p>Your previous quiz attempts</p>
								</div>

								<button className="ghost-button history-toggle-button" onClick={onToggleHistoryRecords}>
									{showHistoryRecords ? "Hide records" : "Show records"}
								</button>
							</div>

							{showHistoryRecords && (
								<>
									<div className="history-chart compact-history-chart">
										<div className="history-chart-header">
											<div>
												<h3>{historyChartData.fileSummary}</h3>
											</div>
										</div>

										<svg
											className="history-chart-svg"
											viewBox={`0 0 ${historyChartData.width} ${historyChartData.height}`}
											role="img"
											aria-label="Quiz history chart with page on the x axis and score on the y axis"
										>
											<defs>
												<linearGradient id="historyLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
													<stop offset="0%" stopColor="#38bdf8" />
													<stop offset="100%" stopColor="#22c55e" />
												</linearGradient>
											</defs>

											<line
												x1={historyChartData.padding.left}
												y1={historyChartData.height - historyChartData.padding.bottom}
												x2={historyChartData.width - historyChartData.padding.right}
												y2={historyChartData.height - historyChartData.padding.bottom}
												className="history-axis"
											/>
											<line
												x1={historyChartData.padding.left}
												y1={historyChartData.padding.top}
												x2={historyChartData.padding.left}
												y2={historyChartData.height - historyChartData.padding.bottom}
												className="history-axis"
											/>

											{historyChartData.bars.map((bar) => (
												<g key={bar.key}>
													<rect
														x={bar.x}
														y={bar.y}
														width={bar.width}
														height={bar.height}
														rx="12"
														className="history-bar"
													/>
													<text x={bar.centerX} y={bar.y - 10} className="history-label score-label" textAnchor="middle">
														{bar.avgPercentage}%
													</text>
													<text x={bar.centerX} y={bar.y - 26} className="history-label count-label" textAnchor="middle">
														{bar.count} attempt{bar.count > 1 ? "s" : ""}
													</text>
													<text
														x={bar.centerX}
														y={historyChartData.height - 18}
														className="history-label x-label"
														textAnchor="middle"
													>
														{bar.label}
													</text>
												</g>
											))}

											{[0, 1, 2, 3].map((tick) => {
												const tickValue = Math.round((historyChartData.yMax / 3) * tick);
												const plotHeight = historyChartData.height - historyChartData.padding.top - historyChartData.padding.bottom;
												const y = historyChartData.padding.top + plotHeight - ((tickValue / historyChartData.yMax) * plotHeight);

												return (
													<g key={tickValue}>
														<line
															x1={historyChartData.padding.left}
															x2={historyChartData.width - historyChartData.padding.right}
															y1={y}
															y2={y}
															className="history-grid"
														/>
														<text x={historyChartData.padding.left - 12} y={y + 4} className="history-label y-label" textAnchor="end">
															{tickValue}%
														</text>
													</g>
												);
											})}
										</svg>
									</div>

									<div className="history-list compact-history-list">
										{quizHistory.map((entry) => (
											<div key={entry.id} className="history-item">
												<div className="history-info">
													<h4>{entry.file}</h4>
													<p>{entry.timestamp}</p>
													<p className="page-range">Pages {entry.pageStart} - {entry.pageEnd}</p>
												</div>
												<div className="history-score">
													<div className="score-badge">
														<strong>{entry.score}/{entry.totalQuestions}</strong>
														<span>{entry.percentage}%</span>
													</div>
													<button
														className="ghost-button delete-history-button"
														onClick={(e) => {
															e.stopPropagation();
															onDeleteHistoryEntry(entry.id);
														}}
														title="Delete record"
														aria-label={`Delete history ${entry.id}`}
														style={{ position: "absolute", top: 8, right: 8 }}
													>
														<Trash2 size={16} />
													</button>
												</div>
											</div>
										))}
									</div>

									<button className="ghost-button sidebar-full-button" onClick={onClearHistory}>
										Clear History
									</button>
								</>
							)}
						</div>
					)}
				</aside>

				<main className="workspace-main quiz-main">{questionWorkspace}</main>
			</div>
		</div>
	);
}

export default QuizPage;
