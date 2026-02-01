# Security Policy

## 🔒 Reporting a Vulnerability

We take security seriously in Power-Toolkit. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report security issues through one of these channels:

1. **GitHub Security Advisories** (Preferred)
   - Go to the [Security tab](https://github.com/khawatme/Power-Toolkit/security)
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email**
   - Send details to the maintainers privately
   - Include "SECURITY" in the subject line

### What to Include

Please include the following in your report:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Affected versions** of Power-Toolkit
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity (critical issues prioritized)

## 🛡️ Security Best Practices in Power-Toolkit

### For Users

1. **Keep Updated**: Always use the latest version of Power-Toolkit
2. **Browser Permissions**: Only grant necessary permissions
3. **Trusted Environments**: Use Power-Toolkit in environments you trust
4. **Credential Safety**: Never enter credentials in Power-Toolkit prompts (it doesn't ask for them)

### For Contributors

All contributors must follow these security practices:

1. **Input Validation**: Always validate and sanitize user input
2. **XSS Prevention**: Use `escapeHtml()` for any user-generated content
3. **No Hardcoded Secrets**: Never commit API keys, tokens, or credentials
4. **Form Context Checks**: Verify form context availability before operations
5. **Secure API Calls**: Use the provided service wrappers for API calls

### Code Security Patterns

```javascript
// ✅ CORRECT: Escape user input
element.innerHTML = `<span>${escapeHtml(userInput)}</span>`;

// ❌ WRONG: Unescaped user input (XSS vulnerability)
element.innerHTML = `<span>${userInput}</span>`;

// ✅ CORRECT: Check form context
if (!PowerAppsApiService.isFormContextAvailable) {
    return UIFactory.createFormDisabledMessage();
}

// ✅ CORRECT: Use try-catch for operations
try {
    await DataService.fetchRecords(entity);
} catch (error) {
    NotificationService.show(Config.MESSAGES.ERRORS.FETCH_FAILED, 'error');
}
```

## 🔐 Scope

### In Scope

- Power-Toolkit browser extension code
- Build and deployment scripts
- GitHub Actions workflows
- Dependencies with known vulnerabilities

### Out of Scope

- Power Platform/Dynamics 365 platform vulnerabilities (report to Microsoft)
- Browser vulnerabilities (report to browser vendor)
- Social engineering attacks
- Physical security issues

## 📋 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | ✅ Yes             |
| < 4.0.0   | ❌ No              |

## 🏆 Recognition

We appreciate security researchers who help keep Power-Toolkit secure. With your permission, we'll acknowledge your contribution in:

- Release notes
- Security advisories
- Contributors list

Thank you for helping keep Power-Toolkit and its users safe!
