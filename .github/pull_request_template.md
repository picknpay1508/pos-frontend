# 🔒 STEP 2 — APPROVAL & SCOPE CONFIRMATION (MANDATORY)

⚠️ **This PR MUST NOT be opened unless the PLAN has been explicitly approved.**  
If approval was not given, this PR must be closed immediately.

---

## ✅ APPROVAL CONFIRMATION

**Explicit approval received?**  
- [ ] YES — “Approved. Proceed.” was given
- [ ] NO — STOP (Do not open this PR)

**Approval reference (paste exact message or link):**
> 

---

## 🎯 OBJECTIVE (From Approved Plan)

Briefly restate the approved objective (1–2 sentences):

> 

---

## 📁 FILES CHANGED (MUST MATCH APPROVED PLAN)

List **only** files approved in Step 2:

- 
- 

🚫 **Any unapproved file = PR REJECTION**

---

## 🚫 FILES NOT TOUCHED (CONFIRMATION)

Explicitly confirm files that were NOT modified:

- Database schema / migrations
- Historical data logic
- Shared utilities
- Unrelated UI or backend logic

---

## 🗄️ DATABASE IMPACT

- [ ] NO database changes (schema, triggers, functions, data)
- [ ] YES — Explicit approval attached (link below)

If YES, provide approval reference:
> 

🚨 **Unapproved DB changes will fail CI**

---

## ⚠️ RISK LEVEL (From Approved Plan)

- [ ] LOW
- [ ] MEDIUM
- [ ] HIGH

Explain briefly:
> 

---

## 🧪 VERIFICATION STEPS

Provide **exact steps** to verify this change:

1. 
2. 
3. 

---

## 🧠 RULES COMPLIANCE CHECK

Confirm compliance with all rules:

- [ ] CRITICAL-RULES.md followed
- [ ] No scope creep
- [ ] No silent refactors
- [ ] No assumptions made
- [ ] Tenant isolation preserved

---

## ❌ AUTOMATIC REJECTION CONDITIONS

This PR must be rejected if **ANY** of the following are true:

- Plan was not approved
- Files changed differ from approved list
- Database touched without approval
- Unrelated logic was modified
- CRITICAL-RULES.md was violated

---

## 📜 CHANGELOG ENTRY

Changelog entry added?

- [ ] YES
- [ ] NOT REQUIRED (explain why)

---

## 🧾 FINAL DECLARATION

I confirm this PR:
- Implements **only** the approved plan
- Introduces **no hidden changes**
- Preserves existing behavior
- Complies with all critical rules

**Signature (AI agent or human):**
> 

**Date:**
> 

---

🚨 **If anything above is incomplete or false, this PR must not be merged.**
