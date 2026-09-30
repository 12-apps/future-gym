---
name: ui-component-button
description: 
events: PreToolUse
trigger_prompt: 
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx
trigger_pretool_content: <button\b
trigger_session: false
inject: full
---

# Button

**Purpose**: Clickable button component
**Use Cases**: Actions, form submissions, navigation, active state indicators
**Features**: Multiple variants (solid, outline, ghost, text, glass, gradient), sizes (xs-xl), colors (primary, secondary, success, warning, info, danger, neutral), icons, loading states, disabled states, glow/pulse effects, active state support
**Location**: src/components/form/Button
**Docs**: src/components/form/Button/Button.md
