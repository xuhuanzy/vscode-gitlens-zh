import path from "node:path";

export interface GeneratedMirrorClaim {
	readonly owner: string;
	readonly relativePath: string;
}

export function assertUniqueGeneratedMirrorPaths(claims: readonly GeneratedMirrorClaim[]): void {
	const ownersByPath = new Map<string, string>();
	for (const claim of claims) {
		const relativePath = claim.relativePath.replaceAll("\\", "/").replace(/^\.\//u, "");
		if (relativePath.length === 0 || relativePath.startsWith("../") || path.posix.isAbsolute(relativePath)) {
			throw new Error(`Invalid generated i18n mirror path: ${claim.relativePath}`);
		}
		const existingOwner = ownersByPath.get(relativePath);
		if (existingOwner != null) {
			throw new Error(
				`Generated i18n mirror path collision: ${relativePath} is claimed by ${existingOwner} and ${claim.owner}`,
			);
		}

		ownersByPath.set(relativePath, claim.owner);
	}
}
