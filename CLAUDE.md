@AGENTS.md

# Ludo App — Project Instructions

The authoritative project rules live in **AGENTS.md** (imported above): execution rules (no browser testing, no test runs), viewport fitting, routing, UI/modal guidelines, and Laravel setup (including the ban on Laravel Boost). Read and follow AGENTS.md first. If anything below conflicts with AGENTS.md, AGENTS.md wins.

## Conventions

- Follow the existing code conventions of this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods (e.g. `isRegisteredForDiscounts`, not `discount()`).
- Check for existing components to reuse before writing a new one.
- Stick to the existing directory structure; do not create new base folders or change the application's dependencies without approval.
- Only create documentation files when explicitly requested by the user.

## PHP (8.3)

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks (with array shape types) over inline comments. Only add inline comments for exceptionally complex logic.

## Laravel

- Use `php artisan make:` commands to create new files (migrations, controllers, models, etc.). Discover commands with `php artisan list` and check parameters with `php artisan [command] --help`. Pass `--no-interaction` (and the correct `--options`) so commands work without user input.
- When creating new models, create useful factories and seeders for them too, and use the factories in tests.
- When generating links to other pages, prefer named routes and the `route()` function.
- Inspect routes with `php artisan route:list` (filters: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`).
- Read configuration values with dot notation: `php artisan config:show app.name`, or read the files in `config/` directly.

## Formatting

- If you modified any PHP files, run `vendor/bin/pint --dirty --format agent` before finalizing changes (fix in place; do not run with `--test`).

## Inertia + React

- Pages live in `resources/js/Pages`. Activate the `inertia-development` skill when working on Inertia patterns (server-side routing, props, visits) and follow the Inertia notes in AGENTS.md.
- This project uses Inertia v3 with React 19 — confirm installed versions in `composer show --direct` and `package.json` before relying on a package API.

## Frontend Bundling

- If a frontend change doesn't show in the UI or you get an "Unable to locate file in Vite manifest" error, run `npm run build` (or ask the user to run `npm run dev` / `composer run dev`).
