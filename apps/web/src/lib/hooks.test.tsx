import { act, renderHook } from '@testing-library/react';
import { date, money, useDebouncedValue } from './hooks';
it('espera 350ms, cancela valores intermedios y limpia timers', () => {
  vi.useFakeTimers();
  const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value), {
    initialProps: { value: '' },
  });
  rerender({ value: 'l' });
  act(() => vi.advanceTimersByTime(150));
  rerender({ value: 'libro' });
  act(() => vi.advanceTimersByTime(349));
  expect(result.current).toBe('');
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe('libro');
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
it('formatea CLP y fecha chilena', () => {
  expect(money('12990.50')).toContain('12.990,5');
  expect(date('2026-10-22T14:00:00Z')).toContain('2026');
});
