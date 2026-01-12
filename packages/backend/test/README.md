# Testing the Campra V4 Backend

This directory contains tests for the Campra V4 backend services. We provide multiple testing approaches to accommodate different development environments and needs.

## Testing Approaches

### 1. Simple Tests (No Database Required)

These tests use a lightweight custom test runner that doesn't require a database connection or complex test framework. This is the recommended approach for quick tests and CI environments.

```shell
# Run a simple test
pnpm test:simple test/subscription-simple.test.js

# Run the ultra-simple test (most reliable)
pnpm test:simple test/subscription-ultra-simple.test.js
```

The simple test runner supports:
- `describe` blocks for organizing tests
- `test`/`it` functions for individual test cases
- `expect` with matchers like `toBe`, `toEqual`, `toHaveBeenCalledWith`
- `beforeEach` and `afterEach` hooks
- Basic mocking with `vi.fn()`

### 2. Vitest Tests with Mocked Database

These tests use Vitest but mock all database connections. This approach provides more testing features while still avoiding the need for a real database.

```shell
# Run tests with mocked database
pnpm test:no-db
```

### 3. Full Integration Tests (Requires Database)

These tests connect to a real database and test the full service stack. This approach requires a properly configured database.

```shell
# Run full integration tests
pnpm test
```

## Directory Structure

- `test/*.test.js|ts` - Test files
- `test/mock-db.js` - Database mocking utilities
- `test/simple-runner.js` - Simple test runner for database-free tests
- `test/setup-no-db.js` - Setup for running tests without a database

## Creating New Tests

### Simple Tests (Recommended for Most Cases)

1. Create a new file in the test directory with a `.test.js` extension
2. Mock the necessary dependencies directly in your test file
3. Use the global test functions: `describe`, `test`/`it`, and `expect`
4. Run your test with `pnpm test:simple your-file.test.js`

### Vitest Tests

1. Create a new file with a `.test.js` extension
2. Import test functions from Vitest: `import { describe, test, expect } from 'vitest'`
3. Use the setup mocks from `setup-no-db.js`
4. Run your test with `pnpm test:no-db your-file.test.js`

## Best Practices

1. Always mock external dependencies in your tests
2. Use descriptive test names that explain what's being tested
3. Keep test files focused on testing a single component or service
4. Clean up any test data or mocks after tests complete
