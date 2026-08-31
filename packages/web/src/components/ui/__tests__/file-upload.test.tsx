import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload, FileUploadDropzone, FileUploadHiddenInput } from '../file-upload';

function pdfFile(name: string) {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

function fileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

function pickFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  fireEvent.input(input);
}

function acceptedNames(onFileAccept: ReturnType<typeof vi.fn>): string[][] {
  return onFileAccept.mock.calls
    .map(call => (call[0]?.files as File[]).map(f => f.name))
    .filter(names => names.length > 0);
}

describe('FileUpload resetOnAccept', () => {
  it('does not re-emit a previously accepted file on the next pick', async () => {
    const onFileAccept = vi.fn();
    const { container } = render(
      <FileUpload
        accept={['application/pdf']}
        maxFiles={Infinity}
        resetOnAccept
        onFileAccept={onFileAccept}
      >
        <FileUploadDropzone>drop</FileUploadDropzone>
        <FileUploadHiddenInput />
      </FileUpload>,
    );

    pickFiles(fileInput(container), [pdfFile('a.pdf')]);
    await waitFor(() => {
      expect(acceptedNames(onFileAccept).at(-1)).toEqual(['a.pdf']);
    });

    // Remount replaces the input; query again after the first pick settles.
    pickFiles(fileInput(container), [pdfFile('b.pdf')]);
    await waitFor(() => {
      expect(acceptedNames(onFileAccept).at(-1)).toEqual(['b.pdf']);
    });
    expect(
      acceptedNames(onFileAccept).some(names => names.includes('a.pdf') && names.includes('b.pdf')),
    ).toBe(false);
  });
});
