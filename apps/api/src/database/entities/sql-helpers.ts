/** Builds an SQL literal list from enum values: ('a', 'b'). */
export const sqlIn = (values: readonly string[]) => `(${values.map((v) => `'${v}'`).join(', ')})`;
