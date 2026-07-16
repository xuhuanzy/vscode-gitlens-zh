import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["i18n/**/__tests__/**/*.test.mts", "scripts/__tests__/**/*.test.mts"],
		tags: [{ name: "upstream", description: "Tests that create and manage local upstream repositories." }],
	},
});
