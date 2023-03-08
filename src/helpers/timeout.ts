/**
 * This should only be used when a task must run in real time. When tasks are running within an animation, use `pixi-timeout` which utilizes the animation timer.
 */
export function timeout(milliseconds: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
