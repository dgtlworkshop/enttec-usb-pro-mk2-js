import { EnttecUsbMk2Pro } from "../EnttecProUSB.js";

export async function connect(options: { path?: string; "device-num"?: number } = {}) {
	let path: string;
	if (options.path) {
		path = options.path;
	} else {
		const devices = await EnttecUsbMk2Pro.FindDevice();
		let device_num = options["device-num"] ?? 0;
		if (devices.length === 0) {
			throw `Couldn't find any Enttec devices`;
		} else if (devices.length > device_num + 1) {
			throw `Couldn't find the device at index ${device_num}, only ${devices.length} devices found`;
		}
		path = devices[device_num];
	}
	console.info("Connecting to device", path);
	const enttec = new EnttecUsbMk2Pro(path);
	await enttec.init();
	return enttec;
}
