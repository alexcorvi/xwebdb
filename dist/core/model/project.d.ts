import { Doc, SchemaKeyProjection } from "../../types";
export declare function project<G>(documents: G[], criteria: SchemaKeyProjection<G>, model?: typeof Doc): G[];
