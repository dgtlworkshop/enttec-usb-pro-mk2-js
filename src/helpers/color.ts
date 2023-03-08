import RGB from "../interfaces/RGB.js";

/**
 *
 * @param start Minimum color
 * @param end Maximum Color
 * @param t 0...1
 * @returns Interpolated color
 */
export function lerpRGB(start: RGB, end: RGB, t: number): RGB {
	return {
		r: start.r + (end.r - start.r) * t,
		g: start.g + (end.g - start.g) * t,
		b: start.b + (end.b - start.b) * t,
	};
}
