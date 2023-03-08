import { EnttecUsbMk2Pro } from "../index.js";

console.debug("Finding devices....");
const enttec = new EnttecUsbMk2Pro((await EnttecUsbMk2Pro.FindDevice())[0]);

console.debug("Connecting....");
await enttec.init();

let port_1 = enttec.getAll(0);
port_1 = port_1.fill(255);

console.debug("Sending....");
await enttec.setAll(0, port_1);

console.debug("...full white sent");
await enttec.close();
console.debug("...device closed.");
