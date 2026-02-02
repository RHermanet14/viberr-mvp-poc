# Prompt Optimization Guide - Component Dependencies

This document maps each operation type and prompt pattern to the specific guidance blocks it needs. This allows us to only include relevant guidance, reducing token usage and preventing timeouts.

## Operation Type Analysis

### 1. REORDER/MOVE Operations
**Patterns:** `move`, `reorder`, `to top`, `to the front`, `to the beginning`, `at top`
**Example:** "move the pie chart to the top", "reorder chart1 to front"

**Needs:**
- ✅ **Reorder guidance** - How to use reorder_component with newIndex
- ✅ **Component IDs** - Need to know which components exist
- ❌ KPI guidance (not adding KPIs)
- ❌ Top N table filtering (not filtering tables)
- ❌ Font guidance (not changing fonts)
- ❌ Image guidance (not adding images)
- ❌ Pie chart by category (not adding pie charts)
- ❌ DataSource guidance (not adding components)

**Required Schema Info:**
- Component IDs and types (minimal - just need to know what exists)

---

### 2. ADD COMPONENT Operations

#### 2a. Add KPI
**Patterns:** `add kpi`, `create kpi`, `show kpi`, `total items`, `avg price`, `average price`
**Example:** "add a KPI for total items", "show average price"

**Needs:**
- ✅ **KPI dataSource guidance** - CRITICAL: Must include dataSource="/api/data"
- ✅ **Component structure** - How to structure KPI component
- ✅ **Reorder guidance** - If "at top" is mentioned
- ❌ Top N table filtering (different operation)
- ❌ Font guidance (not changing fonts)
- ❌ Image guidance (not adding images)
- ❌ Pie chart by category (different component)

**Required Schema Info:**
- Component IDs/types (to avoid duplicates)
- Existing KPI structure (if any)

#### 2b. Add Chart (including Pie Chart)
**Patterns:** `add chart`, `pie chart`, `bar chart`, `line chart`, `by category`, `by month`
**Example:** "add pie chart by category", "bar chart by month"

**Needs:**
- ✅ **Chart dataSource guidance** - Default to /api/data/summary, or /api/data for "by category"
- ✅ **Pie chart by category guidance** - If "by category" mentioned
- ✅ **Component structure** - How to structure chart component
- ✅ **Reorder guidance** - If "at top" is mentioned
- ❌ KPI guidance (different component)
- ❌ Top N table filtering (different operation)
- ❌ Font guidance (not changing fonts)
- ❌ Image guidance (not adding images)

**Required Schema Info:**
- Component IDs/types (to avoid duplicates)
- Existing chart structure (if any)

#### 2c. Add Image
**Patterns:** `add image`, `show image`, `display image`, `image with url`
**Example:** "add image with url https://...", "show image"

**Needs:**
- ✅ **Image URL guidance** - CRITICAL: Only use user-provided URLs
- ✅ **Image placeholder guidance** - If URLs were extracted
- ✅ **Component structure** - How to structure image component
- ✅ **Reorder guidance** - If "at top" is mentioned
- ❌ KPI guidance (different component)
- ❌ Chart guidance (different component)
- ❌ Top N table filtering (different operation)
- ❌ Font guidance (not changing fonts)

**Required Schema Info:**
- Component IDs/types (to avoid duplicates)
- Extracted URLs (if any)

#### 2d. Add Table
**Patterns:** `add table`, `create table`, `show table`
**Example:** "add a table", "create new table"

**Needs:**
- ✅ **Table structure guidance** - How to structure table component
- ✅ **Reorder guidance** - If "at top" is mentioned
- ❌ KPI guidance (different component)
- ❌ Chart guidance (different component)
- ❌ Top N table filtering (only if filtering existing table)
- ❌ Font guidance (not changing fonts)
- ❌ Image guidance (not adding images)

**Required Schema Info:**
- Component IDs/types (to avoid duplicates)
- Existing table structure (if any)

#### 2e. Add Text
**Patterns:** `add text`, `create text`, `show text`, `heading`
**Example:** "add a heading", "create text component"

**Needs:**
- ✅ **Text structure guidance** - How to structure text component
- ✅ **Reorder guidance** - If "at top" is mentioned
- ❌ KPI guidance (different component)
- ❌ Chart guidance (different component)
- ❌ Top N table filtering (different operation)
- ❌ Image guidance (not adding images)
- ⚠️ **Font guidance** - Only if font style is mentioned in same prompt

**Required Schema Info:**
- Component IDs/types (to avoid duplicates)

---

### 3. REMOVE/DELETE Operations
**Patterns:** `remove`, `delete`, `hide`, `get rid of`
**Example:** "remove the pie chart", "delete chart1"

**Needs:**
- ✅ **Component IDs** - Need to know which components exist
- ❌ All component-specific guidance (not adding anything)
- ❌ Top N table filtering (not filtering)
- ❌ Font guidance (not changing fonts)
- ❌ Image guidance (not adding images)
- ❌ DataSource guidance (not adding components)

**Required Schema Info:**
- Component IDs and types (minimal - just need to know what exists)

---

### 4. STYLE Operations

#### 4a. Font Style Changes
**Patterns:** `font`, `typeface`, `typography`, `gothic`, `elegant`, `modern`, `bold`, `change font`
**Example:** "make the font gothic", "use modern typography", "change font to Roboto"

**Needs:**
- ✅ **Font style interpretation** - Mapping vague terms to Google Fonts
- ✅ **Font structure guidance** - How to set fontFamily in style
- ✅ **Component IDs** - Which components to style
- ❌ KPI guidance (not adding KPIs)
- ❌ Chart guidance (not adding charts)
- ❌ Top N table filtering (not filtering)
- ❌ Image guidance (not adding images)
- ❌ DataSource guidance (not adding components)

**Required Schema Info:**
- Component IDs/types and current styles (to apply fonts)

#### 4b. Color/Style Changes (non-font)
**Patterns:** `color`, `background`, `border`, `shadow`, `padding`, `margin`, `size`, `bigger`, `smaller`
**Example:** "make it red", "bigger padding", "add shadow"

**Needs:**
- ✅ **Style structure guidance** - How to use set_style with paths
- ✅ **Component IDs** - Which components to style
- ❌ Font guidance (not changing fonts)
- ❌ KPI guidance (not adding KPIs)
- ❌ Chart guidance (not adding charts)
- ❌ Top N table filtering (not filtering)
- ❌ Image guidance (not adding images)
- ❌ DataSource guidance (not adding components)

**Required Schema Info:**
- Component IDs/types and current styles

---

### 5. FILTER/SORT Operations
**Patterns:** `sort`, `filter`, `top N`, `show only top`, `by price`, `by date`, `ascending`, `descending`
**Example:** "sort by price", "show only top 10", "filter by category"

**Needs:**
- ✅ **Top N guidance** - How to set filters/limit, filters/sortBy, filters/sortOrder
- ✅ **Sort guidance** - How to use filters/sortBy and filters/sortOrder
- ✅ **Table component info** - Need to know table exists (for context)
- ❌ KPI guidance (not adding KPIs)
- ❌ Chart guidance (not adding charts)
- ❌ Font guidance (not changing fonts)
- ❌ Image guidance (not adding images)
- ❌ DataSource guidance (not adding components)
- ❌ Reorder guidance (not reordering components)

**Required Schema Info:**
- Current filters (if any)
- Table component existence (for context)

---

### 6. THEME Operations
**Patterns:** `dark mode`, `light mode`, `theme`, `background color`, `primary color`
**Example:** "make it dark mode", "change theme to light", "set primary color to red"

**Needs:**
- ✅ **Theme structure guidance** - How to set theme properties
- ✅ **Component IDs** - To apply theme to existing components (if vague request)
- ⚠️ **Font guidance** - Only if font is mentioned in same prompt
- ❌ KPI guidance (not adding KPIs)
- ❌ Chart guidance (not adding charts)
- ❌ Top N table filtering (not filtering)
- ❌ Image guidance (not adding images)
- ❌ DataSource guidance (not adding components)

**Required Schema Info:**
- Current theme
- Component IDs/types (if applying to components)

---

### 7. VAGUE REQUESTS ("like X")
**Patterns:** `like`, `similar`, `make it`, `style of`, `look like`, `resemble`, `inspired by`, brand names
**Example:** "make it like netflix", "style of uber", "look like spotify"

**Needs:**
- ✅ **Vague request chain-of-thought** - Brand identification, color extraction
- ✅ **Theme structure guidance** - How to set theme colors
- ✅ **Component styling guidance** - Apply colors to all components
- ✅ **Font guidance** - May need font changes for brand style
- ✅ **Component IDs** - Need all component IDs to apply theme
- ❌ KPI guidance (not adding KPIs unless mentioned)
- ❌ Chart guidance (not adding charts unless mentioned)
- ❌ Top N table filtering (not filtering unless mentioned)
- ❌ Image guidance (not adding images unless mentioned)
- ❌ DataSource guidance (not adding components unless mentioned)

**Required Schema Info:**
- All component IDs/types and minimal styles
- Current theme

---

### 8. LAYOUT Operations
**Patterns:** `columns`, `layout`, `two column`, `three column`, `grid`
**Example:** "two column layout", "change to 3 columns"

**Needs:**
- ✅ **Layout structure guidance** - How to set layout/columns
- ✅ **Component IDs** - To understand current layout
- ❌ KPI guidance (not adding KPIs)
- ❌ Chart guidance (not adding charts)
- ❌ Top N table filtering (not filtering)
- ❌ Font guidance (not changing fonts)
- ❌ Image guidance (not adding images)
- ❌ DataSource guidance (not adding components)

**Required Schema Info:**
- Current layout
- Component IDs/types (for context)

---

## Multi-Intent Handling

When a prompt contains multiple operations (e.g., "add KPI and make it dark mode"):
- Combine all relevant guidance blocks
- Include component IDs for all operations
- Include schema info for all affected areas

---

## Implementation Strategy

1. **Analyze prompt** to determine operation types
2. **Build guidance set** based on operation types
3. **Include only relevant guidance** in userPrompt
4. **Optimize schema** based on operation types (already done in schemaOptimizer)

## Decision Matrix

| Operation Type | Reorder | KPI | Chart | Image | Top N | Font | Style | Theme | Vague |
|---------------|---------|-----|-------|-------|-------|------|-------|-------|-------|
| Reorder/Move | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add KPI | ✅* | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add Chart | ✅* | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add Image | ✅* | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add Table | ✅* | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Add Text | ✅* | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ |
| Remove | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Font Style | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Color/Style | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Filter/Sort | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Theme | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ❌ |
| Vague | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ |

Legend:
- ✅ = Always needed
- ⚠️ = Conditionally needed (if mentioned in prompt)
- ❌ = Not needed
- * = Only if "at top" is mentioned

---

## Notes

- **Reorder guidance** is needed whenever "at top", "to front", "move to beginning" is mentioned, regardless of operation type
- **Font guidance** is needed for vague requests because brand styles often include font changes
- **Top N guidance** is only needed when explicitly filtering/sorting tables, not when adding components
- **DataSource guidance** is critical for KPIs and charts, but not needed for other operations
- **Component IDs** are always needed to avoid duplicates and reference existing components
