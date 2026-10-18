import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VideoItem } from '../core/models/video.model';
import { VideoService } from '../core/services/video.service';

// Mirror VideoMetadataRules on the backend, which is the real authority.
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;

/** Bottom sheet for changing a video's title and description. */
@Component({
  selector: 'app-edit-video-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './edit-video-panel.html',
  styleUrl: './edit-video-panel.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' }
})
export class EditVideoPanel implements OnInit {
  private readonly api = inject(VideoService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly video = input.required<VideoItem>();

  /** The server's updated version of the video. */
  readonly saved = output<VideoItem>();
  readonly closed = output<void>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | undefined>(undefined);

  protected readonly maxTitle = MAX_TITLE;
  protected readonly maxDescription = MAX_DESCRIPTION;

  protected readonly form = this.fb.group({
    // /\S/ = at least one non-space character, so a title of only spaces is invalid too.
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(MAX_TITLE)]],
    description: ['', Validators.maxLength(MAX_DESCRIPTION)]
  });

  ngOnInit(): void {
    // Filled in once, when the sheet opens: the feed refreshing underneath must not overwrite what's being typed.
    this.form.setValue({ title: this.video().title, description: this.video().description ?? '' });
  }

  protected save(): void {
    if (this.form.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set(undefined);

    const { title, description } = this.form.getRawValue();
    this.api.update(this.video().id, title.trim(), description.trim()).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.saved.emit(updated);
      },
      error: (err) => {
        this.busy.set(false); // keep the form as it is so nothing typed is lost
        this.error.set(
          err?.status === 403 || err?.status === 401
            ? "You can't edit this video."
            : typeof err?.error === 'string' && err.error
              ? err.error
              : "Couldn't save your changes. Please try again."
        );
      }
    });
  }
}
