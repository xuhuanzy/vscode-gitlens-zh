import { env } from 'vscode';
import { debug } from '@gitlens/utils/decorators/log.js';
import type { Container } from '../../container.js';
import { executeCommand } from '../../system/-webview/command.js';
import { createCommandDecorator } from '../../system/decorators/command.js';
import { getFolderUriFromContext } from './commitDetailsWebview.utils.js';
import type { DetailsFolderContextValue } from './protocol.js';

const { command, getCommands } = createCommandDecorator<string>();
export { getCommands as getDetailsFolderCommands };

/**
 * File-command IDs that ALSO apply to folder rows. When the menu fires one of these on a folder
 * context, route to the named method on {@link DetailsFolderCommands} instead of running the file
 * handler (which would no-op on a folder lookup).
 */
export const sharedDetailsFolderCommandRoutes: Readonly<Record<string, 'copy' | 'copyRelativePath'>> = {
	'gitlens.views.copy:': 'copy',
	'gitlens.copyRelativePathToClipboard:': 'copyRelativePath',
};

export class DetailsFolderCommands {
	constructor(private readonly container: Container) {}

	@command('gitlens.openFolderHistory:')
	@debug()
	openFolderHistory(folder: DetailsFolderContextValue): void {
		void executeCommand('gitlens.openFolderHistory', getFolderUriFromContext(this.container, folder));
	}

	@command('gitlens.openFolderHistoryInGraph:')
	@debug()
	openFolderHistoryInGraph(folder: DetailsFolderContextValue): void {
		void executeCommand('gitlens.openFolderHistoryInGraph', getFolderUriFromContext(this.container, folder));
	}

	@command('gitlens.visualizeHistory.folder:')
	@debug()
	visualizeFolderHistory(folder: DetailsFolderContextValue): void {
		void executeCommand(
			'gitlens.visualizeHistory.folder:explorer',
			getFolderUriFromContext(this.container, folder),
		);
	}

	// Copy / Copy Relative Path are intentionally undecorated — their VS Code command IDs
	// (`gitlens.views.copy:<scope>`, `gitlens.copyRelativePathToClipboard:<scope>`) are already
	// registered against `DetailsFileCommands`. The shared file-command handler routes to these
	// methods when the context is a folder so we don't double-register.

	@debug()
	copy(folder: DetailsFolderContextValue): void {
		void env.clipboard.writeText(getFolderUriFromContext(this.container, folder).fsPath);
	}

	@debug()
	copyRelativePath(folder: DetailsFolderContextValue): void {
		void env.clipboard.writeText(folder.path);
	}
}
