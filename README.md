# Enttec DMX USB Pro MK2 for NodeJS

Uses the Node [`serialport`](https://serialport.io/) package to provide an API to send and receive DMX using an [Enttec DMX USB Pro MK2](https://www.enttec.com/product/uncategorized/dmx-usb-pro-interface/). Likely also works with the [Enttec DMX USB Pro](https://www.enttec.com/product/dmx-usb-interfaces/dmx-usb-pro-professional-1u-usb-to-dmx512-converter/), though only port 1 will function.

```bash
echo "@dgtlworkshop:registry=https://npm.pkg.github.com" >> .npmrc
npm install @dgtlworkshop/enttec-usb-pro-mk2
```

## Usage

```js
import { EnttecUsbMk2Pro } from "@dgtlworkshop/enttec-usb-pro-mk2";

// Find all the valid devices connected to the system
const devices = await EnttecUsbMk2Pro.FindDevice();

// Setup the first device
const enttec = new EnttecUsbMk2Pro(devices[0]);
await enttec.init();

// Get the data buffer from the first DMX output port
const port = 0;
const address_space = enttec.getAll(port);

// Set DMX address 1 to value 255
address_space[1] = 255;

// write the address values back
await enttec.setAll(port, address_space);

// close the device
await enttec.close();
```

## Development
