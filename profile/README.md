  FRAME
  =====
  FRAME is a universal runtime for structured systems. Everything it hosts is a
  FRAME in a governed relationship graph. Clients project and submit Intents —
  they do not own state.

  
  Quick Start
  -----------
  * Architecture overview: docs/FRAME.md
  * Build and run: docs/DEVELOPER.md
  * Package contract: docs/FRAME-PACKAGE.md
  * Integrity check: ./tools/architecture-check.sh
  Essential Documentation
  -----------------------
  All users should be familiar with:
  * Identity and laws: docs/FRAME.md
  * Ontology · Algebra · Physics · Runtime: docs/FRAME-ARCHITECTURE.md
  * Legal transformations: docs/FRAME-ALGEBRA.md
  * Platform operations: docs/FRAME-PLATFORM.md
  * Package Contract: docs/FRAME-PACKAGE.md
  * Conformance: docs/FRAME-CONFORMANCE.md
  Full index: docs/README.md
  Who Are You?
  ============
  Find your role below:
  * New FRAME Developer — Building on the substrate
  * Package Author — Shipping .frame packages
  * Client / UI Developer — Browser, desktop, phone, shell
  * Runtime / Host Engineer — Persistence, authority, execution
  * Security / Authority — Sessions, identity, trust, governance
  * Connected Host / Mesh — Multi-host sync
  * AI Integrator — Participants, recommendations, delegation
  * Operator — Install, boot, backup, recover
  * Researcher — Studying the architecture
  * AI Coding Assistant — Working in this repository
  For Specific Users
  ==================
  New FRAME Developer
  -------------------
  Start here:
  * Entry path: README.md → docs/FRAME.md
  * Developer guide: docs/DEVELOPER.md
  * Glossary: docs/FRAME-GLOSSARY.md
  * Conventions: docs/FRAME-CONVENTIONS.md
  * Build host: cargo build --manifest-path frame_runtime_host/Cargo.toml
  * Run: ./frame start
  Package Author
  --------------
  Create things WITH FRAME, not inside Core:
  * Package Contract: docs/FRAME-PACKAGE.md
  * Built-in package layout: packages/
  * Capability resolution: docs/rfc/RFC-0001-CAPABILITY-RESOLUTION.md
  * Exchange Space (generic discovery): docs/FRAME-EXCHANGE-SPACE.md
  Client / UI Developer
  ---------------------
  Universal client boundary:
  * Interaction model: docs/FRAME-INTERACTION.md
  * Wire protocol: docs/rfc/RFC-0002-CORE-WIRE-PROTOCOL.md
  * Session / transport: docs/rfc/RFC-0003-RUNTIME-TRANSPORT-SESSION.md
  * Browser UI: ui/
  * Wire TypeScript: runtimes/frame_wire_ts/
  * Client contract: frame.client.v1 (see frame_runtime_host client protocol)
  Runtime / Host Engineer
  -----------------------
  Authoritative host:
  * Architecture: docs/FRAME-ARCHITECTURE.md
  * Platform ops: docs/FRAME-PLATFORM.md
  * Mutation map: docs/FRAME-MUTATION-MAP.md
  * Host source: frame_runtime_host/
  * Integrity freeze: .cursor/rules/architecture-freeze.mdc
  * Architecture check: ./tools/architecture-check.sh
  Security / Authority
  --------------------
  Only governed mutation writes the Runtime Graph:
  * Governance strategies: docs/FRAME-GOVERNANCE-STRATEGIES.md
  * Package trust / signatures: docs/FRAME-PACKAGE.md
  * Architecture debt / freeze criteria: docs/ARCHITECTURE-DEBT.md
  * Conformance suite: docs/FRAME-CONFORMANCE.md
  Connected Host / Mesh
  ---------------------
  Separate hosts, authorized sync:
  * Platform / runtime docs: docs/FRAME-PLATFORM.md
  * Host source: frame_runtime_host/src/connected_host.rs
  * Peer authority: frame_runtime_host/src/peer_sync_auth.rs
  AI Integrator
  -------------
  AI is a participant, not a second authority:
  * Interaction / Commitment Boundary: docs/FRAME-INTERACTION.md
  * Host AI modules: frame_runtime_host/src/ai_participant.rs
  * Optional config: FRAME_AI_CONFIG
  Operator
  --------
  Install and run the product host:
  * Run: ./frame --help
  * Data dir: FRAME_DATA_DIR (default ~/.local/share/frame)
  * Release layout: dist/frame/README-RUN.txt
  * Package release: ./tools/package-release.sh
  * Developer ops: docs/DEVELOPER.md
  Researcher
  ----------
  Study the frozen substrate:
  * FRAME.md
  * FRAME-ARCHITECTURE.md
  * FRAME-ALGEBRA.md
  * FRAME-PLATFORM.md
  * RFCs under docs/rfc/
  AI Coding Assistant
  -------------------
  CRITICAL: FRAME is frozen. Do not invent new Core nouns, mutation paths, or
  parallel authorities.
  * Architecture freeze: .cursor/rules/architecture-freeze.mdc
  * Integrity criteria: docs/ARCHITECTURE-DEBT.md
  * Must pass: ./tools/architecture-check.sh
  * Entry path: docs/FRAME.md → docs/FRAME-ARCHITECTURE.md → docs/FRAME-ALGEBRA.md
  Build and Validate
  ==================
  ```bash
  ./tools/architecture-check.sh
  cargo test --manifest-path frame_runtime_host/Cargo.toml --lib -- --test-threads=1
  (cd runtimes/frame_wire_ts && npm test && npm run verify)
  (cd ui && npm test)
  ./frame start
  ```
  See docs/DEVELOPER.md for the full command set.
  What FRAME Is Not
  =================
  FRAME is the substrate. Domain products (vehicles, weather stations, marketplaces,
  hardware demos, and similar) are built WITH FRAME in other repositories.
