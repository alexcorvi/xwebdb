import { Doc } from "../../types";
export interface keyedObject<G = Value> {
    [key: string]: G;
}
export type PrimitiveValue = number | string | boolean | undefined | null | Date;
export type Value = Doc | keyedObject | Array<PrimitiveValue | keyedObject> | PrimitiveValue;
/**
 * Check a key throw an error if the key is non valid
 */
export declare function validateKey(key: string | number, v: Value): void;
/**
 * Check a DB object and throw an error if it's not valid
 * Works by applying the above checkKey function to all fields recursively
 */
export declare function validateObject(obj: Value): void;
/**
 * Tells if an object is a primitive type or a "real" object
 * Arrays are considered primitive
 */
export declare function isPrimitiveType(obj: Value): boolean;
export declare function isKeyedObject(obj: Value): obj is keyedObject;
/**
 * Deep copy a DB object
 * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
 * where the keys are valid, i.e. don't begin with $ and don't contain a dot
 */
export declare function clone<T>(obj: T, model: typeof Doc, strictKeys?: boolean): T;
export declare function dotNotation(obj: any, field: string | string[]): any;
export declare function equal<A, B>(a: A, b: B): boolean;
export declare function comparable<T, D>(a: T, b: D): boolean;
