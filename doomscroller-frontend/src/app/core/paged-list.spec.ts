import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PagedList } from './paged-list';

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

describe('PagedList', () => {
  it('loads the first page and knows there is more when the page is full', () => {
    const fetch = vi.fn().mockReturnValue(of(range(0, 3)));
    const list = new PagedList<number>(fetch, 3);

    list.start();

    expect(fetch).toHaveBeenCalledWith(0);
    expect(list.items()).toEqual([0, 1, 2]);
    expect(list.hasMore()).toBe(true);
    expect(list.loading()).toBe(false);
  });

  it('knows it is finished when a page comes back short', () => {
    const list = new PagedList<number>(() => of([1, 2]), 3);
    list.start();
    expect(list.hasMore()).toBe(false);
  });

  it('only fetches the first page once, however often it is started', () => {
    const fetch = vi.fn().mockReturnValue(of([1]));
    const list = new PagedList<number>(fetch, 3);
    list.start();
    list.start();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows loading while the first page is on its way', () => {
    const pending = new Subject<number[]>();
    const list = new PagedList<number>(() => pending, 3);
    list.start();
    expect(list.loading()).toBe(true);
    pending.next([1]);
    expect(list.loading()).toBe(false);
  });

  it('loads more from where it left off, appending, until a short page', () => {
    const fetch = vi.fn().mockReturnValueOnce(of(range(0, 3))).mockReturnValueOnce(of(range(3, 3))).mockReturnValueOnce(of([6]));
    const list = new PagedList<number>(fetch, 3);
    list.start();

    list.loadMore();
    expect(fetch).toHaveBeenLastCalledWith(3);
    list.loadMore();
    expect(fetch).toHaveBeenLastCalledWith(6);

    expect(list.items()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(list.hasMore()).toBe(false);

    list.loadMore(); // nothing left: no request
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('ignores load-more while one is already running', () => {
    const pending = new Subject<number[]>();
    const fetch = vi.fn().mockReturnValueOnce(of(range(0, 3))).mockReturnValueOnce(pending);
    const list = new PagedList<number>(fetch, 3);
    list.start();

    list.loadMore();
    list.loadMore();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(list.loadingMore()).toBe(true);
  });

  it('reports a failure with its status, and a failed load-more keeps what is already shown', () => {
    const failing = new PagedList<number>(() => throwError(() => ({ status: 403 })), 3);
    failing.start();
    expect(failing.error()).toEqual({ status: 403 });
    expect(failing.loading()).toBe(false);

    const fetch = vi.fn().mockReturnValueOnce(of(range(0, 3))).mockReturnValueOnce(throwError(() => ({ status: 500 })));
    const list = new PagedList<number>(fetch, 3);
    list.start();
    list.loadMore();
    expect(list.items()).toEqual([0, 1, 2]);
    expect(list.error()).toEqual({ status: 500 });
    expect(list.loadingMore()).toBe(false);
    expect(list.hasMore()).toBe(true); // can try again
  });

  it('reset forgets everything, ignores answers still in flight, and allows starting again', () => {
    const slow = new Subject<number[]>();
    const fetch = vi.fn().mockReturnValueOnce(slow).mockReturnValueOnce(of(['fresh' as unknown as number]));
    const list = new PagedList<number>(fetch, 3);
    list.start();

    list.reset();
    slow.next([1, 2, 3]); // the old request finally answers
    expect(list.items()).toEqual([]);
    expect(list.loading()).toBe(false);

    list.start();
    expect(list.items()).toEqual(['fresh']);
  });
});
