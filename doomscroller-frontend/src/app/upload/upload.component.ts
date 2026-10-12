import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { VideoService } from '../core/services/video.service';
import { ConversionOptions, UploadFormOptions } from '../core/models/video.model';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent implements OnInit {
  formOptions?: UploadFormOptions;
  selectedFile?: File;
  progressPercent = 0;
  uploading = false;
  errorMessage?: string;
  uploadedVideoId?: string;

  // "Custom" lets the user type an arbitrary height list; otherwise they pick one of the
  // server-provided resolutionPresets (original / 480,720,1080,2160).
  customResolutions = false;

  form: ReturnType<FormBuilder['group']>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly videoService: VideoService,
    private readonly router: Router
  ) {
    this.form = this.fb.group({
      title: [''],
      preset: ['WebOptimized', Validators.required],
      container: ['Mp4', Validators.required],
      forceCopyAudioIfSupported: [true],
      resolutionTargets: ['original', Validators.required]
    });
  }

  ngOnInit(): void {
    this.videoService.getUploadFormOptions().subscribe({
      next: (opts) => (this.formOptions = opts),
      error: (err) => {
        this.errorMessage = 'Could not reach the DoomScroller API. Is the backend running?';
        console.error(err);
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0];
    if (this.selectedFile && !this.form.value.title) {
      this.form.patchValue({ title: this.selectedFile.name.replace(/\.[^/.]+$/, '') });
    }
  }

  submit(): void {
    if (!this.selectedFile || this.form.invalid) return;

    this.uploading = true;
    this.errorMessage = undefined;
    this.progressPercent = 0;

    const value = this.form.getRawValue();
    const options: ConversionOptions = {
      preset: value.preset as ConversionOptions['preset'],
      container: value.container as ConversionOptions['container'],
      forceCopyAudioIfSupported: !!value.forceCopyAudioIfSupported,
      resolutionTargets: value.resolutionTargets ?? 'original'
    };

    this.videoService.upload(this.selectedFile, value.title ?? '', options).subscribe({
      next: (progress) => {
        this.progressPercent = progress.progressPercent;
        if (progress.done && progress.video) {
          this.uploading = false;
          this.uploadedVideoId = progress.video.id;
        }
      },
      error: (err) => {
        this.uploading = false;
        this.errorMessage = err?.error ?? 'Upload failed.';
        console.error(err);
      }
    });
  }

  goToFeed(): void {
    this.router.navigateByUrl('/');
  }
}
