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
    const arr = [];
    for (let i = 0; i < value.length; i++) arr.push(yToPlain(value.get(i)));
    return arr;
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
      applyObjectToYMap(map, val);
      target.set(key, map);
      return;
    }

    target.set(key, val);
  });
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
    value.forEach(v => a.push([convertPrimitiveToY(v)]));
    return a;
  }

  return value;
}
