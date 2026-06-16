export type VirtualFsErrorReason = 'provider-missing' | 'parent-missing';

const virtualFsErrorNamePrefix = 'VirtualFsError:';

/** Thrown by {@link VirtualFileSystemService} when a session/parent cannot be resolved.
 *  Carries a discrete `reason` for callers to categorize without parsing the message.
 *
 *  The reason is encoded into `error.name` (e.g. `VirtualFsError:provider-missing`) so it survives
 *  the host → webview RPC boundary, where supertalk's `serializeError` preserves `name`/`message`
 *  but strips the prototype chain and custom properties. Use {@link getVirtualFsErrorReason} on the
 *  receiving side instead of `instanceof`. */
export class VirtualFsError extends Error {
	constructor(
		readonly reason: VirtualFsErrorReason,
		message: string,
	) {
		super(message);
		this.name = `${virtualFsErrorNamePrefix}${reason}`;
	}
}

/** Returns the {@link VirtualFsErrorReason} for any error originating from {@link VirtualFsError},
 *  including instances reconstructed across an RPC boundary (where `instanceof` fails). */
export function getVirtualFsErrorReason(error: unknown): VirtualFsErrorReason | undefined {
	if (error instanceof VirtualFsError) return error.reason;
	if (error instanceof Error && error.name.startsWith(virtualFsErrorNamePrefix)) {
		return error.name.slice(virtualFsErrorNamePrefix.length) as VirtualFsErrorReason;
	}
	return undefined;
}
