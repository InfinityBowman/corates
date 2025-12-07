/**
 * Tests for studyNaming.js - Study name generation utilities
 *
 * P2 Priority: User experience feature
 * Tests different naming conventions for studies based on metadata.
 */

import { describe, it, expect } from 'vitest';
import {
  NAMING_CONVENTIONS,
  generateStudyName,
  getDefaultNamingConvention,
} from '../studyNaming.js';

describe('NAMING_CONVENTIONS', () => {
  it('should have all expected conventions', () => {
    const ids = NAMING_CONVENTIONS.map(c => c.id);

    expect(ids).toContain('title');
    expect(ids).toContain('lastNameYear');
    expect(ids).toContain('lastNameEtAlYear');
    expect(ids).toContain('authorsYear');
    expect(ids).toContain('lastNameYearShortTitle');
  });

  it('should have required fields for each convention', () => {
    NAMING_CONVENTIONS.forEach(convention => {
      expect(convention.id).toBeDefined();
      expect(convention.label).toBeDefined();
      expect(convention.description).toBeDefined();
      expect(convention.example).toBeDefined();
    });
  });
});

describe('getDefaultNamingConvention', () => {
  it('should return title as default', () => {
    expect(getDefaultNamingConvention()).toBe('title');
  });
});

describe('generateStudyName', () => {
  describe('title convention', () => {
    it('should return full title', () => {
      const study = { title: 'Effects of Exercise on Sleep Quality' };
      expect(generateStudyName(study, 'title')).toBe('Effects of Exercise on Sleep Quality');
    });

    it('should return Untitled Study for missing title', () => {
      const study = {};
      expect(generateStudyName(study, 'title')).toBe('Untitled Study');
    });

    it('should use title convention as default', () => {
      const study = { title: 'My Study' };
      expect(generateStudyName(study)).toBe('My Study');
    });
  });

  describe('lastNameYear convention', () => {
    it('should format as "LastName (Year)"', () => {
      const study = {
        firstAuthor: 'Smith',
        publicationYear: 2023,
        title: 'Full Title',
      };
      expect(generateStudyName(study, 'lastNameYear')).toBe('Smith (2023)');
    });

    it('should extract last name from authors string if firstAuthor missing', () => {
      const study = {
        authors: 'Johnson, Robert, and Williams, Lisa',
        publicationYear: 2024,
        title: 'Test',
      };
      expect(generateStudyName(study, 'lastNameYear')).toBe('Johnson (2024)');
    });

    it('should handle "FirstName LastName" format in authors', () => {
      const study = {
        authors: 'Robert Johnson',
        publicationYear: 2024,
        title: 'Test',
      };
      expect(generateStudyName(study, 'lastNameYear')).toBe('Johnson (2024)');
    });

    it('should return just last name if year is missing', () => {
      const study = {
        firstAuthor: 'Smith',
        title: 'Test',
      };
      expect(generateStudyName(study, 'lastNameYear')).toBe('Smith');
    });

    it('should fall back to title if no author info', () => {
      const study = {
        title: 'My Study Title',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'lastNameYear')).toBe('My Study Title');
    });

    it('should return Untitled Study if no author or title', () => {
      const study = {};
      expect(generateStudyName(study, 'lastNameYear')).toBe('Untitled Study');
    });
  });

  describe('lastNameEtAlYear convention', () => {
    it('should not add et al. for single author', () => {
      const study = {
        firstAuthor: 'Smith',
        authors: 'Smith, John',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'lastNameEtAlYear')).toBe('Smith (2023)');
    });

    it('should add et al. for multiple authors', () => {
      const study = {
        firstAuthor: 'Smith',
        authors: 'Smith, John, Doe, Jane, and Brown, Bob',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'lastNameEtAlYear')).toBe('Smith et al. (2023)');
    });

    it('should detect multiple authors from "and" keyword', () => {
      const study = {
        firstAuthor: 'Smith',
        authors: 'Smith and Doe',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'lastNameEtAlYear')).toBe('Smith et al. (2023)');
    });

    it('should omit year if not provided', () => {
      const study = {
        firstAuthor: 'Smith',
        authors: 'Smith, John, and Doe, Jane',
      };
      expect(generateStudyName(study, 'lastNameEtAlYear')).toBe('Smith et al.');
    });
  });

  describe('authorsYear convention', () => {
    it('should show single author without et al.', () => {
      const study = {
        authors: 'Smith, John',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'authorsYear')).toBe('Smith (2023)');
    });

    it('should show two authors with ampersand', () => {
      const study = {
        authors: 'Smith, John, and Doe, Jane',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'authorsYear')).toBe('Smith & Doe (2023)');
    });

    it('should show three authors with commas and ampersand', () => {
      const study = {
        authors: 'Smith, John, Doe, Jane, and Brown, Bob',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'authorsYear')).toBe('Smith, Doe & Brown (2023)');
    });

    it('should show et al. for more than three authors', () => {
      const study = {
        authors: 'Smith, John, Doe, Jane, Brown, Bob, and Wilson, Tom',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'authorsYear')).toBe('Smith, Doe, Brown et al. (2023)');
    });

    it('should use firstAuthor if authors list is empty', () => {
      const study = {
        firstAuthor: 'Garcia',
        publicationYear: 2024,
      };
      expect(generateStudyName(study, 'authorsYear')).toBe('Garcia (2024)');
    });
  });

  describe('lastNameYearShortTitle convention', () => {
    it('should format as "LastName (Year) - Short Title"', () => {
      const study = {
        firstAuthor: 'Smith',
        publicationYear: 2023,
        title: 'Effects of Exercise on Sleep Quality in Older Adults',
      };
      const result = generateStudyName(study, 'lastNameYearShortTitle');
      expect(result).toContain('Smith (2023)');
      expect(result).toContain(' - ');
      expect(result.length).toBeLessThan(
        'Smith (2023) - Effects of Exercise on Sleep Quality in Older Adults'.length,
      );
    });

    it('should truncate title at word boundary', () => {
      const study = {
        firstAuthor: 'Smith',
        publicationYear: 2023,
        title: 'This is a very long title that should be truncated appropriately',
      };
      const result = generateStudyName(study, 'lastNameYearShortTitle');
      // Should not cut words in half
      expect(result).not.toMatch(/\s\w$/);
    });

    it('should work without year', () => {
      const study = {
        firstAuthor: 'Smith',
        title: 'Short Title',
      };
      const result = generateStudyName(study, 'lastNameYearShortTitle');
      expect(result).toBe('Smith - Short Title');
    });

    it('should work without title', () => {
      const study = {
        firstAuthor: 'Smith',
        publicationYear: 2023,
      };
      expect(generateStudyName(study, 'lastNameYearShortTitle')).toBe('Smith (2023)');
    });

    it('should fall back to truncated title if no author', () => {
      const study = {
        title: 'A Very Long Study Title That Exceeds The Normal Length',
        publicationYear: 2023,
      };
      const result = generateStudyName(study, 'lastNameYearShortTitle');
      expect(result.length).toBeLessThanOrEqual(40);
    });
  });

  describe('edge cases', () => {
    it('should handle authors with special characters', () => {
      const study = {
        authors: "O'Brien, Patrick, and McDonald, Ian",
        publicationYear: 2023,
      };
      const result = generateStudyName(study, 'authorsYear');
      expect(result).toContain("O'Brien");
    });

    it('should handle authors separated by semicolons', () => {
      const study = {
        authors: 'Smith, John; Doe, Jane',
        publicationYear: 2023,
      };
      const result = generateStudyName(study, 'authorsYear');
      expect(result).toContain('Smith');
    });

    it('should handle authors separated by ampersand', () => {
      const study = {
        authors: 'Smith, John & Doe, Jane',
        publicationYear: 2023,
      };
      const result = generateStudyName(study, 'authorsYear');
      expect(result).toContain('Smith');
      expect(result).toContain('Doe');
    });

    it('should handle null/undefined study data gracefully', () => {
      expect(generateStudyName({ title: null }, 'title')).toBe('Untitled Study');
      expect(generateStudyName({ title: undefined }, 'title')).toBe('Untitled Study');
    });

    it('should handle unknown convention by falling back to title', () => {
      const study = { title: 'My Study' };
      expect(generateStudyName(study, 'unknownConvention')).toBe('My Study');
    });
  });
});
