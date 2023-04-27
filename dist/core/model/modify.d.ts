import { Doc } from "../../types";
export declare const modifiersKeys: string[];
/**
 * Modify a DB object according to an update query
 */
export declare function modify<G extends Doc, C extends typeof Doc>(obj: G, updateQuery: any, model: C): G;
