---
name: ui-component-dialog
description: 
events: PreToolUse
trigger_prompt: 
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx
trigger_pretool_content: <dialog\b
trigger_session: false
inject: full
---

# Dialog

**Purpose**: Display modal dialogs
**Use Cases**: Confirmations, forms, detailed information, alerts
**Features**: Backdrop, animations, customizable size, accessibility
**Location**: src/components/feedback/Dialog
**Docs**: src/components/feedback/Dialog/Dialog.md
