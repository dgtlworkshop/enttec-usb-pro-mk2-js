import { program } from "commander";

import type { EnttecUsbMk2Pro } from "../src/EnttecProUSB.js";
import { connect } from "../src/helpers/connect.js";
import { timeout } from "../src/helpers/timeout.js";

program
	.name("enttec-usb-pro-mk2 cycle-addresses")
	.description("Cycles DMX values")
	.option("-d --delay", "Delay in ms between changes", "1000")
	.action(async (options) => {
		let enttec: EnttecUsbMk2Pro;
		try {
			enttec = await connect();
		} catch (error) {
			program.error(String(error));
		}
		const buffer = enttec.getAll(0);
		const delay = parseInt(options.delay) ?? 1000;

		console.info("Starting with delay of", delay, "ms");

		while (true) {
			for (let address = 1; address < buffer.length; address++) {
				console.info("Setting", address, "to", 255);
				buffer[address] = 255;
				await enttec.setAll(0, buffer);
				await timeout(delay);
				console.info("Setting", address, "to", 0);
				buffer[address] = 0;
				await enttec.setAll(0, buffer);
			}
		}
	});

program.parse();
