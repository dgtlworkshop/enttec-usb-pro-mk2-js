import { EventEmitter } from "node:events";
import type { EventMap, TypedEventEmitter } from "./TypedEmitter.js";

/**
 * Typed {@link EventEmitter} Hack
 * @see https://github.com/andywer/typed-emitter/issues/43#issuecomment-1910036386
 */
export abstract class TEventEmitter<T extends EventMap> extends (EventEmitter as {
	new <T extends EventMap>(): TypedEventEmitter<T>;
})<T> {}
