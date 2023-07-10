import { EventEmitter } from "events";
import { SerialPort } from "serialport";

import { timeout } from "./helpers/timeout.js";
import { arraysEqual } from "./helpers/arrays.js";
import { EnttecMessageLables } from "./EnttecMessageLabels.js";

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
export class EnttecUsbMk2Pro extends EventEmitter {
	private serialport: SerialPort;
	private _mode: "send" | "receive";
	public get mode(): "send" | "receive" {
		return this._mode;
	}
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
		this._mode = "send";
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
	 * Initializes the device connection. If {@link retry_connection_timeout}
	 */
	public async init() {
		/** Exit this init if another init successfully connected */
		let early_exit = false;
		await new Promise<void>((resolve, reject) => {
			if (this.serialport.isOpen) {
				early_exit = true;
			} else {
				this.serialport.open(async (err) => {
					if (err) {
						console.error(err);
						if (Number.isFinite(this.retry_connection_timeout)) {
							console.warn(
								`EnttecProUSB::init: Could not connect to ${this.serialport.path}. Retrying...`,
							);
							await timeout(this.retry_connection_timeout!);
							await this.init();
						} else {
							console.warn(
								`EnttecProUSB::init: Could not connect to ${this.serialport.path}. Not retrying`,
							);
							reject(err);
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

		await this.sendPacket(EnttecMessageLables.SET_API_KEY, api_key_buffer.buffer);
		await this.sendPacket(
			EnttecMessageLables.SET_PORT_ASSIGNMENT,
			new Uint8Array([
				1, // Port 1 enabled for DMX and RDM
				1, // Port 2 enabled for DMX and RDM
			]),
		);
	}

	public close() {
		return new Promise<void>((resolve, reject) => {
			this.serialport.close((err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	/**
	 * Listen incoming data from the serial port
	 */
	protected startSerialPortListener() {
		// console.log("starting listener");
		this.serialport.on("data", (raw_data) => {
			const messageType = raw_data[1];
			switch (messageType) {
				case EnttecMessageLables.GET_WIDGET_PARAMS_REPLY:
					this.handleIncomingParamsReply(raw_data);
					break;
				case EnttecMessageLables.RECEIVE_DMX_PORT1:
					this.handleIncomingDmxPacket(raw_data);
					break;
			}
		});

		this.serialport.on("error", function (err) {
			console.error(err);
		});
	}

	protected handleIncomingParamsReply(raw_data: any) {
		console.debug("params received", raw_data);
	}

	/**
	 * Store the last received dmx data values and
	 * emit the packet as a `dmxdata event.
	 * @param raw_data
	 * @private
	 */
	protected handleIncomingDmxPacket(raw_data: number[] | ArrayBuffer | Buffer) {
		const new_data = new Uint8ClampedArray(raw_data.slice(6));

		// Ignore if the data hasn't changed
		if (arraysEqual(new_data, this.received_data)) {
			return;
		}
		this.received_data.set(new_data);
		this.emit("dmxdata", this.received_data);
	}

	/**
	 * Writes a buffer to the serial port,
	 * draining after
	 * @param buffer Data to write
	 */
	protected write(buffer: ArrayBuffer | Buffer) {
		return new Promise<void>((resolve, reject) => {
			this.serialport.write(Buffer.from(buffer), (err) => {
				this.serialport.drain();
				if (err) {
					this.emit("error", err);
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
	 * @param data The message payload.
	 * @returns  A promise indicating when the data has been sent.
	 */
	protected sendPacket(label: EnttecMessageLables, data: ArrayBuffer | ArrayLike<number>) {
		const byte_length = data instanceof ArrayBuffer ? data.byteLength : data.length;
		const buffer = new Uint8Array(byte_length + 5);
		const data_view = new DataView(buffer.buffer);

		data_view.setUint8(0, EnttecMessageLables.DMX_START_CODE);
		data_view.setUint8(1, label);
		data_view.setUint16(2, byte_length, true);
		buffer.set(new Uint8Array(data), 4);
		data_view.setUint8(buffer.byteLength - 1, EnttecMessageLables.DMX_END_CODE); // usbpro packet end marker

		return this.write(buffer);
	}

	/**
	 * Send DMX data to a port on the MK2
	 * @param dmx_data - Array of numbers of length 1-512 containing the DMX data.
	 * DMX Address 1 is Index 1.
	 * @param port - Zero based porn number to send the data to
	 */
	public async setAll(port: 0 | 1, dmx_data: Uint8ClampedArray | Uint8Array | number[]) {
		// for whatever-reason, dmx-transmission has to start with a zero-byte.
		dmx_data[0] = 0;
		const label = [EnttecMessageLables.SEND_DMX_PORT1, EnttecMessageLables.SEND_DMX_PORT2][port];
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

	public getValue(port: 0 | 1, address: number) {
		switch (port) {
			case 0:
				return this.addresses_port1[address];
			case 1:
				return this.addresses_port2[address];
		}
	}

	public getAll(port: 0 | 1) {
		return new Uint8ClampedArray(port ? this.addresses_port2 : this.addresses_port2);
	}

	public set(port: 0 | 1, address: number, value: number) {
		const data = this.getAll(port);
		data[address] = value;
		return this.setAll(port, data);
	}

	/**
	 * Request the current config & status information
	 *
	 * @todo
	 */
	protected async getDeviceInfo() {
		this.serialport.drain();
		await this.sendPacket(EnttecMessageLables.GET_WIDGET_PARAMS, Buffer.from([0, 0]));
	}

	/**
	 * Set the DMX device to input _mode
	 */
	public async startDmxRead() {
		this._mode = "receive";
		this.serialport.drain();
		await this.sendPacket(EnttecMessageLables.RECEIVE_DMX_PORT1, Buffer.from([0, 0]));
		await this.sendPacket(EnttecMessageLables.RECEIVE_DMX_ON_CHANGE, Buffer.from([0, 0]));
	}
}
