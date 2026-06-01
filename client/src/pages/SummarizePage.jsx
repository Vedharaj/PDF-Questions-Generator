import { ChevronUp, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";

const SUMMARY_SCROLL_COOKIE = "pdfqg_summary_scroll_positions";

const readCookieValue = (cookieName) => {
	if (typeof document === "undefined") {
		return "";
	}

	const cookieEntry = document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(`${cookieName}=`));

	if (!cookieEntry) {
		return "";
	}

	return decodeURIComponent(cookieEntry.slice(cookieName.length + 1));
};

const writeCookieValue = (cookieName, cookieValue) => {
	if (typeof document === "undefined") {
		return;
	}

	document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}; path=/; max-age=31536000; samesite=lax`;
};

const readScrollPositions = () => {
	const cookieValue = readCookieValue(SUMMARY_SCROLL_COOKIE);

	if (!cookieValue) {
		return {};
	}

	try {
		const parsedValue = JSON.parse(cookieValue);
		return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
	} catch (error) {
		return {};
	}
};

const writeScrollPositions = (positions) => {
	writeCookieValue(SUMMARY_SCROLL_COOKIE, JSON.stringify(positions));
};

function SummarizePage({
	summaryFiles,
	selectedSummaryFile,
	summaryContent,
	summaryFilesLoading,
	summaryContentLoading,
	summaryError,
	onSelectSummaryFile,
	quizHistory,
	embedded = false,
}) {
	const [markdownFontSize, setMarkdownFontSize] = useState(20);
	const [scrollProgress, setScrollProgress] = useState(0);
	const [showScrollTopButton, setShowScrollTopButton] = useState(false);
	const previewScrollRef = useRef(null);
	const scrollTopButtonThreshold = 120;
	const scrollRestoreFrameRef = useRef(null);

	const updateScrollProgress = () => {
		const scrollElement = previewScrollRef.current;

		if (!scrollElement) {
			setScrollProgress(0);
			setShowScrollTopButton(false);
			return;
		}

		const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
		const currentScrollTop = scrollElement.scrollTop;
		const hasScrollableContent = maxScroll > 0;
		const currentProgress = hasScrollableContent ? Math.round((currentScrollTop / maxScroll) * 100) : summaryContent ? 100 : 0;

		setScrollProgress(currentProgress);
		setShowScrollTopButton(currentScrollTop > scrollTopButtonThreshold);
	};

	const persistScrollPosition = (scrollTop) => {
		if (!selectedSummaryFile) {
			return;
		}

		const existingPositions = readScrollPositions();
		const nextPositions = {
			...existingPositions,
			[selectedSummaryFile]: Math.max(0, Math.round(scrollTop)),
		};

		writeScrollPositions(nextPositions);
	};

	const scrollToTop = () => {
		const scrollElement = previewScrollRef.current;

		if (!scrollElement) {
			return;
		}

		scrollElement.scrollTo({ top: 0, behavior: "smooth" });
	};

	const onPreviewClick = (event) => {
		if (!previewScrollRef.current) return;

		const anchor = event.target && event.target.closest ? event.target.closest("a") : null;
		if (!anchor) return;

		const href = anchor.getAttribute("href") || "";
		// Only intercept pure fragment links like "#heading"
		if (!href.startsWith("#")) return;

		event.preventDefault();

		const targetId = href.slice(1);
		if (!targetId) return;

		const root = previewScrollRef.current;
		const target = document.getElementById(targetId);
		if (target && root && root.contains(target)) {
			const top = target.offsetTop;
			root.scrollTo({ top, behavior: "smooth" });
			persistScrollPosition(top);
			updateScrollProgress();
		}
	};

	useEffect(() => {
		updateScrollProgress();
	}, [summaryContent, summaryContentLoading, markdownFontSize, selectedSummaryFile]);

	useEffect(() => {
		const scrollElement = previewScrollRef.current;

		if (!scrollElement || summaryContentLoading || !summaryContent || !selectedSummaryFile) {
			return;
		}

		if (scrollRestoreFrameRef.current) {
			cancelAnimationFrame(scrollRestoreFrameRef.current);
		}

		const savedPositions = readScrollPositions();
		const savedScrollTop = Number(savedPositions[selectedSummaryFile]) || 0;

		scrollRestoreFrameRef.current = requestAnimationFrame(() => {
			scrollRestoreFrameRef.current = requestAnimationFrame(() => {
				scrollElement.scrollTo({ top: savedScrollTop, behavior: "auto" });
				updateScrollProgress();
			});
		});

		return () => {
			if (scrollRestoreFrameRef.current) {
				cancelAnimationFrame(scrollRestoreFrameRef.current);
			}
		};
	}, [selectedSummaryFile, summaryContent, summaryContentLoading]);

	const decreaseFontSize = () => {
		setMarkdownFontSize((currentValue) => Math.max(13, currentValue - 1));
	};

	const increaseFontSize = () => {
		setMarkdownFontSize((currentValue) => Math.min(22, currentValue + 1));
	};

	const previewWorkspace = (
		<section className="summary-preview-panel">
			{showScrollTopButton ? (
				<button
					type="button"
					className="summary-scroll-top-button"
					onClick={scrollToTop}
					aria-label="Scroll to top"
					title="Scroll to top"
				>
					<ChevronUp size={18} />
				</button>
			) : null}

			<div
				className="summary-preview-scroll"
				ref={previewScrollRef}
				onScroll={(event) => {
					updateScrollProgress();
					persistScrollPosition(event.currentTarget.scrollTop);
				}}
				onClick={onPreviewClick}
			>
				{summaryContentLoading ? (
					<div className="summary-empty-state">Loading preview…</div>
				) : summaryContent ? (
					<div className="summary-markdown-preview" style={{ fontSize: `${markdownFontSize}px` }}>
						<ReactMarkdown
							remarkPlugins={[remarkGfm, remarkMath]}
							rehypePlugins={[rehypeKatex, rehypeSlug]}
						>{summaryContent}</ReactMarkdown>
					</div>
				) : (
					<div className="empty-summary-state">Choose a file to preview its content.</div>
				)}
			</div>

			<div className="progress-wrapper summary-scroll-progress" aria-label="Reading progress">
				<div className="progress-info">
					<span>Scrolled</span>
					<span>{scrollProgress}%</span>
				</div>

				<div className="progress-bar" aria-hidden="true">
					<div className="progress-fill" style={{ width: `${scrollProgress}%` }} />
				</div>
			</div>

			<div className="markdown-font-controls" aria-label="Markdown preview font size controls">
				<button
					type="button"
					className="markdown-font-button"
					onClick={decreaseFontSize}
					disabled={markdownFontSize <= 13}
					aria-label="Decrease preview font size"
					title="Decrease preview font size"
				>
					<Minus size={16} />
				</button>

				<div className="markdown-font-value" aria-live="polite">
					{markdownFontSize}px
				</div>

				<button
					type="button"
					className="markdown-font-button"
					onClick={increaseFontSize}
					disabled={markdownFontSize >= 22}
					aria-label="Increase preview font size"
					title="Increase preview font size"
				>
					<Plus size={16} />
				</button>
			</div>
		</section>
	);

	if (embedded) {
		return previewWorkspace;
	}

	return (
		<div className="app-shell summarize-shell">
			<div className="workspace-layout summarize-workspace">
				<aside className="workspace-sidebar summary-sidebar">
					<section className="summary-panel summary-file-list">

						{summaryFilesLoading ? (
							<div className="summary-empty-state">Loading summaries…</div>
						) : summaryFiles.length ? (
							<div className="summary-file-list-items">
								{summaryFiles.map((file) => (
									<button
										key={file}
										type="button"
										className={`summary-file-item ${selectedSummaryFile === file ? "active" : ""}`}
										onClick={() => onSelectSummaryFile(file)}
										title={file}
									>
										<span>{file}</span>
									</button>
								))}
							</div>
						) : (
							<div className="summary-empty-state">No markdown files found in data/summaries.</div>
						)}
					</section>
				</aside>
			</div>
		</div>
	);
}

export default SummarizePage;