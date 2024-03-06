import { Chrono, Equality } from "@dgtlworkshop/handyjs";
import { SerialPort } from "serialport";
import { PacketLengthParser } from "@serialport/parser-packet-length";
import { EnttecMessageLabels } from "./EnttecMessageLabels.js";
import { TEventEmitter } from "./TEventEmitter.js";
import { IncomingDataType, getLength } from "./helpers.js";

/**
 * API Documentation based on Enttec DMX USB PRO
 * @see https://cdn.enttec.com/pdf/assets/70304/70304_DMX_USB_PRO_API.pdf
 */

/**
 * @example
 * import { EnttecUsbMk2Pro } from "@dgtlworkshop/enttec-usb-pro-mk2";
 * // Find all the valid devices connected to the system
 * const devices = await EnttecUsbMk2Pro.FindDevice();
 *
 * // Setup the first device
 * const enttec = new EnttecUsbMk2Pro(devices[0]);
 * await enttec.init();
 *
 * // Get the data buffer from the first DMX output port
 * const port = 0;
 * const address_space = enttec.getAll(port);
 *
 * // Set DMX address 1 to value 255
 * address_space[1] = 255;
 *
 * // write the address values back
 * await enttec.setAll(port, address_space);
 *
 * // close the device
 * await enttec.close();
 */
export class EnttecUsbMk2Pro extends TEventEmitter<{
	error: (error: Error) => void;
	retrying: (error: Error) => void;
	close: () => void;
	end: () => void;
	params: (raw_data: Uint8Array) => void;
	dmx_data: (
		/** A `513` byte array of all the DMX data, starting at address `1` */
		current_data: Uint8ClampedArray,
	) => void;
}> {
	private readonly serialport: SerialPort;
	private readonly parser;
	// private _mode: "send" | "receive" = "send";
	// public get mode(): "send" | "receive" {
	// 	return this._mode;
	// }
	/** Is the SerialPort currently connected */
	public get isOpen(): boolean {
		return this.serialport.isOpen;
	}
	/**
	 * Automatically reconnect every {@link retry_connection_timeout} milliseconds if the enttec is disconnected. Disables reconnect if the number is undefined.
	 * @default 2000
	 */
	public retry_connection_timeout?: number;
	private readonly received_data = new Uint8ClampedArray(513);
	private readonly addresses_port1 = new Uint8ClampedArray(513);
	private readonly addresses_port2 = new Uint8ClampedArray(513);

	/**
	 * Creates, but does not start the device connection. To start the device, use {@link EnttecUsbMk2Pro.init}
	 * @param path Device Serial path from {@link EnttecUsbMk2Pro.FindDevice}
	 * @param options.retry_connection_timeout See {@link EnttecUsbMk2Pro.retry_connection_timeout}
	 */
	constructor(
		path: string,
		options: {
			/** See {@link EnttecUsbMk2Pro.retry_connection_timeout} */
			retry_connection_timeout?: number;
		} = {},
	) {
		super();
		this.serialport = new SerialPort({
			path,
			autoOpen: false,
			baudRate: 115200,
			dataBits: 8,
			stopBits: 2,
			parity: "none",
		});
		this.parser = this.serialport.pipe(
			new PacketLengthParser({
				delimiter: EnttecMessageLabels.DMX_START_CODE,
				packetOverhead: 5,
				lengthBytes: 2,
				lengthOffset: 2,
				maxLen: 650,
			}),
		);
		this.retry_connection_timeout = options.retry_connection_timeout ?? 2000;
	}

	/**
	 * Searches the host system for USB devices that match the VendorID/ProductID of the Enttec USB Pro Mk2
	 * @returns An array of USB device paths. One of which can be passed to the {@link EnttecUsbMk2Pro} constructor
	 * @example
	 *  // Find all the valid devices connected to the system
	 * const devices = await EnttecUsbMk2Pro.FindDevice();
	 *
	 * // Setup the first device
	 * const enttec = new EnttecUsbMk2Pro(devices[0]);
	 */
	static async FindDevice() {
		const all_devices = await SerialPort.list();
		const enttec_devices = all_devices
			.filter((this_device) => {
				return (
					this_device.vendorId?.toLowerCase() === "0403" &&
					this_device.productId?.toLowerCase() === "6001"
				);
			})
			.map((this_device) => {
				return this_device.path;
			});

		// if (enttec_devices.length === 0) {
		// 	console.debug(JSON.stringify(all_devices));
		// }
		return enttec_devices;
	}

	/**
	 * Initializes the device connection. If {@link retry_connection_timeout} is set, this will keep retrying
	 */
	public async init() {
		/** Exit this init if another init successfully connected */
		let early_exit = false;
		await new Promise<void>((resolve, reject) => {
			if (this.serialport.isOpen) {
				early_exit = true;
			} else {
				this.serialport.open(async (error) => {
					if (error) {
						if (this.retry_connection_timeout && Number.isFinite(this.retry_connection_timeout)) {
							this.emit("retrying", error);
							await Chrono.timeout(this.retry_connection_timeout!);
							await this.init();
						} else {
							this.emit("error", error);
							reject(error);
						}
						early_exit = true;
					}
					resolve();
				});
			}
		});

		if (early_exit) return;

		this.startSerialPortListener();

		const api_key_buffer = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT));
		api_key_buffer.setUint32(0, 0xe403a4c9, true); // Hardcoded Enttec API Key

		await this.sendPacket(EnttecMessageLabels.SET_API_KEY, api_key_buffer.buffer);
		await this.sendPacket(
			EnttecMessageLabels.SET_PORT_ASSIGNMENT,
			new Uint8Array([
				1, // Port 1 enabled for DMX and RDM
				1, // Port 2 enabled for DMX and RDM
			]),
		);
	}

	public close() {
		return new Promise<void>((resolve, reject) => {
			this.serialport.close((err) => {
				this.serialport.removeAllListeners();
				if (err) reject(err);
				else resolve();
			});
		});
	}

	/**
	 * Listen incoming data from the serial port
	 */
	protected startSerialPortListener() {
		// console.debug("starting listener");
		this.parser.on("data", (full_message: IncomingDataType) => {
			const data = new Uint8Array(full_message);
			const message_label = data[1];
			switch (message_label) {
				case EnttecMessageLabels.GET_WIDGET_PARAMS_REPLY:
					this.handleIncomingParamsReply(data);
					break;
				case EnttecMessageLabels.RECEIVE_DMX_PORT1:
					this.handleIncomingDmxPacket(data);
					break;
				default:
					this.emit("error", new Error("Unknown Enttec USB message", { cause: full_message }));
					break;
			}
		});

		this.serialport.on("close", () => this.emit("close"));
		this.serialport.on("end", () => this.emit("end"));
		this.serialport.on("error", (error) => this.emit("error", error));
	}

	protected handleIncomingParamsReply(full_message: Uint8Array) {
		this.emit("params", full_message);
	}

	/**
	 * Store the last received dmx data values and
	 * emit the packet as a `dmxdata event.
	 * @param full_message
	 * @private
	 */
	protected handleIncomingDmxPacket(full_message: Uint8Array) {
		const dmx_data = new Uint8ClampedArray(513);
		try {
			// Remove the last byte, add starting spacer byte
			dmx_data.set(full_message.slice(6, full_message.byteLength - 1), 1);

			// Ignore if the data hasn't changed
			if (Equality.arraysEqual(dmx_data, this.received_data)) {
				return;
			}
			this.received_data.set(dmx_data);
			this.emit("dmx_data", dmx_data);
		} catch (error) {
			this.emit("error", error instanceof Error ? error : new Error(String(error)));
		}
	}

	/**
	 * Writes a buffer to the serial port,
	 * draining after
	 * @param buffer Data to write
	 */
	protected write(buffer: ArrayBuffer | Buffer) {
		return new Promise<void>((resolve, reject) => {
			this.serialport.write(new Uint8Array(buffer), (error) => {
				this.serialport.drain();
				if (error) {
					this.emit("error", error);
					reject();
				} else {
					resolve();
				}
			});
		});
	}

	/**
	 * Sends a single packet to the usbpro.
	 * @param label The message label.
	 * @param payload The message payload.
	 * @returns  A promise indicating when the data has been sent.
	 */
	protected sendPacket(label: EnttecMessageLabels, payload: ArrayBuffer | Buffer | number[]) {
		const byte_length = getLength(payload);
		const buffer = new Uint8Array(byte_length + 5); // 5 = front header + end delineator
		const data_view = new DataView(buffer.buffer);

		data_view.setUint8(0, EnttecMessageLabels.DMX_START_CODE);
		data_view.setUint8(1, label);
		data_view.setUint16(2, byte_length, true);
		buffer.set(new Uint8Array(payload), 4);
		data_view.setUint8(buffer.byteLength - 1, EnttecMessageLabels.DMX_END_CODE); // usbpro packet end marker

		return this.write(buffer);
	}

	/**
	 * Send DMX data to a port on the MK2
	 * @param dmx_data - Array of numbers of length 1-512 containing the DMX data.
	 * DMX Address 1 is Index 1.
	 * @param port - Zero based porn number to send the data to
	 */
	public async setAll(port: 0 | 1, dmx_data: Uint8ClampedArray | Uint8Array | Buffer | number[]) {
		// for whatever-reason, dmx-transmission has to start with a zero-byte.
		dmx_data[0] = 0;
		const label = [EnttecMessageLabels.SEND_DMX_PORT1, EnttecMessageLabels.SEND_DMX_PORT2][port];
		switch (port) {
			case 0:
				this.addresses_port1.set(dmx_data);
				break;
			case 1:
				this.addresses_port2.set(dmx_data);
				break;
		}
		await this.sendPacket(label, dmx_data);
	}

	/** Gets the currently outputted DMX value for specified address */
	public getValue(port: 0 | 1, address: number): number {
		switch (port) {
			case 0:
				return this.addresses_port1[address];
			case 1:
				return this.addresses_port2[address];
		}
	}

	/** Gets the last read DMX value */
	public getReadValue(address: number) {
		return this.received_data[address];
	}
	/** Gets a copy of the last read DMX values */
	public getAllRead() {
		return new Uint8ClampedArray(this.received_data);
	}

	/** Gets the currently outputted DMX data for the selected port */
	public getAll(port: 0 | 1) {
		return new Uint8ClampedArray(port ? this.addresses_port2 : this.addresses_port2);
	}

	/** Sets a specific value for a specific address */
	public set(port: 0 | 1, address: number, value: number) {
		const data = this.getAll(port);
		data[address] = value;
		return this.setAll(port, data);
	}

	/**
	 * Request the current config & status information
	 * @todo No parsing implemented
	 */
	protected async getDeviceInfo() {
		this.serialport.drain();
		await this.sendPacket(EnttecMessageLabels.GET_WIDGET_PARAMS, new Uint8Array([0, 0]));
	}

	/**
	 * Tells the Enttec to start reading incoming DMX data from Port 1
	 */
	public async startDmxRead() {
		// this._mode = "receive";
		await new Promise((resolve) => this.serialport.drain(resolve));
		await this.sendPacket(EnttecMessageLabels.RECEIVE_DMX_PORT1, new Uint8Array([0, 0]));
		await this.sendPacket(EnttecMessageLabels.RECEIVE_DMX_ON_CHANGE, new Uint8Array([0, 0]));
	}
}
