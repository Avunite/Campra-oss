// This adapter allows tests to run with either Vitest or Mocha
import * as sinon from 'sinon';

// Check if we're running in Vitest or Mocha
export const isVitest = typeof vi !== 'undefined';

// Export appropriate testing functions
export const describe = globalThis.describe;
export const it = isVitest ? globalThis.test : globalThis.it;
export const beforeEach = globalThis.beforeEach;
export const afterEach = globalThis.afterEach;
export const beforeAll = isVitest ? globalThis.beforeAll : globalThis.before;
export const afterAll = isVitest ? globalThis.afterAll : globalThis.after;

// Mock functionality
export const mock = isVitest 
  ? (path, mockImpl) => vi.mock(path, () => mockImpl)
  : () => {}; // Sinon doesn't have a direct equivalent

// Stub/spy functionality
export const stub = isVitest
  ? (obj, method) => vi.spyOn(obj, method)
  : (obj, method) => sinon.stub(obj, method);

// Reset mocks
export const resetMocks = isVitest
  ? () => vi.resetAllMocks()
  : () => sinon.resetHistory();

// Fake timers
export const useFakeTimers = isVitest
  ? () => vi.useFakeTimers()
  : () => sinon.useFakeTimers();

// Clear timers
export const clearTimers = isVitest
  ? () => vi.clearAllTimers()
  : (clock) => clock.reset();

// Restore all
export const restoreAll = isVitest
  ? () => vi.restoreAllMocks()
  : () => sinon.restore();

// Expect functionality
export const expect = (actual) => {
  if (isVitest) {
    return globalThis.expect(actual);
  } else {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${actual} to be ${expected}`);
        }
      },
      toEqual: (expected) => {
        const stringify = (obj) => JSON.stringify(obj, null, 2);
        if (stringify(actual) !== stringify(expected)) {
          throw new Error(`Expected ${stringify(actual)} to equal ${stringify(expected)}`);
        }
      },
      toHaveBeenCalledTimes: (times) => {
        if (actual.callCount !== times) {
          throw new Error(`Expected function to have been called ${times} times, but it was called ${actual.callCount} times`);
        }
      },
      toHaveBeenCalledWith: (...args) => {
        const called = actual.calledWith(...args);
        if (!called) {
          throw new Error(`Expected function to have been called with ${args}`);
        }
      },
      not: {
        toHaveBeenCalled: () => {
          if (actual.called) {
            throw new Error('Expected function not to have been called');
          }
        }
      }
    };
  }
};
