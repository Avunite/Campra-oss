// filepath: /home/aidan/Documents/Avunite/Campra-V4/packages/backend/test/simple-runner.js
/**
 * A simple test runner that doesn't depend on Vite
 * This is used to run tests without a database connection
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Setup environment
process.env.NODE_ENV = 'test';

// Keep track of running tests and contexts
const testContexts = [];
let currentTestContext = null;

// Globals for test files
global.describe = (description, callback) => {
  console.log(`\n📋 ${description}`);
  
  // Create a new test context for this describe block
  const newContext = {
    description,
    beforeEachCallbacks: [],
    afterEachCallbacks: []
  };
  
  const parentContext = currentTestContext;
  currentTestContext = newContext;
  testContexts.push(newContext);
  
  // Run the callback to register tests
  callback();
  
  // Restore the parent context
  currentTestContext = parentContext;
};

global.test = global.it = async (description, callback) => {
  try {
    // Get the current test context
    const context = currentTestContext || { beforeEachCallbacks: [], afterEachCallbacks: [] };
    
    // Run beforeEach hooks if they exist
    if (context.beforeEachCallbacks.length > 0) {
      for (const beforeEachCallback of context.beforeEachCallbacks) {
        await beforeEachCallback();
      }
    }
    
    await callback();
    
    // Run afterEach hooks if they exist
    if (context.afterEachCallbacks.length > 0) {
      for (const afterEachCallback of context.afterEachCallbacks) {
        await afterEachCallback();
      }
    }
    
    console.log(`✅ ${description}`);
  } catch (error) {
    console.error(`❌ ${description}`);
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`   ${error.stack.split('\n').slice(1).join('\n   ')}`);
    }
    process.exitCode = 1;
  }
};

global.expect = (actual) => ({
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
    // For our mock functions, we use callCount instead of calls.length
    if (!actual.callCount && actual.callCount !== 0) {
      throw new Error('Expected a mock function with callCount property');
    }
    if (actual.callCount !== times) {
      throw new Error(`Expected function to have been called ${times} times, but it was called ${actual.callCount} times`);
    }
  },
  toHaveBeenCalledWith: (...args) => {
    if (!actual.calls || !Array.isArray(actual.calls)) {
      throw new Error('Expected a mock function with calls property');
    }
    const called = actual.calls.some(callArgs => 
      args.every((arg, i) => JSON.stringify(arg) === JSON.stringify(callArgs[i])));
    if (!called) {
      throw new Error(`Expected function to have been called with ${JSON.stringify(args)}`);
    }
  },
  not: {
    toHaveBeenCalled: () => {
      if (!actual.callCount && actual.callCount !== 0) {
        throw new Error('Expected a mock function with callCount property');
      }
      if (actual.callCount > 0) {
        throw new Error('Expected function not to have been called');
      }
    }
  }
});

global.beforeEach = (callback) => {
  if (currentTestContext) {
    currentTestContext.beforeEachCallbacks.push(callback);
  }
};

global.afterEach = (callback) => {
  if (currentTestContext) {
    currentTestContext.afterEachCallbacks.push(callback);
  }
};

// Mock classes for tests
global.vi = {
  fn: () => {
    const mockFn = function(...args) {
      mockFn.calls.push(args);
      mockFn.callCount += 1;
      if (mockFn.implementation) {
        return mockFn.implementation(...args);
      }
      return mockFn.returnValue;
    };
    
    // Initialize mock properties
    mockFn.calls = [];
    mockFn.callCount = 0;
    mockFn.returnValue = undefined;
    mockFn.implementation = null;
    
    // Add mock methods
    mockFn.mockReturnValue = function(value) {
      mockFn.returnValue = value;
      return mockFn;
    };
    
    mockFn.mockResolvedValue = function(value) {
      mockFn.returnValue = Promise.resolve(value);
      return mockFn;
    };
    
    mockFn.mockRejectedValue = function(value) {
      mockFn.returnValue = Promise.reject(value);
      return mockFn;
    };
    
    mockFn.mockImplementation = function(impl) {
      mockFn.implementation = impl;
      return mockFn;
    };
    
    mockFn.calledWith = function(...args) {
      return mockFn.calls.some(callArgs => 
        args.every((arg, i) => JSON.stringify(arg) === JSON.stringify(callArgs[i])));
    };
    
    mockFn.resetMocks = function() {
      mockFn.calls = [];
      mockFn.callCount = 0;
    };
    
    return mockFn;
  },
  resetAllMocks: () => {
    // This is a placeholder, we don't actually reset anything globally
    // Each test should handle its own mocks
  },
  mocked: (obj) => obj
};

// Run the specified test file
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please specify a test file to run');
  process.exit(1);
}

const testFile = args[0];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFilePath = path.resolve(process.cwd(), testFile);

if (!fs.existsSync(testFilePath)) {
  console.error(`Test file not found: ${testFilePath}`);
  process.exit(1);
}

console.log(`\n🧪 Running tests in: ${testFile}\n`);

// Import and run the test file
try {
  // We need to use dynamic import since we're in an ESM context
  await import(testFilePath);
  
  // If we made it here without errors, tests passed
  if (process.exitCode !== 1) {
    console.log('\n✨ All tests passed!');
  } else {
    console.log('\n❌ Tests failed');
  }
} catch (error) {
  console.error(`\n❌ Error running tests: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
