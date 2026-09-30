---
name: ui-component-select
description: 
events: PreToolUse
trigger_prompt: 
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx
trigger_pretool_content: <select\b
trigger_session: false
inject: full
---

# Select

**Purpose**: Dropdown selection
**Use Cases**: Single/multiple choice, filters, settings
**Features**: Search, groups, custom rendering, validation
**Location**: src/components/form/Select
**Docs**: src/components/form/Select/Select.md
