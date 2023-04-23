import * as customUtils from "../core/customUtils";
export class BaseModel {
	_id: string = customUtils.uid();
	updatedAt?: Date;
	createdAt?: Date;
	static new<T>(this: new () => T, data: Partial<NFP<T>>): T {
		const instance = new this();
		const keys = Object.keys(data);
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] as keyof T;
			(instance as any)[key] = (data as any)[key];
		}
		return instance;
	}
	static stripDefaults<T extends object>(this: new () => T, existingData: T): T {
		const defaultInstance = JSON.parse(JSON.stringify(new this()));
		const keys = Object.keys(defaultInstance);
		const newData: any = {};
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] as keyof T;
			const defaultInstanceValue = JSON.parse(JSON.stringify({t:defaultInstance[key]}));
			const existingDataValue = JSON.parse(JSON.stringify({t:existingData[key]}));
			if(defaultInstanceValue !== existingDataValue) newData[key] = existingData[key];
		}
		return newData;
	}
}

type NFPN<T> = {
	[K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
export type NFP<T> = Pick<T, NFPN<T>>;
