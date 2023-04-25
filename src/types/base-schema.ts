import * as customUtils from "../core/customUtils";
import { RecursivePartial, NFGP, NFP } from "./common";

class BaseModel {
	static new<T extends object>(
		this: new () => T,
		data: RecursivePartial<NFGP<T>>
	): T {
		const instance = new this();
		const keys = Object.keys({ ...instance, ...data });
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] as keyof T;
			let insVal: any = instance[key];
			let dataVal = (data as any)[key];
			if (insVal && insVal["_$SHOULD_MAP$_"]) {
				if (dataVal === undefined) {
					instance[key] = insVal["_$DEFAULT_VALUE$_"];
				} else if (Array.isArray(dataVal)) {
					(instance[key] as any) = dataVal.map((x) => insVal.new(x));
				} else {
					instance[key] = insVal.new(dataVal);
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
	static stripDefaults<T extends object>(
		this: new () => T,
		existingData: T
	): T {
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

function mapSubModel<M extends typeof SubDoc>(c: M, defaultValue: InstanceType<M>): InstanceType<M>;
function mapSubModel<T extends typeof SubDoc>(c: T, defaultValue: Array<InstanceType<T>>): Array<InstanceType<T>>;
function mapSubModel<M extends typeof SubDoc>(c: M, defaultValue: InstanceType<M> | Array<InstanceType<M>>): InstanceType<M> | Array<InstanceType<M>> {
  (c as any)['_$SHOULD_MAP$_'] = true;
  (c as any)['_$DEFAULT_VALUE$_'] = defaultValue;
  return c as any;
}

export { mapSubModel };
