# Corpus Authoring Guide

Your templates are the competitive moat. This guide explains how to write, tag,
and structure them so the RAG pipeline retrieves the right content at the right stage.

## File structure

```
corpus/templates/
  {section}/
    {industry}-v{n}.md    e.g. financials/saas-v1.md
    general-v1.md         industry=general is the fallback for all industries
```

## Frontmatter (required on every file)

```yaml
---
doc_type: template        # template | example | framework
section: financials       # see section list below
industry: saas            # saas | retail | healthcare | marketplace | general
tier_gate: starter        # free | starter | pro | business
version: v1               # bump on significant rewrites; old versions kept for rollback
---
```

### Section IDs — use exactly these strings

| `section` value         | Pipeline stage |
|------------------------|----------------|
| `executive_summary`    | Preview + full plan |
| `market_analysis`      | Full plan only |
| `competitive_landscape`| Full plan only |
| `operations`           | Full plan only |
| `financials`           | Full plan only |
| `general`              | Fallback for multi-section templates |

### Tier gate

| Value | Who retrieves it |
|-------|-----------------|
| `free` | Free preview users |
| `starter` | Starter and above |
| `pro` | Pro and above |
| `business` | Business only |

## Writing for high RAG quality

### Use markdown headings for section-aware chunking

The ingest script splits on `#`, `##`, `###`. Keep each heading block
focused on one concept so chunks stay coherent.

```markdown
## Revenue forecast (3 years)

| Metric | Year 1 | Year 2 | Year 3 |
...

## Cost structure

- COGS: hosting, payment processing
...
```

### Include retrieval hints at the bottom

The pipeline embeds the full chunk, so embedding-friendly phrases at
the end improve similarity matching:

```markdown
## Retrieval hints
Use for: SaaS subscription models, B2B, recurring revenue, unit economics.
```

### Template variables (the LLM fills these in)

Use double-brace syntax. The stage runner replaces known variables;
others serve as prompts to the model:

```
{{company_name}}
{{target_market}}
{{year_1_revenue_target}}
{{founder_background}}
```

### Don't pad — be specific

Templates are retrieved by similarity, not length. A focused 400-word
section outperforms a padded 1,500-word one. Quality beats quantity.

## Ingesting your templates

```powershell
# Dry run first — shows chunks without writing to DB
cd apps/api
.\.venv\Scripts\python.exe ..\..\scripts\ingest\ingest_corpus.py `
  --corpus-dir ..\..\corpus\templates `
  --dry-run

# Live ingest
$env:DATABASE_URL = "postgresql://buildblock_app:{PASSWORD}@{HOST}:5432/buildblock"
.\.venv\Scripts\python.exe ..\..\scripts\ingest\ingest_corpus.py `
  --corpus-dir ..\..\corpus\templates
```

## Re-ingesting after edits

Edit the file, then re-ingest that file only:

```powershell
.\.venv\Scripts\python.exe ..\..\scripts\ingest\ingest_corpus.py `
  --file ..\..\corpus\templates\financials\saas-v2.md
```

Or use the admin dashboard: `/admin/corpus` → Re-ingest button.

## Versioning strategy

1. Bump the `version` field in frontmatter (e.g. `v1` → `v2`)
2. Re-ingest — the old version row is replaced
3. Old version is deactivated automatically (new active version takes its place)
4. Roll back in admin: `/admin/corpus` → Disable new version → Enable old

## Sections to build out (priority order)

Start with `general` industry variants, then add industry-specific ones
as you see which industries your users search for most.

| Priority | Section | Notes |
|----------|---------|-------|
| P0 | `executive_summary` | Free tier preview — must be strong |
| P0 | `financials` | Most user scrutiny; separate by industry |
| P1 | `market_analysis` | Size/trend data by industry |
| P1 | `competitive_landscape` | Porter's Five Forces, positioning maps |
| P2 | `operations` | Org chart, hiring plan, processes |

Target: 3–5 templates per section × 5 industries = ~75 documents, ~500 chunks.
That's a solid moat. 10 documents is a minimum viable corpus.
