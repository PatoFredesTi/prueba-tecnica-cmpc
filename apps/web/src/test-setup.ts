import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 3000 });
expect.extend(matchers);
afterEach(cleanup);
