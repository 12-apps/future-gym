---
name: ui-component-textarea
description: 
events: PreToolUse
trigger_prompt: 
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx
trigger_pretool_content: <textarea\b
trigger_session: false
inject: full
---

# Textarea

**Purpose**: Multi-line text input
**Use Cases**: Comments, descriptions, long-form text
**Features**: Auto-resize, character count, validation
**Location**: src/components/form/Textarea
**Docs**: src/components/form/Textarea/Textarea.md
