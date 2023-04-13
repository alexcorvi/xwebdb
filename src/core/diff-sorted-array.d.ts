declare module 'diff-sorted-array' {
    export function justDiff<T>(oldArray: T[], newArray: T[], sorter: (a: T, b: T)=> 1 | -1): {added: T[], deleted: T[], unchanged: T[]};
    export function diff<T>(oldArray: T[], newArray: T[]): {added: T[], deleted: T[], unchanged: T[]};
    export function asc<T>(a:T, b:T): 1 | -1;
    export function desc<T>(a:T, b:T): 1 | -1;
  }