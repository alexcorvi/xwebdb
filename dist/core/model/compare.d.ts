import { Value } from "./common";
/**
 * compareNSB works for numbers, strings and booleans (for when both values have the same type)
 */
export type NSB = number | string | boolean;
export declare function compareNSB<T extends NSB>(a: T, b: T): 0 | 1 | -1;
export declare function compareArrays(a: Value[], b: Value[]): 0 | 1 | -1;
/**
 * Compare anything
 * type hierarchy is: undefined, null, number, strings, boolean, dates, arrays, objects
 * Return -1 if a < b, 1 if a > b and 0 if a === b
 * (note that equality here is NOT the same as defined in areThingsEqual!)
 */
export declare function compare(a: any, b: any): 0 | 1 | -1;
