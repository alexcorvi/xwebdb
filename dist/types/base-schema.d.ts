import { RecursivePartial } from "./common";
/**
 * Base model: of which all documents extend (Main documents & Sub-documents)
*/
declare class BaseModel {
    /**
     * Use this method to create a new document before insertion/update into the database
     * This is where the actual mapping of pure JS object values get mapped into the model
     * It models the document and all of its sub-documents even if they are in an array
    */
    static new<T extends BaseModel>(this: new () => T, data?: RecursivePartial<T>): T;
    /**
     * Strips default values from the model,
     * so it can be written to the persistence layer with the least amount of space
     * and it can be sent over the network with the least amount of size
    */
    _stripDefaults?<T extends BaseModel>(this: T): T;
}
/**
 * Main document in the database extends this class:
 * A. Gets an ID
 * B. Gets timestamp data if the options is used in the database configuration
 * C. gets Model.new() and model._stripDefaults() methods
*/
export declare class Doc extends BaseModel {
    _id: string;
    _rev?: string;
    $$deleted?: true;
    updatedAt?: Date;
    createdAt?: Date;
}
/**
 * Sub-documents extends this class:
 * gets Model.new() and model._stripDefaults() methods
*/
export declare class SubDoc extends BaseModel {
}
/**
 * Use this function to map sub-document inside main documents
 * It does nothing other than marking the value as sub-document
 * and setting a default value for it
*/
declare function mapSubModel<T extends typeof SubDoc>(ctr: T, def: InstanceType<T>): InstanceType<T>;
declare function mapSubModel<T extends typeof SubDoc>(ctr: T, def: Array<InstanceType<T>>): Array<InstanceType<T>>;
export { mapSubModel };
