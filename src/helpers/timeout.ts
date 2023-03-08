/**
 * Waits for the specified number of milliseconds using {@link setTimeout}
 */
export function timeout(milliseconds: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
