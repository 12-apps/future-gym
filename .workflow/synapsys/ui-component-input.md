---
name: ui-component-input
description: 
events: PreToolUse
trigger_prompt: 
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx
trigger_pretool_content: <input\b
trigger_session: false
inject: full
---

# Input

**Purpose**: Text input field
**Use Cases**: Text entry, search, forms
**Features**: Multiple types, validation, icons, prefix/suffix, disabled/readonly states
**Location**: src/components/form/Input
**Docs**: src/components/form/Input/Input.md
