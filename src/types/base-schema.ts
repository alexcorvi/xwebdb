import * as customUtils from "../core/customUtils";
import { RecursivePartial } from "./common";


/**
 * Base model: of which all documents extend (Main documents & Sub-documents)
*/
class BaseModel {
	/**
	 * Use this method to create a new document before insertion/update into the database
	 * This is where the actual mapping of pure JS object values get mapped into the model
	 * It models the document and all of its sub-documents even if they are in an array 
	*/
	static new<T extends BaseModel>(this: new () => T, data?: RecursivePartial<T>): T {
		const instance = new this();
		if (typeof data !== "object" || data === null) {
			return instance;
		}
		const keys = Object.keys({ ...instance, ...data });
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] as keyof T;
			let insVal: any = instance[key];
			let dataVal = (data as any)[key];
			if (insVal && insVal["_$SHOULD_MAP$_"]) {
				if (dataVal === undefined) {
					instance[key] = insVal["def"];
				} else if (Array.isArray(dataVal)) {
					(instance[key] as any) = dataVal.map((x) => insVal.ctr.new(x));
				} else {
					instance[key] = insVal.ctr.new(dataVal);
				}
			} else {
				instance[key] = dataVal === undefined ? insVal : dataVal;
			}
		}
		return instance;
	}
	/**
	 * Strips default values from the model,
	 * so it can be written to the persistence layer with the least amount of space
	 * and it can be sent over the network with the least amount of size
	*/
	_stripDefaults?<T extends BaseModel>(this: T): T {
		// maintain a cache of defaults
		if (!(this as any).constructor._$def) {
			(this as any).constructor._$def = (this as any).constructor.new({});
		}
		let def = (this as any).constructor._$def;
		const newData: any = {};
		for (const [key, oldV] of Object.entries(this)) {
			const defV = def[key as keyof T];
			// handling arrays of sub-documents
			if (Array.isArray(oldV) && oldV[0] && oldV[0]._stripDefaults) {
				newData[key] = oldV.map((sub) => sub._stripDefaults());
				if (newData[key].length === 0) delete newData[key]; // disregard empty arrays
			}
			// handling direct child sub-document
			else if (
				typeof oldV === "object" &&
				oldV !== null &&
				(oldV as any)._stripDefaults
			) {
				newData[key] = (oldV as any)._stripDefaults();
				if (Object.keys(newData[key]).length === 0) delete newData[key]; // disregard empty objects
			}
			// handling non-sub-document values
			// we're converting to a string to eliminate non-primitive
			else if (JSON.stringify(defV) !== JSON.stringify(oldV)) newData[key] = oldV;
		}
		return newData;
	}
}

/**
 * Main document in the database extends this class:
 * A. Gets an ID
 * B. Gets timestamp data if the options is used in the database configuration
 * C. gets Model.new() and model._stripDefaults() methods
*/
export class Doc extends BaseModel {
	_id: string = customUtils.uid();
	_rev?: string;
	$$deleted?: true;
	updatedAt?: Date;
	createdAt?: Date;
}

/**
 * Sub-documents extends this class:
 * gets Model.new() and model._stripDefaults() methods
*/
export class SubDoc extends BaseModel {}


/**
 * Use this function to map sub-document inside main documents
 * It does nothing other than marking the value as sub-document
 * and setting a default value for it
*/
function mapSubModel<T extends typeof SubDoc>(ctr: T, def: InstanceType<T>): InstanceType<T>;
function mapSubModel<T extends typeof SubDoc>(
	ctr: T,
	def: Array<InstanceType<T>>
): Array<InstanceType<T>>;
function mapSubModel<T extends typeof SubDoc>(
	ctr: T,
	def: InstanceType<T> | Array<InstanceType<T>>
): InstanceType<T> | Array<InstanceType<T>> {
	return {
		_$SHOULD_MAP$_: true,
		def,
		ctr,
	} as any;
}

export { mapSubModel };
