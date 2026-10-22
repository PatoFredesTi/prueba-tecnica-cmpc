module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/prisma/prisma.service.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: { global: { lines: 80, statements: 80, branches: 80, functions: 80 } },
  coverageReporters: ['text', 'json-summary', 'lcov'],
};
