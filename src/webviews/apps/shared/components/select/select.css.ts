import { css } from 'lit';

export const selectStyles = css`
	:host {
		display: inline-block;
		width: 100%;
	}

	gl-select wa-select {
		width: 100%;
	}

	/* Combobox (the visible select control). Use the WA tokens with VS Code fallbacks
	   so consumers can override --wa-form-control-* on the gl-select host (e.g. for
	   action-state colorization in the rebase editor) and the values cascade in. */
	wa-select::part(combobox) {
		background-color: var(--wa-form-control-background-color, var(--vscode-dropdown-background));
		border: var(--wa-form-control-border-width, 1px) var(--wa-form-control-border-style, solid)
			var(--wa-form-control-border-color, var(--vscode-dropdown-border));
		border-radius: var(--wa-form-control-border-radius, 3px);
		color: var(--wa-form-control-value-color, var(--vscode-dropdown-foreground));
		font-family: var(--vscode-font-family);
		font-size: inherit;
		line-height: 1.35;
		padding: 1px 4px;
		min-height: auto;
	}

	wa-select::part(display-input) {
		field-sizing: content;
		color: var(--wa-form-control-value-color, var(--vscode-dropdown-foreground));
		font-family: var(--vscode-font-family);
		font-size: inherit;
	}

	wa-select::part(expand-icon) {
		margin-inline-start: 0.4rem;
	}

	wa-select:focus-within::part(combobox) {
		outline: 1px solid var(--vscode-focusBorder);
		outline-offset: -1px;
	}

	wa-select[disabled]::part(combobox) {
		background-color: var(--vscode-input-background);
		color: var(--vscode-disabledForeground);
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Listbox (dropdown menu) */
	wa-select::part(listbox) {
		background-color: var(--vscode-dropdown-background);
		border: 1px solid var(--vscode-dropdown-border);
		border-radius: 3px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		padding: 4px 0;
	}

	/* VS Code-style scrollbar for the listbox (we can't apply class="scrollable",
	   so we style via ::part chained with ::-webkit-scrollbar) */
	wa-select::part(listbox)::-webkit-scrollbar {
		width: 10px;
		height: 10px;
	}
	wa-select::part(listbox)::-webkit-scrollbar-corner {
		background-color: transparent;
	}
	wa-select::part(listbox)::-webkit-scrollbar-thumb {
		background-color: var(--vscode-scrollbarSlider-background);
	}
	wa-select::part(listbox)::-webkit-scrollbar-thumb:hover {
		background-color: var(--vscode-scrollbarSlider-hoverBackground);
	}
	wa-select::part(listbox)::-webkit-scrollbar-thumb:active {
		background-color: var(--vscode-scrollbarSlider-activeBackground);
	}

	/* Options — wa-option has no "base" part; the host element IS the styled box.
	   wa-options live inside gl-select's shadow root, so consumer CSS targeting them
	   from outside (e.g. .action-select wa-option { ... }) can't reach them. We expose
	   CSS variables here that consumers override on the gl-select host. */
	wa-option {
		background-color: transparent;
		color: var(--vscode-dropdown-foreground);
		font-family: var(--vscode-font-family);
		font-size: inherit;
		padding: var(--gl-select-option-padding, 4px 8px);
		cursor: pointer;
	}

	wa-option:hover {
		background-color: var(--gl-select-option-hover-bg, var(--vscode-list-hoverBackground));
		color: var(--gl-select-option-hover-color, var(--vscode-list-hoverForeground));
	}

	wa-option:focus {
		background-color: var(--gl-select-option-focus-bg, var(--vscode-list-activeSelectionBackground));
		color: var(--gl-select-option-focus-color, var(--vscode-list-activeSelectionForeground));
	}

	wa-option[aria-selected='true'],
	wa-option[selected] {
		background-color: var(--gl-select-option-selected-bg, var(--vscode-list-activeSelectionBackground));
		color: var(--gl-select-option-selected-color, var(--vscode-list-activeSelectionForeground));
	}

	wa-option[disabled] {
		color: var(--vscode-disabledForeground);
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Hide the WA built-in checked-icon — we don't use it */
	wa-option::part(checked-icon) {
		display: none;
	}
`;
