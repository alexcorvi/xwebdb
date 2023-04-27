import { RecursivePartial, NFGP } from "./common";
declare class BaseModel {
    static new<T extends BaseModel>(this: new () => T, data?: RecursivePartial<NFGP<T>>): T;
}
export declare class Doc extends BaseModel {
    _id: string;
    updatedAt?: Date;
    createdAt?: Date;
    static stripDefaults<T extends object>(this: new () => T, existingData: T): T;
}
export declare class SubDoc extends BaseModel {
}
declare function mapSubModel<T extends typeof SubDoc>(ctr: T, def: InstanceType<T>): InstanceType<T>;
declare function mapSubModel<T extends typeof SubDoc>(ctr: T, def: Array<InstanceType<T>>): Array<InstanceType<T>>;
export { mapSubModel };
