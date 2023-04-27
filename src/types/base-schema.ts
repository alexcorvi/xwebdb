import * as customUtils from "../core/customUtils";
import { RecursivePartial, NFGP, NFP } from "./common";

class BaseModel {
	static new<T extends BaseModel>(this: new () => T, data?: RecursivePartial<NFGP<T>>): T {
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
}

export class Doc extends BaseModel {
	_id: string = customUtils.uid();
	updatedAt?: Date;
	createdAt?: Date;
	// move strip defaults to BaseModel?
	static stripDefaults<T extends object>(this: new () => T, existingData: T): T {
		const def = JSON.parse(JSON.stringify(new this()));
		const keys = Object.keys(def);
		const newData: any = {};
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] as keyof T;
			const defV = JSON.parse(JSON.stringify({ t: def[key] }));
			const oldV = JSON.parse(JSON.stringify({ t: existingData[key] }));
			if (defV !== oldV) newData[key] = existingData[key];
		}
		return newData;
	}
}
export class SubDoc extends BaseModel {}

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
