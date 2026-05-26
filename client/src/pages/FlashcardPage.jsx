import { useEffect, useState } from "react";

function FlashcardPage({ apiUrl = "/api/flashcards", embedded = false }) {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [visibleAnswers, setVisibleAnswers] = useState({});

	useEffect(() => {
		let isMounted = true;

		async function loadFlashcards() {
			try {
				setLoading(true);
				setError("");

				const response = await fetch(apiUrl);

				if (!response.ok) {
					throw new Error(`Failed to load flashcards: ${response.status}`);
				}

				const flashcardData = await response.json();

				if (isMounted) {
					setData(flashcardData);
					setVisibleAnswers({});
				}
			} catch (fetchError) {
				if (isMounted) {
					setError(fetchError.message || "Something went wrong while loading flashcards.");
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

	const flashcards = data?.flashcards || [];

	const toggleAnswer = (index) => {
		setVisibleAnswers((currentValue) => ({
			...currentValue,
			[index]: !currentValue[index],
		}));
	};

	const flashcardWorkspace = (
		<div className="flashcard-page">
			<style>{`
				.flashcard-page {
					min-height: 100vh;
					padding: 24px;
					background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
					color: #102033;
					font-family: Arial, sans-serif;
				}

				.flashcard-page * {
					box-sizing: border-box;
				}

				.flashcard-container {
					max-width: 1100px;
					margin: 0 auto;
				}

				.flashcard-header {
					margin-bottom: 24px;
					padding: 24px;
					background: rgba(255, 255, 255, 0.85);
					border: 1px solid #d9e4f2;
					border-radius: 20px;
					box-shadow: 0 10px 30px rgba(16, 32, 51, 0.08);
				}

				.flashcard-header h1 {
					margin: 0 0 8px;
					font-size: clamp(1.7rem, 3vw, 2.5rem);
				}

				.flashcard-header p {
					margin: 0;
					color: #526071;
				}

				.flashcard-meta {
					display: flex;
					flex-wrap: wrap;
					gap: 12px;
					margin-top: 16px;
				}

				.meta-pill {
					display: inline-flex;
					align-items: center;
					padding: 8px 12px;
					border-radius: 999px;
					background: #e8f0ff;
					color: #1d4ed8;
					font-size: 0.92rem;
					font-weight: 700;
				}

				.flashcard-status {
					padding: 16px 18px;
					border-radius: 16px;
					background: #ffffff;
					border: 1px solid #d9e4f2;
					box-shadow: 0 8px 24px rgba(16, 32, 51, 0.06);
				}

				.flashcard-status.error {
					border-color: #f3b4b4;
					background: #fff6f6;
					color: #9f1239;
				}

				.flashcard-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
					gap: 20px;
				}

				.flashcard-card {
					display: flex;
					flex-direction: column;
					gap: 14px;
					padding: 20px;
					background: #ffffff;
					border: 1px solid #d9e4f2;
					border-radius: 20px;
					box-shadow: 0 10px 30px rgba(16, 32, 51, 0.08);
				}

				.flashcard-card h2 {
					margin: 0;
					font-size: 1.15rem;
				}

				.flashcard-field {
					padding: 12px 14px;
					border-radius: 14px;
					background: #f8fbff;
					border: 1px solid #e2eaf5;
				}

				.flashcard-field strong {
					display: block;
					margin-bottom: 6px;
					font-size: 0.8rem;
					text-transform: uppercase;
					letter-spacing: 0.04em;
					color: #54657a;
				}

				.flashcard-field p,
				.flashcard-field ul {
					margin: 0;
					color: #13253a;
					line-height: 1.6;
				}

				.flashcard-keywords {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
				}

				.flashcard-keyword {
					padding: 6px 10px;
					border-radius: 999px;
					background: #edf7ff;
					color: #075985;
					font-size: 0.85rem;
				}

				.flashcard-answer {
					background: #effdf5;
					border-color: #c9f2d9;
				}

				.flashcard-actions {
					display: flex;
					gap: 10px;
					flex-wrap: wrap;
				}

				.flashcard-button {
					border: 0;
					border-radius: 12px;
					padding: 10px 14px;
					background: #1d4ed8;
					color: #ffffff;
					font-weight: 700;
					cursor: pointer;
				}

				.flashcard-button.secondary {
					background: #dbeafe;
					color: #1e40af;
				}

				.flashcard-badge-row {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
				}

				.flashcard-badge {
					padding: 6px 10px;
					border-radius: 999px;
					background: #f1f5f9;
					font-size: 0.84rem;
					color: #334155;
				}

				@media (max-width: 640px) {
					.flashcard-page {
						padding: 16px;
					}

					.flashcard-header,
					.flashcard-card {
						padding: 16px;
						border-radius: 16px;
					}
				}
			`}</style>

			<div className="flashcard-container">
				<header className="flashcard-header">
					<h1>Flashcards</h1>
					<p>Simple flashcard viewer loaded from an API response.</p>
					<div className="flashcard-meta">
						<div className="meta-pill">Page {data?.page ?? "-"}</div>
						<div className="meta-pill">Flashcard count: {data?.flashcard_count ?? flashcards.length}</div>
						<div className="meta-pill">Source: {apiUrl}</div>
					</div>
				</header>

				{loading ? <div className="flashcard-status">Loading flashcards...</div> : null}

				{error ? <div className="flashcard-status error">{error}</div> : null}

				{!loading && !error && flashcards.length === 0 ? (
					<div className="flashcard-status">No flashcards were found in the API response.</div>
				) : null}

				<div className="flashcard-grid">
					{flashcards.map((flashcard, index) => {
						const showAnswer = Boolean(visibleAnswers[index]);

						return (
							<article key={`${flashcard.page_number ?? data?.page ?? "page"}-${index}`} className="flashcard-card">
								<div className="flashcard-badge-row">
									<span className="flashcard-badge">Card {index + 1}</span>
									<span className="flashcard-badge">Page {flashcard.page_number ?? data?.page ?? "-"}</span>
									<span className="flashcard-badge">Difficulty: {flashcard.difficulty || "-"}</span>
								</div>

								<h2>{flashcard.question}</h2>

								<div className="flashcard-field">
									<strong>Answer</strong>
									<p>{showAnswer ? flashcard.answer : "Click the button below to show the answer."}</p>
								</div>

								<div className="flashcard-field">
									<strong>Concept</strong>
									<p>{flashcard.concept || "-"}</p>
								</div>

								<div className="flashcard-badge-row">
									<span className="flashcard-badge">Bloom: {flashcard.bloom_taxonomy_level || "-"}</span>
									<span className="flashcard-badge">Type: {flashcard.card_type || "-"}</span>
								</div>

								<div className="flashcard-field">
									<strong>Keywords</strong>
									<div className="flashcard-keywords">
										{(flashcard.keywords || []).map((keyword) => (
											<span key={keyword} className="flashcard-keyword">
												{keyword}
											</span>
										))}
										{(!flashcard.keywords || flashcard.keywords.length === 0) && <span className="flashcard-keyword">No keywords</span>}
									</div>
								</div>

								<div className="flashcard-actions">
									<button type="button" className="flashcard-button" onClick={() => toggleAnswer(index)}>
										{showAnswer ? "Hide answer" : "Show answer"}
									</button>
									<button type="button" className="flashcard-button secondary" onClick={() => toggleAnswer(index)}>
										Toggle answer
									</button>
								</div>
							</article>
						);
					})}
				</div>
			</div>
		</div>
	);

	return embedded ? flashcardWorkspace : <div className="app-shell quiz-shell">{flashcardWorkspace}</div>;
}

export default FlashcardPage;