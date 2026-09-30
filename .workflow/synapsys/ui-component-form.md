---
name: ui-component-form
description: 
events: PreToolUse
trigger_prompt: 
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx
trigger_pretool_content: <form\b
trigger_session: false
inject: full
---

# Form

**Purpose**: Form container with validation
**Use Cases**: Data entry, user input collection, settings
**Features**: Validation, error handling, submission handling
**Location**: src/components/form/Form
**Docs**: src/components/form/Form/Form.md
