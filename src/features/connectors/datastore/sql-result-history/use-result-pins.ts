'use client';
import { useState } from 'react';
import {
  addResultPin,
  scopedResultPins,
  type ResultPin,
  type ResultPinScope,
} from './model';

/** Mounted connection owns all snapshots; they never enter global storage or a different workspace. */
export function useResultPins() {
  const [pins, setPins] = useState<ResultPin[]>([]);
  function pin(input: Omit<ResultPin, 'id' | 'capturedAt' | 'bytes'>) {
    // Compute before setState so limit failures can be reported by the initiating user action.
    setPins(addResultPin(pins, input));
  }
  function remove(id: string) {
    setPins((current) => current.filter((pin) => pin.id !== id));
  }
  function clear(scope: ResultPinScope) {
    const ids = new Set(scopedResultPins(pins, scope).map((pin) => pin.id));
    setPins((current) => current.filter((pin) => !ids.has(pin.id)));
  }
  function forgetTabs(ids: readonly string[]) {
    setPins((current) =>
      current.filter((pin) => !ids.includes(pin.scope.tabId)),
    );
  }
  return { pins, pin, remove, clear, forgetTabs };
}
