import * as sinon from 'sinon';

/**
 * Setup mock database functionality for tests
 * This avoids the need to connect to a real database
 */
export function setupMockDatabase() {
  // Create a sandbox for all the stubs
  const sandbox = sinon.createSandbox();
  
  // Mock TypeORM data source
  const mockDataSource = {
    isInitialized: true,
    manager: {
      findOne: sandbox.stub().resolves({}),
      find: sandbox.stub().resolves([]),
      save: sandbox.stub().resolves({}),
      remove: sandbox.stub().resolves({}),
      transaction: sandbox.stub().callsFake(async (fn) => await fn(mockDataSource.manager)),
    },
    getRepository: sandbox.stub().returns({
      findOne: sandbox.stub().resolves({}),
      find: sandbox.stub().resolves([]),
      save: sandbox.stub().resolves({}),
      remove: sandbox.stub().resolves({}),
      update: sandbox.stub().resolves({ affected: 1 }),
      findOneBy: sandbox.stub().resolves({}),
      findBy: sandbox.stub().resolves([]),
      createQueryBuilder: sandbox.stub().returns({
        where: sandbox.stub().returnsThis(),
        andWhere: sandbox.stub().returnsThis(),
        orWhere: sandbox.stub().returnsThis(),
        select: sandbox.stub().returnsThis(),
        orderBy: sandbox.stub().returnsThis(),
        addOrderBy: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        take: sandbox.stub().returnsThis(),
        leftJoinAndSelect: sandbox.stub().returnsThis(),
        innerJoinAndSelect: sandbox.stub().returnsThis(),
        getOne: sandbox.stub().resolves({}),
        getMany: sandbox.stub().resolves([]),
        getCount: sandbox.stub().resolves(0),
      }),
      metadata: {
        tableName: 'mock_table',
      },
    }),
  };
  
  // Return the sandbox and mock data source
  return { 
    sandbox,
    mockDataSource,
    
    // Helper to clean up all stubs
    cleanup: () => sandbox.restore()
  };
}
