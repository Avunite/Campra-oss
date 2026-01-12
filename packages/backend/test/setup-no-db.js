import { vi } from 'vitest';

// Mock config to avoid loading from files
vi.mock('@/config/index.js', () => ({
  default: {
    url: 'http://test-localhost:3000',
    port: 3000,
    redis: {
      host: 'mock-redis',
      port: 6379,
    },
    db: {
      host: 'mock-db',
      port: 5432,
      user: 'test',
      pass: 'test',
      db: 'test_db',
    },
    mediaProxy: false,
    proxyRemoteFiles: false,
    allowedPrivateNetworks: [],
    reservedUsernames: [],
    disableHsts: true,
    maxNoteLength: 3000,
    disableTableLock: true,
    disableFanout: true,
    accessCheck: {
      level: 'silent',
      state: 'alive',
    },
    admin: {
      accounts: ['admin'],
    },
    envs: {
      test: true,
      dev: false,
      cloud: false,
    },
  }
}));

// Mock database connection
vi.mock('@/db/postgre.js', () => ({
  default: {
    initialize: vi.fn().mockResolvedValue({
      isInitialized: true,
      manager: {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue({}),
        save: vi.fn().mockResolvedValue({}),
      },
      getRepository: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue([]),
        save: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({ affected: 1 }),
        findOneBy: vi.fn().mockResolvedValue({}),
        createQueryBuilder: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          getOne: vi.fn().mockResolvedValue({}),
          getMany: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }
}));

// Mock Redis client
vi.mock('@/redis/index.js', () => ({
  default: {
    connect: vi.fn().mockResolvedValue({}),
    on: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
  }
}));

// Mock Queue services
vi.mock('@/queue/queues.js', () => ({
  deliverQueue: {
    add: vi.fn().mockResolvedValue({}),
  },
  inboxQueue: {
    add: vi.fn().mockResolvedValue({}),
  },
  outboxQueue: {
    add: vi.fn().mockResolvedValue({}),
  },
  subscriptionQueue: {
    add: vi.fn().mockResolvedValue({}),
  },
}));

// Mock entity repositories
vi.mock('@/models/index.js', () => ({
  Users: {
    findOne: vi.fn().mockResolvedValue({}),
    find: vi.fn().mockResolvedValue([]),
    findOneBy: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    insert: vi.fn().mockResolvedValue({}),
  },
}));

// Console mocks to reduce noise
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Global setup flag
global.__TEST_WITHOUT_DB__ = true;
