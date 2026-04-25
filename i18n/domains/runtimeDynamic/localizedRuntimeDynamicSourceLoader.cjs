const fs = require('fs');
const path = require('path');

const runtimeDynamicDomains = ['formatter', 'quickpicks'];

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

	for (const domain of runtimeDynamicDomains) {
		const localized = path.join(rootDir, '.work', 'i18n', 'runtime-dynamic-sources', locale, domain, relative);
		this.addDependency(localized);

		try {
			const localizedSource = fs.readFileSync(localized, 'utf8');
			callback(null, localizedSource);
			return;
		} catch {}
	}

	callback(null, source);
};
