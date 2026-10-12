import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { VideoService } from '../core/services/video.service';
import { ConversionOptions, UploadFormOptions } from '../core/models/video.model';

@Component({
  selector: 'app-upload',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './upload.html',
  styleUrl: './upload.scss'
})
export class Upload implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly videoService = inject(VideoService);
  private readonly router = inject(Router);

  protected readonly formOptions = signal<UploadFormOptions | undefined>(undefined);
  protected readonly selectedFile = signal<File | undefined>(undefined);
  protected readonly progressPercent = signal(0);
  protected readonly uploading = signal(false);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly uploadedVideoId = signal<string | undefined>(undefined);

  // "Custom" lets the user type an arbitrary height list; otherwise they pick one of the
  // server-provided resolutionPresets (original / 480,720,1080,2160).
  protected readonly customResolutions = signal(false);

  protected readonly form = this.fb.group({
    title: [''],
    preset: ['WebOptimized', Validators.required],
    container: ['Mp4', Validators.required],
    forceCopyAudioIfSupported: [true],
    resolutionTargets: ['original', Validators.required]
  });

  ngOnInit(): void {
    this.videoService.getUploadFormOptions().subscribe({
      next: (opts) => this.formOptions.set(opts),
      error: (err) => {
        this.errorMessage.set('Could not reach the DoomScroller API. Is the backend running?');
        console.error(err);
      }
    });
  }

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.selectedFile.set(file);
    if (file && !this.form.controls.title.value) {
      this.form.patchValue({ title: file.name.replace(/\.[^/.]+$/, '') });
    }
  }

  protected selectResolutionPreset(value: string): void {
    this.customResolutions.set(false);
    this.form.patchValue({ resolutionTargets: value });
  }

  protected selectCustomResolutions(): void {
    this.customResolutions.set(true);
    this.form.patchValue({ resolutionTargets: '' });
  }

  protected submit(): void {
    const file = this.selectedFile();
    if (!file || this.form.invalid) return;

    this.uploading.set(true);
    this.errorMessage.set(undefined);
    this.progressPercent.set(0);

    const value = this.form.getRawValue();
    const options: ConversionOptions = {
      preset: value.preset as ConversionOptions['preset'],
      container: value.container as ConversionOptions['container'],
      forceCopyAudioIfSupported: value.forceCopyAudioIfSupported,
      resolutionTargets: value.resolutionTargets
    };

    this.videoService.upload(file, value.title, options).subscribe({
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
