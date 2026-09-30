---
name: ui-component-typography
description: 
events: PreToolUse
trigger_prompt: 
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx
trigger_pretool_content: <(p|h[1-6]|span)\b
trigger_session: false
inject: full
---

# Heading

**Purpose**: Section headings
**Use Cases**: Page titles, section headers, hierarchy
**Features**: Multiple levels (h1-h6), variants, responsive sizing
**Location**: src/components/typography/Heading
**Docs**: src/components/typography/Heading/Heading.md

---

# Paragraph

**Purpose**: Body text paragraphs
**Use Cases**: Content text, descriptions, articles
**Features**: Size variants, leading control, text alignment
**Location**: src/components/typography/Paragraph
**Docs**: src/components/typography/Paragraph/Paragraph.md

---

# Text

**Purpose**: Inline text with formatting
**Use Cases**: Labels, captions, body text, emphasis
**Features**: Size variants, weight, color, truncation
**Location**: src/components/typography/Text
**Docs**: src/components/typography/Text/Text.md
