**# SINEMA Google Flow Integration Plan**

Date: 2026-09-08

Status: Forensic audit complete. Production patch begins only after this plan.

**## 1. Current SINEMA Architecture**

\- \`server/ai\_infrastructure/provider\_service.ts\`: provider metadata.

\- \`server/ai\_infrastructure/provider\_adapter\_registry.ts\`: execution adapters.

\- \`server/ai\_infrastructure/task\_router.ts\`, \`intelligence\_router.ts\`, \`ai\_gateway.ts\`: capability/model routing and fallback.

\- \`server/ai\_infrastructure/credential\_service.ts\`, \`server/credential\_manager.ts\`, \`server/security/secret\_vault.ts\`: API credential storage, encryption, masking, health, rotation.

\- \`server/ai\_infrastructure/quota\_router.ts\`: provider/credential health and quota selection.

\- \`server/ai\_infrastructure/cost\_monitor.ts\`, \`ai\_budget\_registry.ts\`, \`cost\_intelligence.ts\`: API-oriented budget and cost tracking.

\- \`server/ai\_infrastructure/execution\_queue.ts\`, \`job\_graph.ts\`, \`job\_monitor.ts\`: in-process execution and pipeline jobs.

\- \`server/ai\_infrastructure/asset\_intelligence.ts\` plus asset graph/integrity modules: asset continuity and validation.

\- \`src/types.ts\`: \`ProviderCredential\`, \`AICredential\`, \`AIProvider\`, provider and status contracts.

\- Firebase/Drive OAuth exists in \`src/lib/drive.ts\`; it is not Google Flow browser-session management.

\- No verified SINEMA MCP server or Google Flow execution adapter exists.

Architectural constraint: existing S1-S8 pipeline, AMM, provider router, Credential Vault, Asset Graph, and \`ExecutionEvent\` remain source of truth.

**## 2. Donor Repository Findings**

Eight requested donor repositories acquired under \`D:\Web\research\google-flow-donors\`:

\- \`gflow-cli\`: persistent real Chrome, auth strategies, CDP/browser lifecycle, transport drivers, Flow operations, credits, storage, job safety, MCP, tests.

\- \`flow-py\`: Playwright persistent context/CDP, direct HTTP reads, UI interception, T2V/T2I/I2V/R2V, extension/edit/upscale, project/media operations, tests.

\- \`roshanarnav25-sloth/google-flow-mcp\` stored as \`google-flow-mcp\`: TypeScript MCP, authenticated page fetch, transport discovery, DOM fallback, cost quote, budget gate, ledger, media, async collect, tests.

\- \`miyakejima/google-flow-mcp\` stored as \`miyakejima-google-flow-mcp\`: acquired; inspect before any donor selection.

\- \`hitjcl/google-flow-mcp\` stored as \`hitjcl-google-flow-mcp\`: acquired; inspect before any donor selection.

\- \`Mitanshp5/Google-Flow\_MCP\` stored as \`Google-Flow\_MCP\`: Chrome profile/CDP, account check, UI tools, queue, screenshots, download.

\- \`MuazAshraf/flow\_automation\_tool\`: browser extension/UI editor; no verified durable Flow server transport.

\- \`Shivanshu85/Google-Flow-Automation\`: extension automation source; no verified durable server-side ledger.

Verified high-value patterns:

\- Browser session: \`flow-py/flow/\_browser.py\`, \`\_storage.py\`; \`Google-Flow\_MCP/src/browser/\*\`; \`gflow-cli/src/gflow\_cli/auth/\*\`.

\- Transport ladder: \`google-flow-mcp/src/index.ts\`; \`gflow-cli/src/gflow\_cli/api/transports/\*\`.

\- Cost safety: \`google-flow-mcp/src/index.ts\` quote/ceiling/ledger flow; \`gflow-cli\` credit and fail-fast docs/tests.

\- Queue/UI breadth: \`Google-Flow\_MCP/src/queue/job-queue.js\`, \`src/tools/\*\`.

\- Asset/media: \`google-flow-mcp/src/services/media.ts\`, \`compose.ts\`; \`flow-py\` downloader/media modules.

No donor becomes runtime dependency. No donor code gets copied wholesale.

**## 3. Cross-Repository Capability Matrix**

\| Capability | gflow-cli | flow-py | roshanarnav25-sloth | miyakejima | hitjcl | Mitanshp5 | extension repos | SINEMA |

\|---|---|---|---|---|---|---|---|---|

\| Browser session/CDP | A | A | A | pending audit | pending audit | B | B | missing |

\| Persistent profile/auth state | A | A | A | pending audit | pending audit | A | C | missing |

\| HTTP/page-fetch/DOM fallback | A | A | A | pending audit | pending audit | C | C | missing |

\| T2V/T2I/I2V/R2V | A | A | A | pending audit | pending audit | B | C | missing |

\| Extensions/edit/upscale | A | A | B | pending audit | pending audit | B | C | missing |

\| Queue/remote jobs/recovery | B | B | A | pending audit | pending audit | B | C | partial/in-process |

\| Credits/quote/budget/ledger | A | B | A | pending audit | pending audit | D | D | API-only budget |

\| MCP | A | C | A | pending audit | pending audit | A | D | missing |

\| Asset upload/download/metadata | A | A | A | pending audit | pending audit | B | C | partial |

\| Error taxonomy/observability/tests | A | A | A | pending audit | pending audit | B | C | API-focused |

A = directly adaptable pattern; B = partially adaptable; C = architectural reference only; D = incompatible; E = unnecessary because SINEMA is stronger.

**## 4. SINEMA Gap Analysis**

1\. No Flow session domain. API-key \`ProviderCredential\` cannot represent browser profile, CDP endpoint, account, entitlement, or session state.

2\. No Flow transport ladder: HTTP read, authenticated page fetch, network interception, and DOM fallback are absent.

3\. No Flow operation adapter for generation/edit/extend/upscale/project/media actions.

4\. Existing queue is in-process and retry behavior is unsafe for paid duplicate submissions.

5\. Existing \`cost\_monitor\` tracks API/token-style spend, not Flow quote, approval, charge, or reconciliation.

6\. Existing Asset Graph lacks Flow project/media ID mapping and signed-media validation.

7\. No Flow-specific MCP layer.

8\. Flow-specific failure states and runtime proof are absent.

9\. Vercel/serverless cannot own persistent Chrome/CDP. Flow worker boundary required; human auth remains outside automation.

10\. API resource accounting and Flow credit accounting must stay separate under one resolver/gate.

**## 5. Recommended Transplants**

\- A: Adapt session lifecycle concepts into \`FlowSessionManager\`; persist only non-secret profile/session metadata. Never store passwords, OTPs, recovery codes, raw cookies, or bearer tokens in SINEMA DB.

\- A: Adapt roshan donor quote/approval/ceiling/ledger state machine into Flow-specific resource accounting.

\- A: Adapt transport discovery and page-fetch fallback as interfaces, not endpoint hacks.

\- B: Adapt donor queue concepts for remote IDs, submission fingerprints, polling, cancellation, restart recovery, charge ambiguity, and reconciliation.

\- B: Adapt media validation and Flow-to-SINEMA asset mapping.

\- B: Adapt MCP tool safety metadata and prepare/execute separation if/when SINEMA MCP layer is introduced.

\- C: Use extension repos only for selector/UI observations.

\- D: Reject anti-abuse bypass, CAPTCHA bypass, WAF bypass, fingerprint spoofing, quota/credit bypass, and account farming.

\- E: Keep SINEMA router, Credential Vault, AMM, ExecutionEvent, Asset Graph, and pipeline rather than duplicating them.

**## 6. Exact Files To Modify**

Initial patch scope:

\- \`src/types.ts\`: credential/resource/session domain contracts; preserve API contracts.

\- \`server/ai\_infrastructure/provider\_service.ts\`: provider domain metadata and Flow registration.

\- \`server/ai\_infrastructure/provider\_adapter\_registry.ts\`: provider-neutral credential strategy contract.

\- \`server/ai\_infrastructure/credential\_resolver.ts\`: resolve API credentials versus Flow sessions without mixing.

\- \`server/ai\_infrastructure/capability\_registry.ts\`: Flow capabilities.

\- \`server/ai\_infrastructure/quota\_router.ts\`: delegate resource state by resource domain.

\- \`server/ai\_infrastructure/execution\_preflight.ts\`: capability + credential domain + resource domain gate.

\- \`server/ai\_infrastructure/ai\_gateway.ts\` / \`task\_router.ts\`: route Flow browser sessions separately from API keys.

\- \`server/ai\_infrastructure/cost\_monitor.ts\` / \`cost\_intelligence.ts\`: preserve API accounting; add unified parent resource interface only.

\- \`server/ai\_infrastructure/execution\_queue.ts\` / \`job\_monitor.ts\`: Flow remote-job hooks and duplicate-submit protection.

\- \`server/db.ts\` and relevant persistence types: metadata-only Flow session/resource/job records.

\- \`server/routes.ts\` or dedicated routes: human-controlled session status and reauth-required reporting.

\- Tests adjacent to each module.

Later, after contracts pass: new Flow adapter/worker modules and MCP modules.

**## 7. Exact New Modules Required**

\- \`server/flow/flow\_types.ts\`: \`FlowSession\`, \`FlowSessionState\`, \`FlowResource\`, \`FlowJob\`, \`FlowLedgerEntry\`.

\- \`server/flow/flow\_session\_manager.ts\`: attach/launch/check/disconnect; human auth boundary.

\- \`server/flow/flow\_transport.ts\`: transport interface and capability-aware ladder.

\- \`server/flow/flow\_provider.ts\`: first-class provider adapter; no \`apiKey\` primary auth.

\- \`server/flow/flow\_resource\_manager.ts\`: Flow credits, quotes, reservations, ledger, reconciliation.

\- \`server/flow/flow\_job\_manager.ts\`: durable remote IDs, polling, cancellation, recovery.

\- \`server/flow/flow\_asset\_mapper.ts\`: SINEMA Asset Graph ↔ Flow project/media IDs.

\- \`server/flow/flow\_error.ts\`: Flow-specific error taxonomy.

\- \`server/flow/flow\_worker\_boundary.ts\`: local/dedicated worker contract; no persistent browser in Vercel request runtime.

**## 8. Existing Modules That Must NOT Be Duplicated**

Do not duplicate \`server/credential\_manager.ts\`, \`server/security/secret\_vault.ts\`, \`credential\_service.ts\`, provider router, AMM, \`ExecutionEvent\`, Asset Graph, S1-S8 pipeline, Firebase persistence, or generic health/observability services. Extend through contracts and adapters.

**## 9. Phase Mapping**

\- Existing provider/capability phase: register Flow capability and provider metadata.

\- Existing credential/preflight phase: add credential strategy resolution and domain validation.

\- Existing routing phase: resolve capability + credential domain + resource domain.

\- Existing budget/control-plane phase: add Flow quote/approval gate without changing API quota semantics.

\- Existing execution/queue phase: add Flow remote-job lifecycle and recovery hooks.

\- Existing asset/QA phase: map and validate Flow media through Asset Graph.

\- Existing observability/proof phase: emit existing execution events plus Flow-specific fields.

\- Existing API/deploy phase: keep browser worker outside Vercel; API exposes status/control only.

No competing S1-S8 roadmap.

**## 10. Dependency Strategy**

\- Copy/adapt concepts and small isolated algorithms only after source review.

\- Do not copy donor repository as runtime package.

\- No donor dependency required by default.

\- SINEMA remains TypeScript/Node source of truth; browser worker may be a separately deployed process only if runtime proof requires it.

\- Do not install donor dependencies into SINEMA.

\- Playwright/CDP dependency requires explicit architecture approval and worker isolation.

**## 11. Test Strategy**

\- Type-level domain separation tests: Flow session rejected by API credential resolver and API key rejected by Flow session resolver.

\- Session state transition tests, no-secret persistence tests, account mismatch tests.

\- Transport ladder tests with mocked browser/page/network layers.

\- Quote ceiling, approval, rejection, reservation, charge-unknown, reconciliation tests.

\- Duplicate submission fingerprint and restart recovery tests.

\- Flow resource never appears as Gemini quota; Gemini usage never appears as Flow credits.

\- Capability/resource/credential routing matrix.

\- Asset ID/checksum/signed URL validation tests.

\- Existing routing, budget, and pipeline regression suites.

\- Live proof only with human-authenticated session and explicit credit approval.

**## 12. Runtime Proof Strategy**

1\. Run static/type tests and existing regression suites.

2\. Run worker with a human-authenticated Chrome profile supplied by operator.

3\. Verify session account and Flow entitlement without extracting auth secrets.

4\. Verify read-only status/credits path.

5\. Verify quote and rejection path; prove no paid submission.

6\. Run one explicitly approved generation; capture remote ID, ledger, asset mapping, and final status.

7\. Restart worker; prove reconciliation and no duplicate submission.

8\. Verify Vercel API remains stateless and only controls/reports worker state.

Human authentication, CAPTCHA, or verification: stop, report \`REAUTH\_REQUIRED\`/\`BOT\_CHALLENGE\`, request human action, resume.

**## 13. Migration/Rollback Strategy**

\- Additive schema and feature flag: Flow disabled by default.

\- Existing API providers and credentials unchanged.

\- No migration of API keys into Flow session records.

\- Rollback disables Flow provider registration and ignores new Flow metadata; preserve audit records.

\- Never delete or overwrite existing Asset Graph or execution history.

\- Reconcile unknown charges before retry or rollback.

**## 14. Risks**

\- Google Flow UI/API drift.

\- Browser profile lock and CDP disconnect.

\- Account/session expiry and wrong-account generation.

\- Paid duplicate submission during timeout/retry.

\- Serverless/browser-worker split.

\- Credit quote differs from final charge.

\- Signed URL expiry and media processing delays.

\- Donor code license and security assumptions.

\- Capability cohort/locale differences.

\- Human auth dependency.

**## Decision Gate**

Proceed with additive credential/resource domain contracts first. Do not implement Flow browser transport or paid generation until contracts, tests, worker boundary, and ledger gate exist.