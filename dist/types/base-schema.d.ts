export declare class BaseModel<T> {
    _id: string;
    updatedAt?: Date;
    createdAt?: Date;
    static new<T>(this: new () => T, data: Partial<NFP<T>>): T;
}
type NFPN<T> = {
    [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
export type NFP<T> = Pick<T, NFPN<T>>;
export {};
