import { css } from 'lit';

/** Rebase entry component styles */
export const entryStyles = css`
	:host {
		/* Dark theme action colors */
		--action-edit-color: hsl(120, 100%, 30%);
		--action-edit-bg: hsl(120, 100%, 10%);

		--action-squash-color: hsl(38, 100%, 42%);
		--action-squash-bg: hsl(38, 100%, 10%);

		--action-drop-color: hsl(0, 100%, 40%);
		--action-drop-bg: hsl(0, 100%, 10%);

		/* Muted text intensity */
		--fg-muted-intensity: 60%;

		--muted-opacity: 0.4;

		display: block;
		width: 100%;
		box-sizing: border-box;
		cursor: grab;

		&:hover {
			z-index: 100;
		}
	}

	/* Disable grab cursor when reordering is disabled (preserves merges) */
	:host-context(.preserves-merges) {
		cursor: default;
	}

	/* Light theme overrides */
	:host-context(.vscode-light),
	:host-context(.vscode-high-contrast-light) {
		/* Brighter, more saturated colors for visibility on light backgrounds */
		--action-edit-color: hsl(130, 100%, 32%);
		--action-edit-bg: hsl(120, 70%, 78%);

		--action-squash-color: hsl(46, 100%, 46%);
		--action-squash-bg: hsl(55, 85%, 70%);

		--action-drop-color: hsl(355, 100%, 40%);
		--action-drop-bg: hsl(355, 80%, 82%);

		--fg-muted-intensity: 70%;
	}

	/* Raise z-index only when overlays are open/hovered/focused to escape row stacking contexts */
	:host:has(gl-select[open]),
	:host:has(gl-popover[open]),
	:host:has(gl-tooltip:hover),
	:host:has(gl-tooltip:focus-within),
	:host:has(gl-avatar-list:hover),
	:host:has(gl-avatar-list:focus-within),
	:host:has(gl-ref-overflow-chip:hover),
	:host:has(gl-ref-overflow-chip:focus-within) {
		z-index: 1000;
	}

	.entry {
		/*
		 * Two-layer foreground color system:
		 * --fg-color: base color that changes per state (hover/focus/selected)
		 * --fg-intensity: caps brightness, action types can reduce (e.g. drop = 50%)
		 * --fg: computed from both, used for primary text
		 * --fg-muted: derived from --fg for secondary text (date, sha)
		 */
		--fg-color: var(--color-foreground);
		--fg-intensity: 100%;
		--fg: color-mix(in srgb, var(--fg-color) var(--fg-intensity), transparent);
		--fg-muted: color-mix(in srgb, var(--fg) var(--fg-muted-intensity), transparent);

		--action-color: var(--color-foreground--65);
		--action-line-color: var(--color-foreground--65);
		--action-text-decoration: none;

		--entry-bg: var(--color-background);

		--wa-form-control-background-color: var(--color-background);
		--wa-form-control-value-color: var(--color-foreground);
		--wa-form-control-value-color-hover: var(--color-foreground);
		--wa-form-control-value-color-disabled: var(--color-foreground);

		display: flex;
		align-items: center;
		gap: 1rem;
		position: relative;
		padding-inline: 1rem;
		padding-block: var(--gl-rebase-entry-padding-block, 0.2rem);
		border-radius: 0.3rem;
		box-sizing: border-box;
		color: var(--fg);
		width: 100%;

		&:hover {
			--entry-bg: var(--vscode-list-hoverBackground);

			background-color: var(--vscode-list-hoverBackground);
		}

		&:focus,
		&:focus-within {
			background-color: var(--vscode-list-focusBackground);
			box-shadow: 0 0 0 1px var(--vscode-list-focusOutline) inset;
			outline: none;
		}

		&.entry--selected {
			--fg-color: var(--vscode-list-activeSelectionForeground, var(--color-foreground));
			--entry-bg: var(--vscode-list-activeSelectionBackground);

			background-color: var(--vscode-list-activeSelectionBackground);
		}

		&.entry--first {
			.entry-graph::before {
				inset-block: 50% var(--gl-rebase-entry-graph-offset, -0.225rem);
			}
		}

		&.entry--last {
			.entry-graph::before {
				inset-block: var(--gl-rebase-entry-graph-offset, -0.225rem) 50%;
			}
		}

		/* Done entries - already applied commits */
		&.entry--done {
			--fg-intensity: 50%;
			--action-line-color: var(--color-foreground--50);
			/* Override default transparent action color with opaque muted gray for pick */
			--action-color: color-mix(in srgb, var(--color-foreground) 50%, var(--vscode-editor-background));

			background: var(--vscode-list-inactiveSelectionBackground);
			cursor: default;

			/* Filled circle for done entries */
			.entry-graph::after {
				border-color: transparent;
				background-color: var(--action-color);
				background-image: none;
			}

			/* Disabled select for done entries */
			.action-select {
				pointer-events: none;
				opacity: 0.6;

				/* Hide chevron for disabled selects */
				code-icon[slot='expand-icon'] {
					display: none;
				}
			}
		}

		/* Current entry - commit being processed (paused) */
		&.entry--current {
			--fg-intensity: 100%;

			background-color: color-mix(in srgb, var(--current-entry-color) 25%, transparent);
			outline: 1px solid color-mix(in srgb, var(--current-entry-color) 50%, transparent);
			outline-offset: -1px;

			.action-select {
				opacity: 1;
			}
		}

		/* Conflict entry - commit that will cause conflicts */
		&.entry--conflict {
			--fg-intensity: 100%;
			--conflict-color: var(
				--vscode-gitlens-decorations\\.statusMergingOrRebasingConflictForegroundColor,
				#c74e39
			);

			background-color: color-mix(in srgb, var(--conflict-color) 25%, transparent);
			outline: 1px solid color-mix(in srgb, var(--conflict-color) 50%, transparent);
			outline-offset: -1px;

			.action-select {
				opacity: 1;
			}

			.entry-conflict-indicator {
				display: flex;
			}
		}
	}

	/* Conflict indicator - hidden by default, shown on conflict entries */
	.entry-conflict-indicator {
		display: none;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		padding-inline: 0.4rem;
		color: var(--vscode-gitlens-decorations\\.statusMergingOrRebasingConflictForegroundColor, #c74e39);
	}

	/* Conflict popover content */
	.popover-conflict-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		color: var(--vscode-gitlens-decorations\\.statusMergingOrRebasingConflictForegroundColor, #c74e39);
		font-weight: 600;

		hr {
			width: 100%;
			border: none;
			border-top: 1px solid var(--color-foreground--25);
			margin: 0.5rem 0;
		}
	}

	/* Graph node */
	.entry-graph {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		flex: 0 0 auto;
		width: 16px;
		height: var(--gl-rebase-entry-graph-height, 25px);
		z-index: 2;

		/* circle for commits */
		&::after {
			content: '';
			position: absolute;
			left: 0;
			width: 12px;
			height: 12px;
			border-radius: 50%;
			border: 2px solid var(--action-color);
			/* Layer the row tint over an opaque editor base so the dot center always
			   covers the throughline — VS Code list hover/selection tokens are
			   semi-transparent overlays and would otherwise let the line shine through. */
			background-color: var(--vscode-editor-background);
			background-image: linear-gradient(var(--entry-bg), var(--entry-bg));
		}

		/* squircle for commands */
		.entry[data-type='command'] &::after {
			left: -0.2rem;
			width: 16px;
			height: 16px;
			border-radius: 0.4rem;
			z-index: -1;
		}

		/* throughline */
		&::before {
			content: '';
			position: absolute;
			inset-block: calc(-1 * var(--gl-rebase-entry-padding-block, 0.2rem));
			width: 0;
			border-right: 2px solid var(--action-line-color);
			z-index: -2;
		}
	}

	/* Action dropdown container */
	.entry-action {
		display: flex;
		align-items: center;
		flex: 0 0 auto;
	}

	/* Done action indicator - shows the completed action text */
	.entry-action--done {
		display: flex;
		align-items: center;
		min-width: 90px;
		padding-left: 0.75rem;
		font-size: 0.9em;
		color: var(--color-foreground--50);
	}

	.action-select {
		color: var(--color-foreground);
		min-width: 90px;
		/* Reset WA's form-control sizing tokens. WA defaults to padding-block: 0.75em
		   + line-height: 1.35 which produces a ~40px control height. We size the
		   combobox to track the graph dot so the select grows with row density. */
		--wa-form-control-padding-block: 0;
		--wa-form-control-value-line-height: 1.2;

		/* gl-select option styling overrides — wa-option lives in gl-select's shadow
		   root and can't be targeted directly from this scope, so we pass through
		   custom-properties exposed by gl-select itself. */
		--gl-select-option-padding: 0.2rem 0.4rem;
		--gl-select-option-hover-bg: var(--vscode-list-inactiveSelectionBackground);
		--gl-select-option-hover-color: var(--vscode-list-activeSelectionForeground);

		&::part(combobox) {
			padding: 0 0.75rem;
			outline: none;
			height: 25px;
			line-height: 1.2;
		}

		&::part(display-input) {
			field-sizing: content;
			line-height: 1.2;
		}

		&::part(expand-icon) {
			margin-inline-start: var(--wa-spacing-x-small);
		}

		&::part(listbox) {
			display: flex;
			flex-direction: column;
			gap: 0.1rem;
			padding-block: 0.2rem 0;
			min-width: anchor-size(width, 90px);
			width: max-content;
		}
	}

	/* Message */
	gl-popover.entry-message {
		--hide-delay: 100ms;
		--wa-z-index-tooltip: 10000;

		display: flex;
		flex: 1 1 0;
		align-self: stretch;
		min-width: 0;
		overflow: hidden;
		color: var(--fg);
		text-decoration: var(--action-text-decoration);

		/* Tooltip-style behavior: pointer events on the rendered popup pass through,
		   so the hover state ends as soon as the cursor leaves the anchor — matching
		   the file tree hover-popover. The wa-popup's popup part is re-exported from
		   gl-popover as base__popup (see popover.ts exportparts mapping). */
		&::part(base__popup),
		&::part(base__hover-bridge),
		&::part(body) {
			pointer-events: none;
		}

		&::part(body) {
			max-height: 50vh;
			overflow-y: auto;
		}
	}

	.entry-message-content {
		display: flex;
		align-items: center;
		height: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entry-message-body {
		color: color-mix(in srgb, var(--vscode-descriptionForeground) 75%, transparent);
		margin-left: 1rem;
	}

	/* Update refs */
	.entry-update-refs {
		&:focus,
		&:focus-within {
			outline-color: var(--color-focus-border);
		}

		flex-shrink: 0;
		align-self: center;

		/* Improve chip visibility */
		--vscode-badge-background: var(--vscode-activityBarBadge-background, var(--vscode-badge-background));
		--vscode-badge-foreground: var(--vscode-activityBarBadge-foreground, var(--vscode-badge-foreground));
	}

	/* Avatar */
	.entry-avatar {
		flex: 0 0 auto;
		min-width: 4rem;
		margin: 0;

		gl-avatar-list& {
			--gl-avatar-size: 2.4rem;

			&::part(base) {
				display: flex;
				justify-content: flex-end;
			}
		}
	}

	/* Date */
	.entry-date {
		flex: 0 0 auto;
		min-width: 11ch;
		margin: 0;
		color: var(--fg-muted);
		text-align: right;
		text-decoration: var(--action-text-decoration);
	}

	/* SHA */
	.entry-sha {
		flex: 0 0 auto;
		min-width: 10ch;
		margin: 0;
		color: var(--fg-muted);
		text-decoration: var(--action-text-decoration);

		a {
			color: inherit;
			text-decoration: none;

			&:focus,
			&:focus-visible {
				outline-color: var(--color-focus-border);
			}
		}
	}

	/* ==========================================================================
	   Entry Actions
	   ========================================================================== */

	.entry[data-type='command'] {
		--action-color: var(--color-foreground--50);
		--action-line-color: var(--action-color);

		/* Muted but responds to hover/focus/selected at reduced intensity */
		--fg-intensity: 60%;

		.entry-graph code-icon {
			font-size: 13px;
			color: var(--color-foreground--65);
		}

		.action-select {
			pointer-events: none;

			&::part(combobox) {
				opacity: 0.7;
			}
		}

		.entry-message-content {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			font-size: 0.9em;
			font-style: italic;

			code {
				display: inline;
				font-family: var(--vscode-editor-font-family, monospace);
				font-style: normal;
				background-color: var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.15));
				padding: 0.15rem 0.5rem;
				border-radius: 3px;
				border: 1px solid var(--color-foreground--10);
			}
		}
	}

	.entry[data-type='base'] {
		--action-color: var(--color-foreground--25);
		--action-line-color: var(--color-foreground--25);

		/* Non-interactive - fixed muted color, doesn't respond to states */
		--fg: var(--color-foreground--65);

		background: var(--vscode-list-inactiveSelectionBackground);
		cursor: default;

		/* Filled circle for base entry - mix with background for opaque fill */
		.entry-graph::after {
			border-color: transparent;
			background-color: color-mix(in srgb, var(--color-foreground) 25%, var(--vscode-editor-background));
			background-image: none;
		}

		gl-avatar-list::part(avatar) {
			opacity: var(--muted-opacity);
		}
		gl-avatar-list:hover::part(avatar) {
			opacity: 1;
		}
	}

	.entry[data-action='edit'],
	.entry[data-action='reword'] {
		--action-color: var(--action-edit-color);
		--action-line-color: var(--action-edit-color);

		--wa-form-control-background-color: var(--action-edit-bg);
		--wa-form-control-border-color: var(--action-edit-color);
		--wa-color-focus: var(--action-edit-color);
	}

	.entry[data-action='fixup'],
	.entry[data-action='squash'] {
		--action-color: var(--action-squash-color);
		--action-line-color: var(--action-squash-color);
		--action-text-decoration: line-through;

		--wa-form-control-background-color: var(--action-squash-bg);
		--wa-form-control-border-color: var(--action-squash-color);
		--wa-color-focus: var(--action-squash-color);

		/* Muted but responds to hover/focus/selected at reduced intensity */
		--fg-intensity: 60%;

		/* No circle for squash/fixup */
		.entry-graph::after {
			display: none;
		}

		gl-avatar-list::part(avatar) {
			opacity: var(--muted-opacity);
		}
		gl-avatar-list:hover::part(avatar) {
			opacity: 1;
		}
	}

	.entry[data-action='squash'] {
		.entry-message {
			text-decoration: none;
		}
	}

	.entry[data-action='drop'] {
		--action-color: var(--action-drop-color);
		--action-line-color: var(--action-drop-color);
		--action-text-decoration: line-through;

		--wa-form-control-background-color: var(--action-drop-bg);
		--wa-form-control-border-color: var(--action-drop-color);
		--wa-color-focus: var(--action-drop-color);

		/* More muted but responds to hover/focus/selected at reduced intensity */
		--fg-intensity: 45%;

		/* No circle for drop */
		.entry-graph::after {
			display: none;
		}

		gl-avatar-list::part(avatar) {
			opacity: var(--muted-opacity);
		}
		gl-avatar-list:hover::part(avatar) {
			opacity: 1;
		}
	}

	.entry[data-squashing] {
		--action-line-color: var(--action-squash-color);
	}

	.entry[data-squash-target] {
		--action-color: var(--action-squash-color);

		.entry-graph::after {
			border-color: var(--action-squash-color);
		}

		:host-context(.entries.ascending) & .entry-graph::before {
			border-image: linear-gradient(to bottom, var(--action-line-color) 50%, var(--action-squash-color) 50%) 1;
		}

		:host-context(.entries.descending) & .entry-graph::before {
			border-image: linear-gradient(to bottom, var(--action-squash-color) 50%, var(--action-line-color) 50%) 1;
		}
	}
`;
