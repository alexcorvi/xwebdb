export type Keys<O> = keyof O;

export type Partial<T> = { [P in keyof T]?: T[P] };

type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends <
	T
>() => T extends Y ? 1 : 2
	? A
	: B;
type WritableKeysOf<T> = {
	[P in keyof T]: IfEquals<
		{ [Q in P]: T[P] },
		{ -readonly [Q in P]: T[P] },
		P,
		never
	> &
		(T[P] extends Function ? never : P);
}[keyof T];
type WritablePart<T> = Pick<T, WritableKeysOf<T>>;
// pick non getters or functions
export type NFGP<T> = T extends Array<infer U>
	? Array<NFGP<U>>
	: T extends object
	? {
			[K in keyof WritablePart<T>]: NFGP<WritablePart<T>[K]>;
	  }
	: T;
// pick non functions
type NFPN<T> = {
	[K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
export type NFP<T> = Pick<T, NFPN<T>>;
// pick non objects
export type NOP<T> = {
	[K in keyof T]: T[K] extends (object | undefined) ? never : K;
}[keyof T];
export type RecursivePartial<T> = {
	[P in keyof T]?: T[P] extends object ? RecursivePartial<T[P]> : T[P];
};