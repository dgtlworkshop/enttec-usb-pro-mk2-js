export function getLength(data: IncomingDataType | ArrayLike<unknown>) {
	return data instanceof ArrayBuffer ? data.byteLength : data.length;
}

export type IncomingDataType = Buffer | ArrayBuffer;
