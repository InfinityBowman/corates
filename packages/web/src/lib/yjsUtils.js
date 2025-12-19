import * as Y from 'yjs';

// Convert a Y.Map or Y.Array into a plain JS structure recursively
export function yToPlain(value) {
  if (value instanceof Y.Map) {
    const obj = {};
    for (const k of value.keys()) {
      obj[k] = yToPlain(value.get(k));
    }
    return obj;
  }

  if (value instanceof Y.Array) {
    const array = [];
    for (let i = 0; i < value.length; i++) array.push(yToPlain(value.get(i)));
    return array;
  }

  // primitive or plain object
  if (Array.isArray(value)) return value.map(v => yToPlain(v));
  if (value && typeof value === 'object') {
    const obj = {};
    for (const k of Object.keys(value)) obj[k] = yToPlain(value[k]);
    return obj;
  }
  return value;
}

// Ensure JS object becomes Y.Map/Y.Array structure inside target Y.Map
export function applyObjectToYMap(target, obj) {
  if (!(target instanceof Y.Map)) throw new Error('target must be a Y.Map');

  for (const [key, val] of Object.entries(obj || {})) {
    if (val instanceof Y.Map || val instanceof Y.Array) {
      target.set(key, val);
      continue;
    }

    if (Array.isArray(val)) {
      const array = new Y.Array();
      for (const item of val) array.push([convertPrimitiveToY(item)]);
      target.set(key, array);
      continue;
    }

    if (val && typeof val === 'object') {
      const map = new Y.Map();
      applyObjectToYMap(map, val);
      target.set(key, map);
      continue;
    }

    target.set(key, val);
  }
}

// Helper: convert primitive/obj/array to a Y-friendly value
function convertPrimitiveToY(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const m = new Y.Map();
    applyObjectToYMap(m, value);
    return m;
  }

  if (Array.isArray(value)) {
    const a = new Y.Array();
    for (const v of value) a.push([convertPrimitiveToY(v)]);
    return a;
  }

  return value;
}
