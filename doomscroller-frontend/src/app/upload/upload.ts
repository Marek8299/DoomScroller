import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { VideoService } from '../core/services/video.service';

@Component({
  selector: 'app-upload',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './upload.html',
  styleUrl: './upload.scss'
})
export class Upload {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly videoService = inject(VideoService);
  private readonly router = inject(Router);

  protected readonly selectedFile = signal<File | undefined>(undefined);
  protected readonly progressPercent = signal(0);
  protected readonly uploading = signal(false);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly uploadedVideoId = signal<string | undefined>(undefined);

  // Limits mirror UploadVideoRequest on the backend.
  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(2000)],
    normalizeVolume: [false]
  });

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.selectedFile.set(file);
    if (file && !this.form.controls.title.value) {
      this.form.patchValue({ title: file.name.replace(/\.[^/.]+$/, '') });
    }
  }

  protected submit(): void {
    const file = this.selectedFile();
    if (!file || this.form.invalid) return;

    this.uploading.set(true);
    this.errorMessage.set(undefined);
    this.progressPercent.set(0);

    const { title, description, normalizeVolume } = this.form.getRawValue();

    this.videoService.upload(file, title, description, normalizeVolume).subscribe({
      next: (progress) => {
        this.progressPercent.set(progress.progressPercent);
        if (progress.done && progress.video) {
          this.uploading.set(false);
          this.uploadedVideoId.set(progress.video.id);
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.errorMessage.set(typeof err?.error === 'string' ? err.error : 'Upload failed.');
        console.error(err);
      }
    });
  }

  protected goToFeed(): void {
    this.router.navigateByUrl('/');
  }
}
