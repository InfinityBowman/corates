import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
    // For GitHub editing, change to:
    // kind: 'github',
    // repo: 'InfinityBowman/corates',
  },
  ui: {
    brand: {
      name: 'CoRATES Learn',
    },
    navigation: {
      Content: ['docs', 'tutorials', 'glossary'],
    },
  },
  collections: {
    docs: collection({
      label: 'Documentation',
      slugField: 'title',
      path: 'src/content/docs/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({
          label: 'Description',
          description: 'A brief description for search results and previews',
          multiline: true,
        }),
        category: fields.select({
          label: 'Category',
          options: [
            { label: 'Getting Started', value: 'getting-started' },
            { label: 'Evidence Synthesis', value: 'evidence-synthesis' },
            { label: 'AMSTAR-2', value: 'amstar2' },
            { label: 'Systematic Reviews', value: 'systematic-reviews' },
            { label: 'Meta-Analysis', value: 'meta-analysis' },
            { label: 'Tools & Methods', value: 'tools-methods' },
          ],
          defaultValue: 'getting-started',
        }),
        order: fields.number({
          label: 'Order',
          description: 'Display order within the category (lower numbers appear first)',
          defaultValue: 100,
        }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          description: 'Keywords for search and filtering',
          itemLabel: props => props.value,
        }),
        lastUpdated: fields.date({
          label: 'Last Updated',
          description: 'When this document was last updated',
        }),
        content: fields.markdoc({
          label: 'Content',
          description: 'The main content of the document',
        }),
      },
    }),
    tutorials: collection({
      label: 'Tutorials',
      slugField: 'title',
      path: 'src/content/tutorials/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({
          label: 'Description',
          multiline: true,
        }),
        difficulty: fields.select({
          label: 'Difficulty',
          options: [
            { label: 'Beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Advanced', value: 'advanced' },
          ],
          defaultValue: 'beginner',
        }),
        estimatedTime: fields.text({
          label: 'Estimated Time',
          description: 'e.g., "15 minutes", "1 hour"',
        }),
        prerequisites: fields.array(fields.text({ label: 'Prerequisite' }), {
          label: 'Prerequisites',
          description: 'What learners should know before starting',
          itemLabel: props => props.value,
        }),
        order: fields.number({
          label: 'Order',
          defaultValue: 100,
        }),
        content: fields.markdoc({
          label: 'Content',
        }),
      },
    }),
    glossary: collection({
      label: 'Glossary',
      slugField: 'term',
      path: 'src/content/glossary/*',
      format: { contentField: 'definition' },
      schema: {
        term: fields.slug({ name: { label: 'Term' } }),
        abbreviation: fields.text({
          label: 'Abbreviation',
          description: 'Optional abbreviation (e.g., "SR" for Systematic Review)',
        }),
        relatedTerms: fields.array(fields.text({ label: 'Related Term' }), {
          label: 'Related Terms',
          itemLabel: props => props.value,
        }),
        definition: fields.markdoc({
          label: 'Definition',
        }),
      },
    }),
  },
});
