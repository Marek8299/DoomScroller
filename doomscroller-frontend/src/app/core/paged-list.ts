import { signal } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * A list that loads in pages, with the state a "load more" UI needs. Each profile tab owns one.
 * Create it with a function that fetches `pageSize` items starting at `skip`; a page shorter than
 * `pageSize` means there is nothing more.
 */
export class PagedList<T> {
  readonly items = signal<T[]>([]);
  /** The first page is on its way. */
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);
  /** Has the first page ever been requested? Tabs load lazily, the first time they're opened. */
  readonly started = signal(false);
  readonly error = signal<{ status?: number } | null>(null);

  private generation = 0;

  constructor(
    private readonly fetch: (skip: number) => Observable<T[]>,
    private readonly pageSize: number
  ) {}

  /** Load the first page (does nothing if it was already requested). */
  start(): void {
    if (this.started()) return;
    this.started.set(true);
    this.loading.set(true);
    this.request(0, (page) => {
      this.items.set(page);
      this.hasMore.set(page.length === this.pageSize);
      this.loading.set(false);
    }, () => this.loading.set(false));
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.request(this.items().length, (page) => {
      this.items.update((list) => [...list, ...page]);
      this.hasMore.set(page.length === this.pageSize);
      this.loadingMore.set(false);
    }, () => this.loadingMore.set(false));
  }

  /** Forget everything (e.g. when moving to another person's profile). Answers still in flight are ignored. */
  reset(): void {
    this.generation++;
    this.items.set([]);
    this.loading.set(false);
    this.loadingMore.set(false);
    this.hasMore.set(false);
    this.started.set(false);
    this.error.set(null);
  }

  private request(skip: number, onPage: (page: T[]) => void, onFail: () => void): void {
    const generation = this.generation;
    this.error.set(null);
    this.fetch(skip).subscribe({
      next: (page) => {
        if (generation === this.generation) onPage(page);
      },
      error: (err) => {
        if (generation !== this.generation) return;
        this.error.set({ status: err?.status });
        onFail();
      }
    });
  }
}
