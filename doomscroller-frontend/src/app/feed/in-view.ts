import { DestroyRef, Directive, ElementRef, OnInit, inject, output } from '@angular/core';

/** Emits when at least 60% of the element is on screen: how the feed knows which video is "current". */
@Directive({ selector: '[appInView]' })
export class InView implements OnInit {
  readonly appInView = output<void>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) this.appInView.emit();
      },
      { threshold: 0.6 }
    );
    observer.observe(this.element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
