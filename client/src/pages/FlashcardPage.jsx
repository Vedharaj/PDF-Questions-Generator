import { useEffect, useMemo, useState, useRef } from "react";

// Minimal defaults and helpers (original versions were removed). These
// are lightweight fallbacks so the page renders after moving styles.
const DEFAULT_FILTERS = { difficulty: "", bloom: "", cardType: "", concept: "" };

function normalizeFlashcardPages(data) {
	if (!data) return [];
	if (Array.isArray(data.pages) && data.pages.length) return data.pages;
	if (Array.isArray(data.flashcards)) return [{ page: 1, flashcards: data.flashcards }];
	return [];
}

function cardMatchesFilters(card = {}, filters = {}, query = "") {
	if (!card) return false;
	if (query) {
		const hay = JSON.stringify(card).toLowerCase();
		if (!hay.includes(query.toLowerCase())) return false;
	}
	return true;
}

function buildCardKey(page, card = {}, index = 0) {
	const id = card.id ?? card.key ?? index;
	return `${page}-${id}`;
}

function PageNavigator({ currentPageNumber = 1, totalPages = 0, onPreviousPage, onNextPage, canGoPrevious, canGoNext }) {
	return (
		<>
			<div className="flashcard-panel-heading">
				<h2>Page {currentPageNumber}</h2>
				<div className="flashcard-page-index">{currentPageNumber} / {totalPages}</div>
			</div>
			<div className="flashcard-nav-buttons">
				<button type="button" className="study-pill" onClick={onPreviousPage} disabled={!canGoPrevious}>Previous</button>
				<button type="button" className="study-pill" onClick={onNextPage} disabled={!canGoNext}>Next</button>
			</div>
		</>
	);
}

function FlashcardViewer({ currentCard, isFlipped, onFlip, onPreviousCard, onNextCard, canGoPrevious, canGoNext, progressPercentage, currentStatus, onMarkKnown, onMarkReview, onMarkDifficult, onClearStatus, totalCards = 0, currentIndex = 0 }) {
	return (
		<div className="flashcard-viewer-panel">
				<div className={`flashcard-card-face ${isFlipped ? "back" : "front"}`} onClick={onFlip}>
					<div className="flashcard-face-label">{isFlipped ? "Back" : "Front"}</div>
					<p>{currentCard ? (isFlipped ? (currentCard.answer || currentCard.back) : (currentCard.question || currentCard.front)) : "No card"}</p>
					<div className="flashcard-face-hint">Card {currentIndex} / {totalCards}</div>
				</div>
				<div className="flashcard-viewer-controls">
					<button className="study-pill" onClick={onPreviousCard} disabled={!canGoPrevious}>Prev</button>
					<button className="study-pill" onClick={onNextCard} disabled={!canGoNext}>Next</button>
				</div>
				<div className="flashcard-viewer-progress" aria-hidden>
					<span style={{display: 'none'}}>Progress: {progressPercentage}%</span>
				</div>
			</div>
	);
}

function FlashcardPage({ apiUrl = "/api/flashcards", embedded = false, contentMode = "flashcard" }) {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [currentPageIndex, setCurrentPageIndex] = useState(0);
	const [currentCardIndex, setCurrentCardIndex] = useState(0);
	const [isFlipped, setIsFlipped] = useState(false);
	const [filters, setFilters] = useState(DEFAULT_FILTERS);
	const [searchQuery, setSearchQuery] = useState("");
	const [cardStatusMap, setCardStatusMap] = useState({});
	const previousCardKeyRef = useRef("");

	useEffect(() => {
		let isMounted = true;

		async function loadFlashcards() {
			try {
				setLoading(true);
				setError("");
				setCurrentPageIndex(0);
				setCurrentCardIndex(0);
				setIsFlipped(false);
				setFilters(DEFAULT_FILTERS);
				setSearchQuery("");
				setCardStatusMap({});
				previousCardKeyRef.current = "";

				const response = await fetch(apiUrl);

				if (!response.ok) {
					throw new Error(`Failed to load flashcards: ${response.status}`);
				}

				const flashcardData = await response.json();

				if (isMounted) {
					setData(flashcardData);
				}
			} catch (fetchError) {
				if (isMounted) {
					setData(null);
					setError(fetchError instanceof Error ? fetchError.message : "Something went wrong while loading flashcards.");
				}
			} finally {
				if (isMounted) {
					setLoading(false);
				}
			}
		}

		loadFlashcards();

		return () => {
			isMounted = false;
		};
	}, [apiUrl]);

	const pages = useMemo(() => normalizeFlashcardPages(data), [data]);
	const currentPage = pages[currentPageIndex] || null;
	const currentPageCards = currentPage?.flashcards || [];

	// filterOptions removed (computed but unused)

	const visibleCards = useMemo(
		() => currentPageCards.filter((card) => cardMatchesFilters(card, filters, searchQuery)),
		[currentPageCards, filters, searchQuery]
	);

	const currentCard = visibleCards[currentCardIndex] || null;
	const currentCardKey = currentCard ? buildCardKey(currentPage?.page || currentPageIndex + 1, currentCard, currentCardIndex) : "";
	const currentStatus = currentCardKey ? cardStatusMap[currentCardKey] || "" : "";

	const studyStats = useMemo(() => {
		const totalCards = visibleCards.length;
		const statusCounts = visibleCards.reduce(
			(accumulator, card, index) => {
				const cardKey = buildCardKey(currentPage?.page || currentPageIndex + 1, card, index);
				const status = cardStatusMap[cardKey];

				if (status === "known") accumulator.knownCards += 1;
				if (status === "review") accumulator.reviewCards += 1;
				if (status === "difficult") accumulator.difficultCards += 1;

				return accumulator;
			},
			{ knownCards: 0, reviewCards: 0, difficultCards: 0 }
		);

		const completedCards = statusCounts.knownCards + statusCounts.reviewCards + statusCounts.difficultCards;
		const remainingCards = Math.max(0, totalCards - completedCards);
		const completionPercentage = totalCards ? Math.round((completedCards / totalCards) * 100) : 0;

		return {
			totalCards,
			knownCards: statusCounts.knownCards,
			reviewCards: statusCounts.reviewCards,
			difficultCards: statusCounts.difficultCards,
			remainingCards,
			completionPercentage,
		};
	}, [cardStatusMap, currentPage?.page, currentPageIndex, visibleCards]);

	useEffect(() => {
		if (!currentCardKey) {
			previousCardKeyRef.current = "";
			setIsFlipped(false);
			return;
		}

		if (previousCardKeyRef.current !== currentCardKey) {
			previousCardKeyRef.current = currentCardKey;
			setIsFlipped(false);
		}
	}, [currentCardKey]);

	useEffect(() => {
		if (currentCardIndex >= visibleCards.length && visibleCards.length > 0) {
			setCurrentCardIndex(0);
			setIsFlipped(false);
		}
	}, [currentCardIndex, visibleCards.length]);

	useEffect(() => {
		if (!currentPage) {
			return;
		}

		setCurrentCardIndex(0);
		setIsFlipped(false);
	}, [currentPageIndex]);

	const updateCardStatus = (status) => {
		if (!currentCardKey) {
			return;
		}

		setCardStatusMap((currentValue) => ({
			...currentValue,
			[currentCardKey]: status,
		}));
	};

	const clearCurrentStatus = () => {
		if (!currentCardKey) {
			return;
		}

		setCardStatusMap((currentValue) => {
			const nextValue = { ...currentValue };
			delete nextValue[currentCardKey];
			return nextValue;
		});
	};

	const goToPreviousPage = () => {
		setCurrentPageIndex((currentValue) => Math.max(0, currentValue - 1));
	};

	const goToNextPage = () => {
		setCurrentPageIndex((currentValue) => Math.min(pages.length - 1, currentValue + 1));
	};

	const goToPreviousCard = () => {
		setCurrentCardIndex((currentValue) => Math.max(0, currentValue - 1));
	};

	const goToNextCard = () => {
		setCurrentCardIndex((currentValue) => Math.min(visibleCards.length - 1, currentValue + 1));
	};

	const handleResetFilters = () => {
		setFilters(DEFAULT_FILTERS);
		setSearchQuery("");
		setCurrentCardIndex(0);
		setIsFlipped(false);
	};

	useEffect(() => {
		const handleKeyDown = (event) => {
			const target = event.target;
			const isTypingField =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				target?.isContentEditable;

			if (isTypingField || loading || error || !currentCard) return;

			// ignore when modifier keys are pressed
			if (event.ctrlKey || event.altKey || event.metaKey) return;

			const isSpace = event.code === "Space" || event.key === " " || event.key === "Spacebar";
			if (!isSpace) return;

			event.preventDefault();
			setIsFlipped((currentValue) => !currentValue);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [currentCard, error, loading, visibleCards.length]);

	useEffect(() => {
		const handleKeyDown = (event) => {
			const target = event.target;
			const isTypingField =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				target?.isContentEditable;

			if (isTypingField || loading || error || contentMode !== "flashcard") return;

			if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

			if (event.key === "ArrowLeft") {
				event.preventDefault();
				goToPreviousCard();
				return;
			}

			if (event.key === "ArrowRight") {
				event.preventDefault();
				goToNextCard();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [contentMode, error, loading, visibleCards.length]);


	// const metadataPanel = <CardMetadata card={currentCard} />;

	const content = (
		<div className="flashcard-page">
			<div className="flashcard-shell">
				<header className="flashcard-header">
					<div>
						<h1>Flashcard Study</h1>
						<p>Page-by-page flashcard study powered by the flashcard API.</p>
					</div>

					<div className="flashcard-header-meta">
						<span>Pages: {pages.length}</span>
						<span>Total cards: {data?.metadata?.total_flashcards ?? pages.reduce((sum, page) => sum + (page.flashcards?.length || 0), 0)}</span>
						{/* <span>Source: {apiUrl}</span> */}
					</div>
				</header>

				{loading ? <div className="flashcard-panel">Loading flashcards...</div> : null}
				{error ? <div className="flashcard-panel flashcard-empty-state">{error}</div> : null}

				{!loading && !error && pages.length === 0 ? (
					<div className="flashcard-panel flashcard-empty-state">No flashcard pages were found in the API response.</div>
				) : null}

				{!loading && !error && pages.length > 0 ? (
					<main className="flashcard-main">
						<div className="flashcard-panel">
							<PageNavigator
								totalPages={pages.length}
								currentPageNumber={currentPage?.page ?? currentPageIndex + 1}
								onPreviousPage={goToPreviousPage}
								onNextPage={goToNextPage}
								canGoPrevious={currentPageIndex > 0}
								canGoNext={currentPageIndex < pages.length - 1}
							/>
							<FlashcardViewer
								currentCard={currentCard}
								isFlipped={isFlipped}
								onFlip={() => setIsFlipped((currentValue) => !currentValue)}
								onPreviousCard={goToPreviousCard}
								onNextCard={goToNextCard}
								canGoPrevious={currentCardIndex > 0}
								canGoNext={currentCardIndex < visibleCards.length - 1}
								currentStatus={currentStatus}
								progressPercentage={studyStats.totalCards ? Math.round(((currentCardIndex + 1) / studyStats.totalCards) * 100) : 0}
								currentIndex={currentCardIndex + 1}
								onMarkKnown={() => updateCardStatus("known")}
								onMarkReview={() => updateCardStatus("review")}
								onMarkDifficult={() => updateCardStatus("difficult")}
								onClearStatus={clearCurrentStatus}
								totalCards={studyStats.totalCards}
							/>
						</div>
					</main>
				) : null}
			</div>
		</div>
	);

	return embedded ? content : <div className="app-shell quiz-shell">{content}</div>;
}

export default FlashcardPage;