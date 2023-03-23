import { program, Option, Command } from "commander";
import { EnttecUsbMk2Pro } from "./src/EnttecProUSB.js";

program
	.name("enttec-usb-pro-mk2")
	.description("CLI to control an Enttec USB Pro Mk2 DMX Controller over USB Serial");

program
	.command("detect")
	.description("Detects Enttec devices connected")
	.option("-a, --all", "List all USB serial devices", false)
	.action(async (options) => {
		if (options.all) {
			const { SerialPort } = await import("serialport");
			const devices = await SerialPort.list();
			console.info(devices);
		} else {
			const devices = await EnttecUsbMk2Pro.FindDevice();
			console.info(devices);
		}
	});

async function connect(options: { path?: string; "device-num"?: number }) {
	let path: string;
	if (options.path) {
		path = options.path;
	} else {
		const devices = await EnttecUsbMk2Pro.FindDevice();
		let device_num = options["device-num"] ?? 0;
		if (devices.length === 0) {
			program.error(`Couldn't find any Enttec devices`);
		} else if (devices.length > device_num + 1) {
			program.error(
				`Couldn't find the device at index ${device_num}, only ${devices.length} devices found`,
			);
		}
		path = devices[device_num];
	}
	console.info("Connecting to device", path);
	const enttec = new EnttecUsbMk2Pro(path);
	await enttec.init();
	return enttec;
}

program
	.command("set")
	.description("Connect to device and set DMX values, then quit")
	.addOption(
		new Option(
			"--device-num [index]",
			"If multiple Enttec devices, which device to use (indexed 0)",
		).default(0),
	)
	.addOption(
		new Option("-p, --path <devicepath>", "Manual path to Enttec Serial device")
			.default(0)
			.conflicts("device-num"),
	)
	.action(async (options) => {
		const device = await connect(options);
	});

program.parse();
