# Technical Specifications Rules

This directory contains rules for writing effective technical specifications, organized by source book.

## Writing Standards

### 1. `software-requirements-karl-wieczorek.mdc`

**Source:** "Software Requirements" by Karl Wieczorek  
**Focus:** The "Bible" of defining exactly what needs to be built.

**Key Topics:**

- Mandatory language ("Shall" vs "Should")
- Atomic requirements
- Verifiability
- MoSCoW prioritization
- User needs vs system requirements
- Business rules
- Negative requirements

### 2. `docs-for-developers-jared-bhatti.mdc`

**Source:** "Docs for Developers" by Jared Bhatti et al.  
**Focus:** Managing the documentation lifecycle within a tech team.

**Key Topics:**

- Audience awareness
- Problem statement first
- High-level architecture diagrams
- Code snippets and API contracts
- Breaking changes
- Deployment steps
- Troubleshooting sections
- Peer reviews

### 3. `living-documentation-cyrille-martraire.mdc`

**Source:** "Living Documentation" by Cyrille Martraire  
**Focus:** Keeping specs relevant and making them "attractive" through automation.

**Key Topics:**

- Low-maintenance documentation
- Extract specs from code
- Executable specifications
- Ubiquitous language
- Knowledge gaps
- Design rationale
- Decision logs (ADRs)
- Technical debt documentation

### 4. `elements-of-style-strunk-white.mdc`

**Source:** "The Elements of Style" by Strunk & White  
**Focus:** The fundamental rules of writing that make a spec "Attractive" and professional.

**Key Topics:**

- Omit needless words
- Active voice
- Positive form
- Definite, specific language
- Parallelism
- Figures for numbers
- Revision and rewriting

## Visual Design Standards

### 5. `visual-display-quantitative-information-edward-tufte.mdc`

**Source:** "The Visual Display of Quantitative Information" by Edward Tufte  
**Focus:** Minimalismo gráfico y máxima precisión.

**Key Topics:**

- Maximize data-ink ratio
- Eliminate chartjunk
- Small multiples
- Visual integrity
- Direct labels
- Context provision
- Typography and color
- Tables and layout

### 6. `functional-art-alberto-cairo.mdc`

**Source:** "The Functional Art" by Alberto Cairo  
**Focus:** Gráficos que funcionan como herramientas cognitivas.

**Key Topics:**

- Form follows function
- Cognitive load management
- Visual hierarchy
- Diagram clarity
- Gestalt laws
- Standard icons
- Visual path
- Consistency

### 7. `non-designers-design-book-robin-williams.mdc`

**Source:** "The Non-Designer's Design Book" by Robin Williams  
**Focus:** Estilo, división de contenido y maquetación (Las 4 reglas CRAP).

**Key Topics:**

- Contrast (C)
- Repetition (R)
- Alignment (A)
- Proximity (P)
- Typography
- Content formatting
- Professional fonts

## Architecture & Data Modeling Standards

### 8. `fundamentals-software-architecture-richards-ford.mdc`

**Source:** "Fundamentals of Software Architecture" by Mark Richards & Neal Ford  
**Focus:** Cómo diagramar decisiones técnicas y estructuras complejas.

**Key Topics:**

- C4 Model (Context, Containers, Components, Code)
- Context diagrams first
- Flow and sequence diagrams
- Architecture elements (couplings, bounded contexts)
- Diagram quality
- Diagrams as code
- ADRs (Architecture Decision Records)

### 9. `data-model-scorecard-steve-hoberman.mdc`

**Source:** "Data Model Scorecard" by Steve Hoberman  
**Focus:** Reglas para gráficos de bases de datos y modelos de entidad-relación.

**Key Topics:**

- Standard ERD notation (IE/Crow's Foot)
- Entities as nouns
- Cardinality (1:1, 1:N, N:N)
- Avoid M:N relationships
- Optionality (solid vs dashed)
- Model organization
- Data model details
- Normalization (3NF)

### 10. `information-architecture-rosenfeld.mdc`

**Source:** "Information Architecture: For the Web and Beyond" by Rosenfeld et al.  
**Focus:** Flujos de navegación y estructuras de información.

**Key Topics:**

- Design for scanning
- User flows
- Low-fidelity wireframes
- Navigation and labeling
- Flow diagram design
- Swimlanes
- Empty and error states
- Minimize clicks
- Accessibility

### 11. `pyramid-principle-barbara-minto.mdc`

**Source:** "The Pyramid Principle" by Barbara Minto  
**Focus:** Estructura lógica del contenido (IDEAL para Tech Specs).

**Key Topics:**

- Main idea first
- Pyramid format (summary → key points → details)
- Group related ideas (3-5 items)
- Logical order
- MECE structure (Mutually Exclusive, Collectively Exhaustive)
- Comparison tables
- Graphics for complex relationships
- Document symmetry
- Clear next steps

### 12. `documenting-software-architectures-clements.mdc`

**Source:** "Documenting Software Architectures" by Paul Clements et al.  
**Focus:** Estándares profesionales para elegir qué vista del sistema mostrar.

**Key Topics:**

- Multiple views (module, component, allocation)
- Formal notation definition
- Execution environment
- Deployment maps
- Ports and connectors
- Layer diagrams
- Sequence diagrams for use cases
- Shared resources
- Concurrency indication
- Security boundaries
- Quality attributes
- Progressive disclosure
- State machines
- Error handling in flows
- Diagram index

### 13. `domain-driven-design-eric-evans.mdc`

**Source:** "Domain-Driven Design: Tackling Complexity" by Eric Evans  
**Focus:** Cómo usar el lenguaje y los gráficos para modelar procesos de negocio.

**Key Topics:**

- Ubiquitous language
- Bounded contexts visualization
- Context maps
- Entities vs Value Objects
- Aggregates
- Domain events
- Anti-corruption layers
- Hexagonal architecture
- CQRS (Read/Write separation)
- Core domain highlighting
- Domain invariants
- Sagas for long transactions
- Eventual vs immediate consistency
- Data mappings between contexts

### 14. `graphic-design-for-non-designers-seddon-waterhouse.mdc`

**Source:** "Graphic Design for Non-Designers" by Tony Seddon & Jane Waterhouse  
**Focus:** Estilo visual para que el documento no parezca un "borrador" de Word.

**Key Topics:**

- Grid system for alignment
- Technical color palette
- Monospaced fonts for code
- Typographic hierarchy
- No shadows (flat design)
- Rounded vs sharp borders
- White space as separator
- Arrow styles (closed vs open)
- Flat iconography
- High-resolution graphics
- Table header styling
- Consistent callout boxes
- Visual table of contents
- Dark mode compatibility
- Style guide appendix

## Usage

Each file contains specific rules and best practices from its source book. Use these rules when:

1. **Writing technical specifications** - Reference writing standards
2. **Creating diagrams** - Follow visual design standards
3. **Designing architecture** - Use architecture diagramming rules
4. **Modeling data** - Apply data modeling standards
5. **Structuring documents** - Follow pyramid principle
6. **Documenting architecture** - Use multiple views and formal notation
7. **Modeling domain** - Apply DDD principles and ubiquitous language
8. **Styling documents** - Use professional graphic design principles

## Consolidated Rules

For a consolidated view of all rules, see:

- `.cursor/rules/technical-specifications.mdc` - Main consolidated file with all rules

---

**Key Principle:** A great technical specification is well-written, visually structured, logically organized, and architecturally sound. The visual design and logical structure determine whether the team will read the document or ignore it.
