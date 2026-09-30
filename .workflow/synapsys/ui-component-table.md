---
name: ui-component-table
description: 
events: PreToolUse
trigger_prompt: 
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx
trigger_pretool_content: <table\b
trigger_session: false
inject: full
---

# Table

**Purpose**: Display tabular data
**Use Cases**: Simple data tables, lists with columns, comparison tables
**Features**: Sorting, row selection, responsive, customizable cells
**Location**: src/components/data-display/Table
**Docs**: src/components/data-display/Table/Table.md
