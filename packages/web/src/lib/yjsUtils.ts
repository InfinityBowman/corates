import * as Y from 'yjs';

type YjsPrimitive = string | number | boolean | null | undefined;
type PlainValue = YjsPrimitive | PlainObject | PlainArray;
interface PlainObject {
  [key: string]: PlainValue;
}
type PlainArray = PlainValue[];

// Convert a Y.Map or Y.Array into a plain JS structure recursively
export function yToPlain(value: unknown): PlainValue {
  if (value instanceof Y.Map) {
    const obj: PlainObject = {};
    for (const k of value.keys()) {
      obj[k] = yToPlain(value.get(k));
    }
    return obj;
  }

  if (value instanceof Y.Array) {
    const arr: PlainArray = [];
    for (let i = 0; i < value.length; i++) arr.push(yToPlain(value.get(i)));
    return arr;
  }

  // primitive or plain object
  if (Array.isArray(value)) return value.map(v => yToPlain(v));
  if (value && typeof value === 'object') {
    const obj: PlainObject = {};
    for (const k of Object.keys(value as Record<string, unknown>))
      obj[k] = yToPlain((value as Record<string, unknown>)[k]);
    return obj;
  }
  return value as YjsPrimitive;
}

// Ensure JS object becomes Y.Map/Y.Array structure inside target Y.Map
export function applyObjectToYMap(
  target: Y.Map<unknown>,
  obj: Record<string, unknown> | null | undefined,
): void {
  if (!(target instanceof Y.Map)) throw new Error('target must be a Y.Map');

  Object.entries(obj || {}).forEach(([key, val]) => {
    if (val instanceof Y.Map || val instanceof Y.Array) {
      target.set(key, val);
      return;
    }

    if (Array.isArray(val)) {
      const arr = new Y.Array();
      val.forEach(item => arr.push([convertPrimitiveToY(item)]));
      target.set(key, arr);
      return;
    }

    if (val && typeof val === 'object') {
      const map = new Y.Map();
      applyObjectToYMap(map, val as Record<string, unknown>);
      target.set(key, map);
      return;
    }

    target.set(key, val);
  });
}

// Helper: convert primitive/obj/array to a Y-friendly value
function convertPrimitiveToY(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const m = new Y.Map();
    applyObjectToYMap(m, value as Record<string, unknown>);
    return m;
  }

  if (Array.isArray(value)) {
    const a = new Y.Array();
    value.forEach(v => a.push([convertPrimitiveToY(v)]));
    return a;
  }

  return value;
}
