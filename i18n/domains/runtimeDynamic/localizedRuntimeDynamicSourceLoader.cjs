const fs = require('fs');
const path = require('path');

/**
 * @this {import('webpack').LoaderContext<{ readonly rootDir: string; readonly locale: string }>}
 * @param {string} source
 * @returns {void}
 */
module.exports = function localizedRuntimeDynamicSourceLoader(source) {
	const callback = this.async();
	const options = this.getOptions();
	const rootDir = options.rootDir;
	const locale = options.locale;
	const relative = path.relative(rootDir, path.normalize(this.resourcePath));

	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		callback(null, source);
		return;
	}

	const localized = path.join(rootDir, '.work', 'i18n', 'generated', locale, relative);
	this.addDependency(localized);

	try {
		const localizedSource = fs.readFileSync(localized, 'utf8');
		callback(null, localizedSource);
		return;
	} catch {}

	callback(null, source);
};
