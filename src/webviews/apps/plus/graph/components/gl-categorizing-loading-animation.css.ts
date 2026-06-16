import { css } from 'lit';

export const categorizingLoadingAnimationStyles = css`
	:host {
		display: block;
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		opacity: 0;
		transition: opacity 0.6s ease-in;
		--gl-loading-accent: var(--vscode-charts-purple, #c084fc);
	}

	:host([variant='review']) {
		--gl-loading-accent: var(--vscode-charts-yellow, #facc15);
	}

	:host([data-ready]) {
		opacity: 1;
	}

	.stage {
		position: absolute;
		inset: 0;
	}

	.bucket {
		position: absolute;
		border-bottom: 0.2rem solid currentColor;
		border-radius: 0.6rem;
		opacity: 0.55;
		background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, currentColor 12%, transparent) 100%);
	}

	.lens {
		position: absolute;
		border-top: 1px solid color-mix(in srgb, var(--vscode-foreground) 12%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--vscode-foreground) 12%, transparent);
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in srgb, var(--vscode-foreground) 4%, transparent) 50%,
			transparent 100%
		);
		overflow: hidden;
	}

	.lens__scanline {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in srgb, var(--gl-loading-accent) 70%, transparent) 50%,
			transparent 100%
		);
		animation: gl-categorizing-scanline 1.4s ease-in-out infinite alternate;
		will-change: top, opacity;
	}

	.particle {
		position: absolute;
		top: 0;
		left: 0;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--vscode-foreground) 35%, transparent);
		filter: blur(1px);
		opacity: 0;
		will-change: transform, opacity;
	}

	.particle--categorized {
		filter: none;
		width: 0.6rem;
		height: 0.6rem;
	}

	@keyframes gl-categorizing-scanline {
		0% {
			top: 0;
			opacity: 0.35;
		}
		50% {
			opacity: 1;
		}
		100% {
			top: calc(100% - 1px);
			opacity: 0.35;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:host {
			display: none;
		}
	}
`;
