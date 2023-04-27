/**
 * Serialize an object to be persisted to a one-line string
 * Accepted primitive types: Number, String, Boolean, Date, null
 * Accepted secondary types: Objects, Arrays
 */
export declare function serialize<T>(obj: T, ignoreCheckKey?: boolean): string;
/**
 * From a one-line representation of an object generate by the serialize function
 * Return the object itself
 */
export declare function deserialize(rawData: string): any;
