import { Directive, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';

@Directive({ selector: '[hafTimeline]', host: { '(window:scroll)': 'update()', '(window:resize)': 'update()' } })
export class Timeline {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      this.update();
      const observer = new ResizeObserver(() => this.update());
      observer.observe(this.element.nativeElement);
      this.destroy.onDestroy(() => observer.disconnect());
    });
  }

  update(): void {
    const timeline = this.element.nativeElement;
    const top = timeline.offsetTop;
    const height = timeline.offsetHeight;
    const percentage = Math.max(0, Math.min(100, (window.scrollY + window.innerHeight - top) / (height + window.innerHeight) * 100));
    timeline.style.setProperty('--scroll-percent', `${percentage}%`);
    timeline.querySelectorAll<HTMLElement>('.timeline-item').forEach((item, index) => {
      if (index === 0 || window.scrollY + window.innerHeight * 0.8 > item.offsetTop + top) item.classList.add('visible');
    });
  }
}