import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db';
import { formatFileSize, checkMediaLimits, getMediaKind } from './media';
import { getSuggestions, recordSuggestion } from './catalog';
import type { MediaRef, Person } from '../types';

describe('Photos and Documents UI utilities', () => {
  beforeEach(async () => {
    await db.suggestions.clear();
  });

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes correctly', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 15)).toBe('15.0 MB');
      expect(formatFileSize(1024 * 1024 * 52.4)).toBe('52.4 MB');
    });
  });

  describe('checkMediaLimits', () => {
    it('passes when files are within 15MB each and 50MB total', () => {
      const smallBlob = new Blob(['hello world']);
      const files: MediaRef[] = [
        {
          id: '1',
          kind: 'image',
          name: 'photo1.jpg',
          mime: 'image/jpeg',
          blob: smallBlob,
          createdAt: Date.now(),
        },
      ];

      const check = checkMediaLimits(files);
      expect(check.hasLargeFile).toBe(false);
      expect(check.isOverTotalLimit).toBe(false);
      expect(check.largeFiles).toHaveLength(0);
    });

    it('detects files exceeding 15MB individually', () => {
      // Create a mock blob with size > 15MB
      const mockLargeBlob = { size: 16 * 1024 * 1024 } as unknown as Blob;
      const files: MediaRef[] = [
        {
          id: '1',
          kind: 'pdf',
          name: 'biodata.pdf',
          mime: 'application/pdf',
          blob: mockLargeBlob,
          createdAt: Date.now(),
        },
      ];

      const check = checkMediaLimits(files);
      expect(check.hasLargeFile).toBe(true);
      expect(check.largeFiles).toHaveLength(1);
      expect(check.largeFiles[0].name).toBe('biodata.pdf');
    });

    it('detects person exceeding 50MB in total across photos and docs', () => {
      const mockBlob1 = { size: 30 * 1024 * 1024 } as unknown as Blob;
      const mockBlob2 = { size: 25 * 1024 * 1024 } as unknown as Blob;
      const files: MediaRef[] = [
        {
          id: '1',
          kind: 'image',
          name: 'photo1.jpg',
          mime: 'image/jpeg',
          blob: mockBlob1,
          createdAt: Date.now(),
        },
        {
          id: '2',
          kind: 'pdf',
          name: 'large_biodata.pdf',
          mime: 'application/pdf',
          blob: mockBlob2,
          createdAt: Date.now(),
        },
      ];

      const check = checkMediaLimits(files);
      expect(check.isOverTotalLimit).toBe(true);
      expect(check.totalBytes).toBe(55 * 1024 * 1024);
    });
  });

  describe('getMediaKind', () => {
    it('correctly maps MIME types to MediaRef kinds', () => {
      expect(getMediaKind('image/jpeg')).toBe('image');
      expect(getMediaKind('image/png')).toBe('image');
      expect(getMediaKind('application/pdf')).toBe('pdf');
      expect(getMediaKind('audio/mpeg')).toBe('audio');
      expect(getMediaKind('audio/wav')).toBe('audio');
      expect(getMediaKind('text/plain')).toBe('text');
      expect(getMediaKind('application/msword')).toBe('doc');
      expect(getMediaKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc');
    });
  });

  describe('docLabel suggestions', () => {
    it('records and returns docLabel suggestions ranked by useCount', async () => {
      await recordSuggestion('docLabel', 'বায়োডাটা PDF');
      await recordSuggestion('docLabel', 'সার্টিফিকেট');
      await recordSuggestion('docLabel', 'বায়োডাটা PDF');

      const suggestions = await getSuggestions('docLabel');
      expect(suggestions[0].text).toBe('বায়োডাটা PDF');
      expect(suggestions[0].useCount).toBe(2);
      expect(suggestions[1].text).toBe('সার্টিফিকেট');
      expect(suggestions[1].useCount).toBe(1);
    });
  });

  describe('coverPhoto selection logic', () => {
    it('defaults to first photo if coverPhotoId is undefined', () => {
      const person: Partial<Person> = {
        photos: [
          { id: 'photo-1', kind: 'image', name: '1.jpg', mime: 'image/jpeg', blob: new Blob(), createdAt: 1 },
          { id: 'photo-2', kind: 'image', name: '2.jpg', mime: 'image/jpeg', blob: new Blob(), createdAt: 2 },
        ],
      };

      const effectiveCover = person.coverPhotoId || person.photos?.[0]?.id;
      expect(effectiveCover).toBe('photo-1');
    });

    it('respects explicitly set coverPhotoId', () => {
      const person: Partial<Person> = {
        coverPhotoId: 'photo-2',
        photos: [
          { id: 'photo-1', kind: 'image', name: '1.jpg', mime: 'image/jpeg', blob: new Blob(), createdAt: 1 },
          { id: 'photo-2', kind: 'image', name: '2.jpg', mime: 'image/jpeg', blob: new Blob(), createdAt: 2 },
        ],
      };

      const effectiveCover = person.coverPhotoId || person.photos?.[0]?.id;
      expect(effectiveCover).toBe('photo-2');
    });
  });
});
