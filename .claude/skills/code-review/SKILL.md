# Code Review Instructions (Markdown Report Output)

## Description

Perform a code review for the given pull request and produce a single Markdown (.md) report containing all validated findings.

---

## Agent assumptions (applies to all agents and subagents)

- All tools are functional and will work without error.
- Do not test tools or make exploratory calls.
- Only call a tool if it is required to complete the task.
- GitHub access, if used, is read-only.

---

## High-level goal

Produce a Markdown file that includes:

- Pull request metadata
- Review summary
- Validated high-signal issues (if any)
- References to relevant code locations and CLAUDE.md rules

---

## Step-by-step process

### 0. Create a TODO list

Before starting, create a private TODO list outlining each step of the review.

---

### 1. Gate check (haiku agent)

Launch a haiku agent to determine if any of the following are true:

- The pull request is closed
- The pull request is a draft
- The pull request does not need code review
- Claude has already commented on this PR

If any condition is true:

- Stop immediately
- Produce a Markdown report containing only:
  - Pull request metadata
  - Reason the review was skipped

Note: Still review Claude-generated PRs.

---

### 2. Locate applicable CLAUDE.md files (haiku agent)

Launch a haiku agent to return a list of file paths (not contents) for all relevant CLAUDE.md files, including:

- The root CLAUDE.md file, if it exists
- Any CLAUDE.md files in directories containing files modified by the pull request

Record these paths in the report.

---

### 3. Summarize the pull request (sonnet agent)

Launch a sonnet agent to:

- View the pull request
- Capture the pull request title and description
- Produce a concise summary of the changes

Include this information in the report.

---

### 4. Parallel review (4 agents)

Launch four agents in parallel. Each agent returns a list of issues, where each issue includes:

- A description
- The reason it was flagged

Each agent is given the pull request title and description.

Agents 1 and 2:

- Sonnet agents
- Audit changes for CLAUDE.md compliance
- Only consider CLAUDE.md files that apply by directory scope

Agents 3 and 4:

- Opus agents
- Scan only the diff
- Look for bugs, logic errors, security issues, or incorrect behavior
- Ignore style, quality, and speculative issues

---

### 5. Validation phase

For each issue raised by agents 3 and 4:

- Launch a validation subagent

Validation rules:

- Use opus subagents for bugs and logic errors
- Use sonnet subagents for CLAUDE.md violations
- Confirm with high confidence that:
  - The issue is real
  - The issue is caused by the changes in the pull request
  - Any cited CLAUDE.md rule applies to the affected file

Discard any issue that cannot be validated.

---

### 6. Filter to high-signal issues

Keep only issues that meet at least one of the following:

- The code will fail to compile or parse
- The code will produce incorrect results regardless of input
- There is a clear, unambiguous CLAUDE.md violation

Do not include:

- Style or formatting issues
- Hypothetical or input-dependent issues
- Linter-detectable issues
- Pre-existing issues
- General code quality concerns

---

### 7. Report generation

Generate a single Markdown file.

For each issue, use the following format:

```md
### Issue: <short title>

**Type:** Bug | Logic Error | CLAUDE.md Violation  
**Severity:** High  
**Reason flagged:** <agent-provided reason>

**Description:**  
Clear explanation of the problem.

**Evidence:**

- File path and line range (for example: `src/foo/bar.ts:42-58`)
- Include at least one line of context before and after the relevant lines

**Relevant Rule (if applicable):**  
Quoted CLAUDE.md rule with its file path.

**Suggested Fix:**  
Description of the fix. Include a committable suggestion only if it fully resolves the issue.

⸻

8. No-issue outcome

If no validated issues remain, the Markdown file must contain:

## Code review

No issues found. Checked for bugs and CLAUDE.md compliance.

⸻

Explicit prohibitions
• Do not post GitHub comments
• Do not post inline comments
• Do not modify the repository
• Output only the Markdown report
```
