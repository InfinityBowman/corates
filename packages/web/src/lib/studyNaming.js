/**
 * Study Naming Conventions
 * Utilities for generating study names based on project settings
 */

/**
 * Available naming convention options
 */
export const NAMING_CONVENTIONS = [
  {
    id: 'shortTitle',
    label: 'Short Title',
    description: 'Abbreviated title (max 30 characters)',
    example: 'Effects of Exercise on Sleep',
  },
  {
    id: 'title',
    label: 'Full Title',
    description: 'Use the complete study title',
    example: 'Effects of Exercise on Sleep Quality: A Systematic Review and Meta-Analysis',
  },
  {
    id: 'lastNameYear',
    label: 'Last Name (Year)',
    description: 'First author last name and publication year',
    example: 'Smith (2023)',
  },
  {
    id: 'lastNameYearShortTitle',
    label: 'Last Name (Year) - Short Title',
    description: 'First author, year, and abbreviated title',
    example: 'Smith (2023) - Effects of Exercise',
  },
];

/**
 * Extract the last name from a full author name
 * Handles formats like "Smith, John" or "John Smith"
 * @param {string} authorName - The author's full name
 * @returns {string} The last name
 */
function extractLastName(authorName) {
  if (!authorName) return '';

  const trimmed = authorName.trim();

  // Handle "LastName, FirstName" format
  if (trimmed.includes(',')) {
    return trimmed.split(',')[0].trim();
  }

  // Handle "FirstName LastName" format
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

/**
 * Parse the authors string into an array of author names
 * @param {string} authorsString - The authors string (e.g., "Smith, John, Jones, Jane, and Brown, Bob")
 * @returns {string[]} Array of author names
 */
function parseAuthors(authorsString) {
  if (!authorsString) return [];

  // Handle common author list separators
  // Remove "and" or "&" connectors and split by commas or semicolons
  const cleaned = authorsString
    .replace(/,?\s+and\s+/gi, ', ')
    .replace(/\s*&\s*/g, ', ')
    .replace(/;\s*/g, ', ');

  // Split by comma, but keep "LastName, FirstName" pairs together
  const parts = cleaned.split(/,\s*/);
  const authors = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    // Check if next part looks like a first name (no comma, relatively short)
    if (i + 1 < parts.length) {
      const nextPart = parts[i + 1]?.trim();
      // If current part looks like a last name and next looks like a first name
      if (nextPart && !nextPart.includes(' ') && nextPart.length < 20) {
        authors.push(`${part}, ${nextPart}`);
        i++; // Skip the next part as we've consumed it
        continue;
      }
    }

    authors.push(part);
  }

  return authors;
}

/**
 * Truncate a title to a maximum length, ending at a word boundary
 * @param {string} title - The full title
 * @param {number} maxLength - Maximum characters
 * @returns {string} Truncated title
 */
function truncateTitle(title, maxLength = 30) {
  if (!title || title.length <= maxLength) return title;

  const truncated = title.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.6) {
    return truncated.substring(0, lastSpace);
  }

  return truncated;
}

/**
 * Generate a study name based on the naming convention
 * @param {Object} studyData - Study data with title, firstAuthor, publicationYear, authors
 * @param {string} convention - The naming convention ID
 * @returns {string} The generated study name
 */
export function generateStudyName(studyData, convention = 'title') {
  const { title, firstAuthor, publicationYear, authors } = studyData;

  // Fall back to title if we don't have the required metadata
  const hasAuthorInfo = firstAuthor || authors;
  const hasYear = publicationYear;

  switch (convention) {
    case 'shortTitle': {
      return truncateTitle(title) || 'Untitled Study';
    }

    case 'lastNameYear': {
      if (!hasAuthorInfo) return title || 'Untitled Study';
      const lastName = firstAuthor || extractLastName(parseAuthors(authors)[0]);
      if (hasYear) {
        return `${lastName} (${publicationYear})`;
      }
      return lastName || title || 'Untitled Study';
    }

    case 'lastNameYearShortTitle': {
      if (!hasAuthorInfo) return truncateTitle(title) || 'Untitled Study';
      const lastName = firstAuthor || extractLastName(parseAuthors(authors)[0]);
      const shortTitle = truncateTitle(title, 30);

      let name = lastName;
      if (hasYear) {
        name += ` (${publicationYear})`;
      }
      if (shortTitle) {
        name += ` - ${shortTitle}`;
      }
      return name || title || 'Untitled Study';
    }

    case 'title':
    default:
      return title || 'Untitled Study';
  }
}

/**
 * Get the default naming convention
 * @returns {string} The default convention ID
 */
export function getDefaultNamingConvention() {
  return 'shortTitle';
}