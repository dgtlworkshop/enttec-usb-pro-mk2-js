import { connect } from "../src/helpers/connect.js";
import { timeout } from "../src/helpers/timeout.js";

const enttec = await connect();

const buffer = enttec.getAll(0);

while (true) {
	for (let address = 0; address < buffer.length; address++) {
		console.info("Setting", address, "to", 255);
		buffer[address] = 255;
		await enttec.setAll(0, buffer);
		await timeout(1000);
		console.info("Setting", address, "to", 0);
		await enttec.setAll(0, buffer);
	}
}
