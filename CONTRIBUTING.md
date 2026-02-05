# Contributing to KatanOS

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to KatanOS. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Code of Conduct

This project and everyone participating in it is governed by the [KatanOS Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to kevin@katania.me.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for KatanOS. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as possible.
- **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets, which you use in those examples.
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include screenshots and animated GIFs** which show you following the described steps and clearly demonstrate the problem.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for KatanOS, including completely new features and minor improvements to existing functionality.

- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Provide specific examples to demonstrate the steps**.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why.

### Pull Requests

The process described here has several goals:

- Maintain KatanOS's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible KatanOS
- Enable a sustainable system for KatanOS's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Follow the [styleguides](#styleguides)
2. Keep PR scope focused and clearly described
3. After you submit your pull request, verify that all status checks are passing

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### JavaScript/TypeScript Styleguide

- All JavaScript must adhere to [JavaScript Standard Style](https://standardjs.com/).
- Prefer `const` over `let`. Ditch `var`.
- Use TypeScript for all new files.
- Use functional components and hooks for React.

### Documentation Styleguide

- Use [Markdown](https://daringfireball.net/projects/markdown).
- Reference methods and classes in markdown with the custom `{}` notation or backticks.

## Setting Up the Development Environment

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Build for production: `npm run build`

## Additional Notes

### Issue and Pull Request Labels

This section lists the labels we use to help us track and manage issues and pull requests.

* `bug` - Issues that are bugs.
* `enhancement` - Issues that are feature requests.
* `documentation` - Issues or pull requests related to documentation.
* `good first issue` - Good for newcomers.

Thank you for contributing to KatanOS! 🚀
