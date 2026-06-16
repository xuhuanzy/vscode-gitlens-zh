import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Proxies VS Code's native context-menu integration across shadow-DOM boundaries.
 *
 * VS Code's webview library reads `data-vscode-context` by walking the document tree, which
 * skips shadow content. When a `contextmenu` event bubbles out of a shadow root (composed:
 * true), this controller copies the originating element's `data-vscode-context` onto the host
 * — which sits in light DOM — so the menu can resolve. The attribute is cleared shortly after,
 * so it never leaks across distinct context-menu invocations.
 */
export class ContextMenuProxyController implements ReactiveController {
	private _host: ReactiveControllerHost & HTMLElement;

	constructor(host: ReactiveControllerHost & HTMLElement) {
		this._host = host;
		host.addController(this);
	}

	hostConnected(): void {
		this._host.addEventListener('contextmenu', this._onContextMenu);
	}

	hostDisconnected(): void {
		this._host.removeEventListener('contextmenu', this._onContextMenu);
	}

	private _onContextMenu = (e: MouseEvent): void => {
		const source = e.composedPath().find(el => el instanceof HTMLElement && el.dataset.vscodeContext != null) as
			| HTMLElement
			| undefined;
		if (source == null || source === this._host) return;

		this._host.dataset.vscodeContext = source.dataset.vscodeContext;
		setTimeout(() => {
			delete this._host.dataset.vscodeContext;
		}, 100);
	};
}
