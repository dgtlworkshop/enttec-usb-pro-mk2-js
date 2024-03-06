import { EventEmitter } from "node:events";
import type TypedEmitter from "typed-emitter";
import type { EventMap } from "typed-emitter";

/**
 * Typed {@link EventEmitter} Hack
 * @see https://github.com/andywer/typed-emitter/issues/43#issuecomment-1910036386
 */
export class TEventEmitter<T extends EventMap> extends (EventEmitter as {
	new <T extends EventMap>(): TypedEmitter<T>;
})<T> {}
