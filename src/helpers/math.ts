export function lerp(start: number, end: number, t: number) {
	t = clamp(t, 0, 1);
	return start * (1 - t) + end * t;
}

/**
 * Returns a number whose value is limited to the given range.
 *
 * Example: limit the output of this computation to between 0 and 255
 * (x * 255).clamp(0, 255)
 *
 * @param {Number} min The lower boundary of the output range
 * @param {Number} max The upper boundary of the output range
 * @returns A number in the range [min, max]
 * @type Number
 */
export function clamp(num: number, min: number, max: number) {
	if (min > max) {
		const temp = min;
		min = max;
		max = temp;
	}
	return Math.min(Math.max(num, min), max);
}

export function pickRandomFromArray<T>(array: ArrayLike<T>): T {
	return array[Math.floor(Math.random() * array.length)];
}
