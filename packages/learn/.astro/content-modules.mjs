export default new Map([
  [
    'src/content/docs/evidence-synthesis-basics.mdoc',
    () =>
      import('astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=src%2Fcontent%2Fdocs%2Fevidence-synthesis-basics.mdoc&astroContentModuleFlag=true'),
  ],
  [
    'src/content/docs/amstar2-overview.mdoc',
    () =>
      import('astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=src%2Fcontent%2Fdocs%2Famstar2-overview.mdoc&astroContentModuleFlag=true'),
  ],
  [
    'src/content/docs/introduction.mdoc',
    () =>
      import('astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=src%2Fcontent%2Fdocs%2Fintroduction.mdoc&astroContentModuleFlag=true'),
  ],
  [
    'src/content/tutorials/first-review.mdoc',
    () =>
      import('astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=src%2Fcontent%2Ftutorials%2Ffirst-review.mdoc&astroContentModuleFlag=true'),
  ],
  [
    'src/content/glossary/meta-analysis.mdoc',
    () =>
      import('astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=src%2Fcontent%2Fglossary%2Fmeta-analysis.mdoc&astroContentModuleFlag=true'),
  ],
  [
    'src/content/glossary/systematic-review.mdoc',
    () =>
      import('astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=src%2Fcontent%2Fglossary%2Fsystematic-review.mdoc&astroContentModuleFlag=true'),
  ],
  [
    'src/content/glossary/amstar-2.mdoc',
    () =>
      import('astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=src%2Fcontent%2Fglossary%2Famstar-2.mdoc&astroContentModuleFlag=true'),
  ],
]);
