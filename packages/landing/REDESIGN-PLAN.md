# CoRATES Landing Page Redesign Plan

## Inspiration Analysis

### Linear.app

- Dark gradient hero with subtle grid/mesh background
- Bold, concise tagline with animated text emphasis
- Large product screenshot/demo below fold
- Trust logos from notable companies
- Feature sections alternate: text left/image right, then flip
- Minimal color palette (dark bg, accent color for CTAs)
- Smooth scroll animations

### Rayyan.ai

- Animated rotating hero text ("Faster / Systematic / Literature Reviews")
- Mobile app mockup alongside desktop
- Trust logos from academic institutions
- Feature sections with screenshots showing actual product
- Testimonials carousel with real user quotes
- Integration partner logos (PubMed, Mendeley, etc.)
- Stats/social proof ("800k+ researchers")

---

## Proposed Structure & Wireframes

### 1. Hero Section

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar: Logo | About | Pricing | Sign In | Get Started]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                         CoRATES                                 │
│                                                                 │
│         ╔═══════════════════════════════════════════════╗      │
│         ║  Co  llaborative                              ║      │
│         ║  R   esearch                                  ║      │
│         ║  A   ppraisal                                 ║      │
│         ║  T   ool for                                  ║      │
│         ║  E   vidence                                  ║      │
│         ║  S   ynthesis                                 ║      │
│         ╚═══════════════════════════════════════════════╝      │
│              ↑ Each letter highlighted/accented                 │
│                                                                 │
│     Streamline quality and risk-of-bias appraisal with          │
│     real-time collaboration, automatic scoring, and             │
│     transparent workflows.                                      │
│                                                                 │
│    ┌──────────────────────┐  ┌──────────────────────┐          │
│    │  Start an Appraisal  │  │ Start a Review       │          │
│    │      (Primary)       │  │    Project           │          │
│    └──────────────────────┘  └──────────────────────┘          │
│           ↑ Quick one-off          ↑ Full project workflow      │
│             appraisal                with team collaboration    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │           [Product Screenshot / Demo Image]             │   │
│  │              showing the appraisal interface            │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│         Trusted by researchers at:                              │
│    [Logo] [Logo] [Logo] [Logo] [Logo] <- one should be SLU      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Hero Design Notes:**

- The acronym breakdown is THE key visual element
- Each first letter (C, R, A, T, E, S) should be visually highlighted (color, size, or animation)
- Consider: letters animate in one by one, or have a subtle glow/accent
- Two CTAs serve different user intents:
  - **Start an Appraisal**: Quick, single-study appraisal (NO account required) → links to checklist tool
  - **Start a Review Project**: Full team workflow (requires account) → links to sign up

**Images needed:**

- [ ] Product screenshot of main appraisal interface
- [ ] University/institution logos (or use placeholder styling)

---

### 2. Stats/Social Proof Bar

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │   500+   │    │   10+    │    │   95%    │    │   90%    │ │
│   │ Reviews  │    │ Tools    │    │ Faster   │    │ Less     │ │
│   │ Created  │    │ Supported│    │ Scoring  │    │ Errors   │ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Feature Showcase (Alternating Layout)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────┐  ┌────────────────────────────┐   │
│  │                         │  │                            │   │
│  │   [Screenshot:          │  │   Real-time Collaboration  │   │
│  │    Collaboration        │  │                            │   │
│  │    View]                │  │   Work together with your  │   │
│  │                         │  │   team in real-time. See   │   │
│  │                         │  │   updates instantly.       │   │
│  │                         │  │                            │   │
│  │                         │  │   • Independent ratings    │   │
│  │                         │  │   • Inter-rater stats      │   │
│  │                         │  │   • Conflict resolution    │   │
│  └─────────────────────────┘  └────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────┐  ┌─────────────────────────┐   │
│  │                            │  │                         │   │
│  │   Automatic Scoring        │  │   [Screenshot:          │   │
│  │                            │  │    Scoring Results      │   │
│  │   Eliminate manual errors. │  │    Summary]             │   │
│  │   Scores calculated        │  │                         │   │
│  │   instantly as you work.   │  │                         │   │
│  │                            │  │                         │   │
│  │   • AMSTAR-2 built in      │  │                         │   │
│  │   • More tools coming      │  │                         │   │
│  │   • Visual summaries       │  │                         │   │
│  └────────────────────────────┘  └─────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐  ┌────────────────────────────┐   │
│  │                         │  │                            │   │
│  │   [Screenshot:          │  │   PDF Annotation           │   │
│  │    PDF Viewer with      │  │                            │   │
│  │    Annotations]         │  │   Annotate directly on     │   │
│  │                         │  │   study PDFs. Highlights,  │   │
│  │                         │  │   notes, and comments all  │   │
│  │                         │  │   linked to checklist      │   │
│  │                         │  │   items.                   │   │
│  └─────────────────────────┘  └────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Images needed:**

- [ ] Screenshot: Collaboration/team view
- [ ] Screenshot: Scoring results/summary view
- [ ] Screenshot: PDF viewer with annotations

---

### 4. How It Works (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    How It Works                                 │
│                                                                 │
│    ┌─────────┐         ┌─────────┐         ┌─────────┐         │
│    │    1    │  ────►  │    2    │  ────►  │    3    │         │
│    │ Create  │         │  Add    │         │ Review  │         │
│    │ Project │         │ Studies │         │Together │         │
│    └─────────┘         └─────────┘         └─────────┘         │
│                                                                 │
│    [Small illustration or icon for each step]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5. Testimonials (If Available)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                What Researchers Say                             │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                                                        │    │
│  │  "CoRATES has transformed how our team conducts        │    │
│  │   systematic reviews. The collaboration features       │    │
│  │   alone save us hours every week."                     │    │
│  │                                                        │    │
│  │   — Dr. Jane Smith, University of Example              │    │
│  │                                                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│              [  •  ○  ○  ]  ← carousel dots                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6. Supported Tools / Integrations

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              Supported Appraisal Frameworks                     │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │ AMSTAR-2 │  │ Cochrane │  │  GRADE   │  │ PRISMA   │       │
│   │    ✓     │  │  Coming  │  │  Coming  │  │  Coming  │       │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7. Final CTA

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ╔═══════════════════════════════════════════════════════════╗ │
│  ║                                                           ║ │
│  ║     Ready to streamline your evidence appraisal?          ║ │
│  ║                                                           ║ │
│  ║  Start your first review in minutes. Free to get started. ║ │
│  ║                                                           ║ │
│  ║              [Get Started Free →]                         ║ │
│  ║                                                           ║ │
│  ╚═══════════════════════════════════════════════════════════╝ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 8. Footer

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  CoRATES                                                        │
│                                                                 │
│  Product          Company         Legal                         │
│  ────────         ───────         ─────                         │
│  Features         About           Privacy                       │
│  Pricing          Contact         Terms                         │
│  Changelog        Blog                                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  © 2025 CoRATES. All rights reserved.                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### Color Palette: Light Mode (CONFIRMED)

- Background: White/very light gray (#fafafa, #f8fafc)
- Hero: Light with subtle gradient or pattern for visual interest
- Text: Dark gray (#111827, #374151)
- Accent: Blue (#2563eb) for CTAs and highlights
- Cards: White with subtle shadows/borders
- Subtle background elements: Light blue gradients, mesh patterns

**Key:** Keep it clean, professional, and easy to read. Use color sparingly for emphasis.

---

### Typography

- Headlines: Bold, larger sizes (4xl-6xl)
- Body: Regular weight, good line height
- Consider: Inter (current), or add Geist/similar modern font

---

### Animations to Add

1. **Hero text rotation** - cycle through key terms
2. **Fade-in on scroll** - sections animate in as user scrolls
3. **Subtle hover effects** - cards lift, buttons glow
4. **Number counting** - stats count up when visible

---

## Images Required

### Temporary Placeholder Strategy (CONFIRMED)

Using placeholder images initially, to be replaced with real screenshots later.

**Options for placeholders:**

1. **Styled placeholder boxes** - Gray boxes with descriptive text/icons
2. **Generic UI mockups** - Abstract dashboard/interface illustrations
3. **SVG illustrations** - Simple vector graphics showing concepts
4. **Gradient cards** - Decorative cards that hint at the feature

**Recommendation:** Use styled placeholder boxes with icons/text that describe what will go there. Easy to swap out later.

### Images to Capture Later

1. **Hero product screenshot** - Main interface showing a checklist being completed
2. **Collaboration screenshot** - Multiple reviewers, real-time indicators
3. **Results/scoring screenshot** - Summary view with visual charts
4. **PDF annotation screenshot** - Showing the split view (nice to have)

### Image Specifications (for later)

- Format: PNG or WebP (for quality + compression)
- Hero image: ~1200-1400px wide
- Feature images: ~600-800px wide
- Optimize for web (use Cloudflare image optimization)

---

## Implementation Plan

### Phase 1: Core Structure

1. [ ] Update `styles.css` with new color variables and animations
2. [ ] Redesign `Hero.jsx` with animated text and dark gradient
3. [ ] Create `ProductShowcase.jsx` for hero image
4. [ ] Add `TrustLogos.jsx` component

### Phase 2: Feature Sections

5. [ ] Create new `FeatureShowcase.jsx` with alternating layout
6. [ ] Simplify `HowItWorks.jsx`
7. [ ] Remove or merge redundant sections (WhyChoose + Features overlap)

### Phase 3: Social Proof

8. [ ] Add `Stats.jsx` component
9. [ ] Add `Testimonials.jsx` carousel (placeholder content ok)
10. [ ] Update `SupportedTools.jsx` section

### Phase 4: Polish

11. [ ] Add scroll animations (intersection observer)
12. [ ] Optimize images
13. [ ] Test responsive design
14. [ ] Performance audit

---

## Decisions Made

| Question                     | Decision                                |
| ---------------------------- | --------------------------------------- |
| Screenshots                  | Use temporary placeholders, swap later  |
| Color mode                   | Light mode                              |
| "Start an Appraisal" CTA     | No account required, links to checklist |
| "Start a Review Project" CTA | Requires account, links to sign up      |
| Hero focus                   | CoRATES acronym breakdown is central    |
| Trust logos                  | SLU + placeholder institutions          |
| Testimonials                 | Placeholder quotes                      |
| Stats                        | Made-up numbers for now                 |
| Animations                   | None initially, add later               |

---

## Ready to Implement

### Phase 1: Core (Start here)

1. [x] Design decisions confirmed
2. [ ] Update `styles.css` with animations and new utility classes
3. [ ] Redesign `Hero.jsx` with acronym breakdown + two CTAs
4. [ ] Add placeholder image component

### Phase 2: Features

5. [ ] Create `FeatureShowcase.jsx` with alternating layout + placeholders
6. [ ] Simplify/update `HowItWorks.jsx`
7. [ ] Consolidate Features/WhyChoose (remove redundancy)

### Phase 3: Polish

8. [ ] Update `Footer.jsx` with new structure
9. [ ] Add scroll animations
10. [ ] Final CTA section
