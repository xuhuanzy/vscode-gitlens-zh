const mode = process.argv[2] ?? 'legacy-contributions';

console.error(
	[
		`'${mode}' 在当前分支已被显式阻止。`,
		'这个分支的 manifest 本地化由 ./i18n/package 工作流维护，而不是由 contributions 生成链维护。',
		'请改用以下命令：',
		'  pnpm run sync:package-nls',
		'  pnpm run report:package-nls:zh-cn:pending',
		'  pnpm run promote:package-nls:zh-cn',
		'  pnpm run generate:package-nls',
	].join('\n'),
);

process.exitCode = 1;
