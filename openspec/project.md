# Project Context

## Purpose

**JiMeng Web MCP Server** - A TypeScript-based Model Context Protocol (MCP) server that provides direct access to JiMeng AI's Web interface for AI-powered image and video generation.

### Core Goals
- **Free Access**: Provide 60-80 free daily credits without payment requirements
- **Latest Features**: Direct Web interface access ensures immediate availability of new JiMeng features
- **Developer Experience**: Zero-install deployment via npx for seamless integration with Claude Desktop
- **Learning & Research**: Educational tool for understanding MCP protocol and AI generation APIs
- **Type Safety**: 100% TypeScript implementation with comprehensive type definitions

### Key Capabilities
- **Image Generation**: Single/batch generation with multi-reference image support and intelligent continue generation
- **Video Generation**: Text-to-video, frame-controlled, multi-frame, and subject fusion modes
- **MCP Integration**: Full MCP protocol implementation with 10 core tools
- **Async/Sync Modes**: Flexible operation modes for both blocking and non-blocking workflows

**⚠️ IMPORTANT**: This project is for **learning and research purposes only**. It accesses JiMeng's Web interface, not official APIs.

## Tech Stack

### Core Technologies
- **TypeScript 5.8+** - Full type safety with strict mode enabled
- **Node.js 16+** - Runtime environment with ES2020 target
- **Model Context Protocol (MCP) SDK 1.10+** - Official MCP implementation
- **Zod 3.24+** - Runtime schema validation for MCP tool parameters

### HTTP & Networking
- **Axios 1.9+** - HTTP client with retry logic and error handling
- **image-size 2.0+** - Image format detection and dimension extraction
- **crc32 0.2+** - File integrity verification for uploads

### Build & Development Tools
- **tsup 8.4+** - Zero-config TypeScript bundler with dual CJS/ESM output
- **tsx 4.20+** - TypeScript execution for development
- **nodemon 3.1+** - Auto-restart development server
- **dotenv 16.5+** - Environment variable management

### Testing Infrastructure
- **Jest 29.7+** - Test framework with ES module support
- **ts-jest 29.4+** - TypeScript preprocessor for Jest
- **@types/jest 30.0+** - TypeScript definitions for Jest

### Utilities
- **uuid 11.1+** - Unique identifier generation for tasks
- **dotenv-cli 8.0+** - CLI tool for environment variable injection

## Project Conventions

### Code Style

**TypeScript Standards**
- Strict mode enabled (`strict: true`)
- ES2020 target with NodeNext module resolution
- No implicit any, strict null checks, and strict function types
- All files must have `.ts` extension in source, compiled to `.js` and `.cjs`

**Naming Conventions**
- **Classes**: PascalCase (e.g., `NewJimengClient`, `HttpClient`)
- **Interfaces/Types**: PascalCase with `I` prefix for interfaces (e.g., `ImageGenerationParams`)
- **Functions/Methods**: camelCase (e.g., `generateImage`, `uploadImage`)
- **Constants**: UPPER_SNAKE_CASE for global constants (e.g., `DEFAULT_MODEL`)
- **Files**: kebab-case for utilities, PascalCase for classes (e.g., `http-client.ts`, `NewJimengClient.ts`)

**Code Organization**
- One class per file for core components
- Group related types in `src/types/` directory
- Schemas in `src/schemas/` for MCP tool validation
- Utilities in `src/utils/` for shared functionality

### Architecture Patterns

**Composition Over Inheritance** (After 74.6% code reduction refactor)
```typescript
class NewJimengClient {
  private httpClient: HttpClient              // HTTP requests and auth
  private imageUploader: ImageUploader        // Image upload service
  private creditService: NewCreditService     // Credit management
  private videoService: VideoService          // Video generation

  constructor(token?: string) {
    // Dependency injection, no inheritance chains
    this.httpClient = new HttpClient(token);
    this.imageUploader = new ImageUploader(this.httpClient);
    this.creditService = new NewCreditService(this.httpClient);
    this.videoService = new VideoService(this.httpClient, this.imageUploader);
  }
}
```

**Single Responsibility Principle**
- **HttpClient**: HTTP requests and authentication only
- **ImageUploader**: Image upload and format detection only
- **NewCreditService**: Credit/point management only
- **VideoService**: All video generation modes in one unified service
- **NewJimengClient**: API facade that delegates to specialized services

**Singleton Pattern**
- `getApiClient()` maintains global client instance for backward compatibility
- Prevents duplicate authentication and client initialization

**Unified Async/Sync Pattern**
- All generation methods support single `async` parameter instead of separate async methods
- Default: `async=false` for `image`, `async=true` for all video/batch operations
- Synchronous operations use 600s timeout with exponential backoff (2s→10s, 1.5x factor)

**Type Safety Layers**
1. **Compile-time**: TypeScript interfaces and type definitions
2. **Runtime**: Zod schemas for MCP tool parameter validation
3. **API**: Comprehensive error types with specific error codes

**Modular Design**
```
src/
├── api/                      # Core API implementation
│   ├── HttpClient.ts        # HTTP client (256 lines)
│   ├── ImageUploader.ts     # Image upload (221 lines)
│   ├── NewCreditService.ts  # Credit service (114 lines)
│   ├── VideoService.ts      # Unified video service (393 lines)
│   └── NewJimengClient.ts   # Main client (351 lines)
├── types/                   # Type definitions
│   ├── api.types.ts         # API types (200 lines)
│   ├── models.ts            # Model mappings (80 lines)
│   └── params.types.ts      # Parameter types
├── schemas/                 # Zod validation schemas
│   └── video.schemas.ts     # Video tool schemas
├── utils/                   # Utilities
│   ├── auth.ts              # Authentication helpers
│   ├── dimensions.ts        # Dimension calculations
│   └── logger.ts            # Logging utilities
├── api.ts                   # Backward-compatible exports
└── server.ts                # MCP server implementation
```

### Testing Strategy

**Three-Tier Testing Approach**
1. **Unit Tests** (`tests/unit/`)
   - Individual component testing
   - Mock external dependencies
   - Focus: HttpClient, ImageUploader, utilities

2. **Integration Tests** (`tests/integration/`)
   - Full API flow testing
   - Real network requests (with API token)
   - Focus: End-to-end generation workflows

3. **E2E Tests** (`tests/e2e/`)
   - MCP server testing
   - Claude Desktop integration testing
   - Focus: Tool invocation and response formats

**Test Configuration**
- Jest with ES module support (`NODE_OPTIONS=--experimental-vm-modules`)
- `.js` extension handling for imports
- Coverage collection excludes type definitions and test files
- Mock configuration for network requests in unit tests

**Test Commands**
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
npm run test:mcp      # MCP inspector for integration testing
```

**Coverage Requirements**
- Critical paths: >90% coverage
- API clients: >80% coverage
- Utilities: >85% coverage
- Type definitions: N/A (excluded from coverage)

### Git Workflow

**Branch Strategy**
- `main` - Production-ready code, protected branch
- `feature/*` - New features (e.g., `feature/video-generation`)
- `fix/*` - Bug fixes (e.g., `fix/image-upload-timeout`)
- `refactor/*` - Code refactoring (e.g., `refactor/composition-pattern`)
- `docs/*` - Documentation updates

**Commit Conventions** (Conventional Commits)
```
type(scope): subject

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no functionality change)
- `docs`: Documentation only
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling
- `perf`: Performance improvement

**Examples:**
```
feat(video): add main reference video generation
fix(upload): resolve image upload timeout issue
refactor(client): migrate to composition pattern
docs(readme): update installation instructions
test(integration): add video generation e2e tests
chore(deps): upgrade axios to 1.9.0
```

**Pre-commit Checks**
1. TypeScript compilation (`npm run type-check`)
2. Test suite passes (`npm test`)
3. Build succeeds (`npm run build`)

**Release Process**
1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run `npm run build` and `npm run test`
4. Commit with `chore: release vX.Y.Z`
5. Tag: `git tag vX.Y.Z`
6. Publish: `npm publish`

## Domain Context

### JiMeng AI Platform
**即梦AI (JiMeng AI)** - ByteDance's AI generation platform for images and videos
- Official website: https://jimeng.jianying.com
- Credits system: 60-80 free daily credits
- Web-based interface with cookie-based authentication

### Model Context Protocol (MCP)
**MCP** - Anthropic's standard protocol for AI tool integration
- Version: 1.10+
- Transport: stdio (standard input/output)
- Integration: Claude Desktop, Claude Code
- Tool types: Resources, Prompts, Tools (this project uses Tools)

### Authentication System
**Session-based Authentication**
- Uses `sessionid` cookie from JiMeng Web interface
- Token stored in `JIMENG_API_TOKEN` environment variable
- Token extraction: Browser DevTools > Application > Cookies > sessionid
- Token lifetime: ~30 days (user must refresh manually)

### Image Generation Domain
**Continue Generation Mechanism**
- API automatically detects total count from prompt (e.g., "生成9张图片")
- First batch: 4 images
- Continuation: Requires `action=2` confirmation for remaining images
- Implementation: Single confirmation, not loop-based

**Multi-Reference Image System**
- Single reference: Automatic `##` prefix in prompt
- Multi-reference (2-4 images): Automatic `####` prefix
- Strength control: Individual `reference_strength` array per image

### Video Generation Domain
**Video Modes**
1. **Text-to-Video**: Pure prompt-based generation
2. **Frame-Controlled**: First and/or last frame specification
3. **Multi-Frame**: 2-10 keyframes with transition prompts
4. **Main Reference**: Subject fusion using `[图0]`, `[图1]` syntax

**Multi-Frame Prompts**
- Each prompt describes transition **from current to next frame**
- Last frame prompt is ignored (no next frame exists)
- Duration per frame: 1-6 seconds (1000-6000ms)
- Total duration: ≤15 seconds

**Main Reference Syntax**
- `[图0]中的猫` - Extract cat from first image
- `[图1]的地板` - Extract floor from second image
- Requirement: 2-4 reference images, at least one `[图N]` in prompt

## Important Constraints

### Technical Constraints
1. **Node.js Version**: ≥16.0 required for ES module support
2. **TypeScript Version**: ≥5.8 for latest language features
3. **MCP Protocol**: Must maintain compatibility with MCP SDK 1.10+
4. **Backward Compatibility**: 100% compatibility required for all API changes
5. **Build Outputs**: Must support both CJS and ESM formats
6. **File Paths**: All image paths must be absolute, not relative
7. **Timeout Limits**: 600s max for synchronous operations
8. **Image Count**: Max 4 reference images per request
9. **Video Duration**: 3-15 seconds (3000-15000ms)
10. **Frame Count**: 2-10 frames for multi-frame video

### Business Constraints
1. **Learning Use Only**: Not for commercial or production use
2. **Rate Limiting**: Respect JiMeng's API rate limits
3. **Credit Management**: User responsible for monitoring daily credits
4. **ToS Compliance**: Must comply with JiMeng AI's terms of service
5. **No Warranty**: No guarantees on API availability or stability

### Regulatory Constraints
1. **Content Policy**: Must not generate prohibited content (violence, explicit, etc.)
2. **API Access**: Web scraping approach, not official API
3. **Data Privacy**: No user data stored or transmitted to third parties
4. **Liability**: Developer not responsible for user violations

### Code Quality Constraints
1. **Type Safety**: No `any` types except for third-party library compatibility
2. **Test Coverage**: Critical paths must have >90% coverage
3. **Documentation**: All public APIs must have JSDoc comments
4. **Error Handling**: All async operations must handle errors gracefully
5. **Deprecation**: Soft deprecation with warnings, no breaking changes

## External Dependencies

### Core External Services

**JiMeng AI Web API**
- Base URL: `https://jimeng.jianying.com`
- Authentication: Cookie-based (`sessionid`)
- Rate Limiting: Undocumented, approximately 100 requests/hour
- Endpoints:
  - `/mweb/v1/get_upload_token` - Image upload authentication
  - `/commerce/v1/benefits/user_credit` - Credit balance query
  - `/commerce/v1/benefits/credit_receive` - Credit claiming
  - `/mweb/v1/aigc_draft/generate` - Unified generation endpoint (images & videos via draft_type)
  - `/mweb/v1/get_history_by_ids` - Task status query (history_ids for images, submit_ids for videos)

**Image Hosting CDN**
- Domain: `p3-osu-sign.byteimg.com`, `p9-osu-sign.byteimg.com`
- Protocol: HTTPS
- Format: JPEG, PNG, WebP
- Expiration: Generated URLs expire after ~24 hours

**Video Hosting CDN**
- Domain: ByteDance's video CDN
- Protocol: HTTPS
- Format: MP4
- Expiration: Generated URLs expire after ~24 hours

### Development Dependencies

**MCP Inspector**
- Package: `@modelcontextprotocol/inspector`
- Purpose: Debug and test MCP server during development
- Usage: `npm run test:mcp`

**TSup Bundler**
- Purpose: Fast TypeScript bundler with zero config
- Outputs: ESM (lib/index.js) and CJS (lib/index.cjs)
- Features: Source maps, type declarations, watch mode

**Jest Test Framework**
- Configuration: ES module mode with experimental VM modules
- Extensions: `.test.ts` files
- Mocking: Axios mock for unit tests

### Runtime Dependencies

**Axios HTTP Client**
- Version: 1.9+
- Features: Interceptors, retry logic, timeout handling
- Configuration: Custom headers, CSRF tokens, cookie management

**Zod Validation**
- Version: 3.24+
- Purpose: Runtime parameter validation for MCP tools
- Location: `src/schemas/video.schemas.ts`

**image-size Library**
- Version: 2.0+
- Purpose: Extract dimensions and format from image files
- Supports: JPEG, PNG, GIF, WebP, TIFF, BMP, SVG

**uuid Library**
- Version: 11.1+
- Purpose: Generate unique task IDs for async operations
- Format: UUIDv4

### Integration Dependencies

**Claude Desktop**
- Platform: macOS, Windows
- Configuration: `claude_desktop_config.json`
- Communication: stdio (standard input/output)
- MCP SDK: 1.10+ required

**npx (Node Package Executor)**
- Purpose: Zero-install deployment
- Usage: `npx -y jimeng-web-mcp`
- Advantage: No manual installation required

### Monitoring & Logging

**Console Logging**
- Custom logger in `src/utils/logger.ts`
- Levels: DEBUG, INFO, WARN, ERROR
- Output: stdout for normal, stderr for errors

**Request/Response Logging** (Development Only)
- File pattern: `jimeng-request-log-*.json`
- File pattern: `debug-jimeng-response-*.json`
- Note: Excluded from git via `.gitignore`

## Version History

- **v2.1.2** (Current) - Latest stable release
- **v2.1.1** - Fixed MCP stdio communication and image upload timeout
- **v2.1.0** - Removed count parameter, added prompt-based intelligent count detection
- **v2.0.x** - Major refactor: Composition pattern, 74.6% code reduction
- **v1.x** - Initial release with inheritance-based architecture

## Related Documentation

- **Main README**: `/README.md` - User-facing documentation (Chinese)
- **English README**: `/README.en.md` - English documentation
- **Claude Instructions**: `/CLAUDE.md` - AI assistant instructions
- **OpenSpec Agents**: `@/openspec/AGENTS.md` - Change proposal workflow
- **API Analysis**: `/20250105-api-endpoint-analysis/` - API research documentation
- **Specs**: `/specs/` - Feature specifications and design documents
