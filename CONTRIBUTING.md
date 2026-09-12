# Contributing to OctoTask Core

Thank you for your interest in contributing to OctoTask Core! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and professional. We're committed to providing a welcoming and inspiring community for all.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Docker (optional, for containerized development)
- Git

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/OctoTask/core.git
cd core

# Install dependencies
npm ci

# Install individual package dependencies
cd hyperdeploy && npm ci && cd ..
cd cdn && npm ci && cd ..
cd resolver && npm ci && cd ..
cd registry-sync && npm ci && cd ..

# Or use Docker
docker-compose up -d dev
```

### Development Workflow

1. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature-name
   # or for bug fixes
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Follow the coding standards (see below)
   - Write tests for new functionality
   - Update documentation as needed

3. **Run tests and linting**

   ```bash
   npm run test              # Run all tests
   npm run test:coverage     # Check coverage
   npm run lint              # Run linting
   npm run format            # Format code
   ```

4. **Commit your changes**

   ```bash
   git commit -m "type(scope): description"
   # Examples:
   # feat(hyperdeploy): add retry mechanism
   # fix(registry-sync): handle connection timeout
   # docs: update contributing guide
   # test(hyperdeploy): add unit tests
   ```

5. **Push and create a PR**
   ```bash
   git push origin feat/your-feature-name
   # Create PR on GitHub with detailed description
   ```

## Commit Message Format

Follow the Conventional Commits specification:

```
type(scope): description

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `style`: Code style (formatting)

### Scopes

- `hyperdeploy`: Firebase deployment module
- `registry-sync`: NPM registry synchronization
- `cdn`: CDN package fetcher
- `resolver`: Dependency resolver
- `docker`: Docker configuration
- `ci`: CI/CD workflows
- `docs`: Documentation

### Examples

```bash
git commit -m "feat(hyperdeploy): add deployment rollback"
git commit -m "fix(registry-sync): handle Redis connection errors"
git commit -m "docs: add troubleshooting guide"
git commit -m "test(hyperdeploy): add retry mechanism tests"
```

## Code Standards

### TypeScript

- Use strict mode (`"strict": true`)
- Add proper type annotations
- Avoid `any` type
- Use interfaces for complex objects

### Testing

- Minimum 80% code coverage required
- Write unit tests for all functions
- Write integration tests for critical flows
- Use descriptive test names

### Documentation

- Add JSDoc comments to exported functions
- Include parameter descriptions and return types
- Add examples for public APIs
- Update README for new features

### Code Quality

- Use ESLint for linting
- Use Prettier for formatting
- Follow existing code style
- Keep functions small and focused
- DRY principle - don't repeat yourself

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Watch mode for development
npm run test:watch

# Check coverage
npm run test:coverage

# Test specific package
npm run test:hyperdeploy
npm run test:registry-sync
```

### Writing Tests

```typescript
// hyperdeploy/__tests__/index.test.ts
import { firebaseDeploy } from '../src/index';

describe('firebaseDeploy', () => {
  it('should throw error for invalid config', async () => {
    await expect(firebaseDeploy({} as any)).rejects.toThrow(
      'Valid project ID is required',
    );
  });

  it('should deploy successfully with valid config', async () => {
    const result = await firebaseDeploy({
      project: 'test-project',
      token: 'test-token',
      cwd: '/tmp',
    });

    expect(result.success).toBe(true);
  });
});
```

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new functionality
3. **Run full test suite** before submitting
4. **Write a clear PR description** including:
   - What changes were made
   - Why the changes were needed
   - How to test the changes
   - Related issues (if any)

5. **PR Requirements**:
   - ✅ All tests pass
   - ✅ Code coverage maintained (80%+)
   - ✅ No linting errors
   - ✅ Documentation updated
   - ✅ Meaningful commit messages

## Issue Guidelines

### Reporting Bugs

Include:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots if applicable

### Suggesting Features

Include:

- Clear description of the feature
- Motivation and use cases
- Possible implementation approach
- Relevant examples

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue with [bug] label
- **Features**: Open a GitHub Issue with [feature] label
- **Discord**: Join our [Discord community](https://discord.gg/khulnasoft)

## Release Process

Releases follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- Tags format: `v1.0.0` or `package-v1.0.0`

Automated via GitHub Actions when tags are pushed.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Additional Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/)

---

Thank you for contributing to OctoTask Core! 🚀
