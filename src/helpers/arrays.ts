export function arraysEqual<T>(lhs: ArrayLike<T>, rhs: ArrayLike<T>) {
	if (lhs.length !== rhs.length) return false;
	for (let index = 0; index < lhs.length; index++) {
		if (lhs[index] !== rhs[index]) return false;
	}
	return true;
}
