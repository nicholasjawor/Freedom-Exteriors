import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ScopeReview from "./ScopeReview";
import { apiFetch } from "./apiFetch";
import { supabase } from "./supabase";

jest.mock("./apiFetch", () => ({ apiFetch: jest.fn() }));
jest.mock("./supabase", () => {
  const bucket = { upload: jest.fn(), remove: jest.fn(), createSignedUrl: jest.fn() };
  return { supabase: { storage: { from: jest.fn(() => bucket), bucket }, from: jest.fn() } };
});

const JOB = { id: 1782155652201, name: "Jerome Behr", claimNum: "0619-35816", address: "1 Main St", city: "Fridley", state: "MN", insurer: "State Farm" };
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

// Answers each /api/scope-review call by mode and records what was sent.
function mockServer(calls) {
  apiFetch.mockImplementation((url, opts) => {
    const { mode, jobId, payload } = JSON.parse(opts.body);
    calls.push({ mode, jobId, payload });
    if (mode === "extract" || mode === "extractPdf") {
      return ok({ items: [1, 2, 3, 4].map(n => ({ ref: String(n), text: `Item ${n}` })) });
    }
    if (mode === "analyze") {
      return ok({ results: payload.items.map(it => ({
        ref: it.ref, itemText: it.text, tradeCategory: "Roofing - Field",
        category: it.ref === "4" ? "rebuttal" : it.ref === "1" ? "cascade" : "note",
        strength: it.ref === "4" ? "high" : "low", explanation: `Why ${it.ref}`, confidence: "confirmed",
      })) });
    }
    if (mode === "cover") return ok({ text: payload.audience === "homeowner" ? "Plain summary for you." : "Dear adjuster." });
    if (mode === "supplementItems") return ok({ items: [{ itemLabel: "Skylight", suggestedLineItem: "Replace - Skylight", justification: "Cracked glazing", confidence: "needs_info", whatToConfirm: "Photo of glazing" }] });
    if (mode === "supplementLetter") return ok({ text: "Supplement letter body" });
    return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: "bad mode" }) });
  });
}

// CRA's jest config resets mock implementations between tests; restore the bucket.
beforeEach(() => { supabase.storage.from.mockImplementation(() => supabase.storage.bucket); });

test("pasted scope: extract, analyze in batches of 3, save to job, summaries, share, supplement round + letter", async () => {
  const calls = [];
  mockServer(calls);
  const saves = [];
  render(<ScopeReview job={JOB} onSave={p => saves.push(p)} onClose={() => {}} />);

  // Claim reference prefilled from the job.
  expect(screen.getByDisplayValue("Jerome Behr — 0619-35816")).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText(/Paste the carrier's line items/), { target: { value: "1 Remove shingles" } });
  fireEvent.click(screen.getByText("Analyze scope"));

  await screen.findByText("Why 4");
  expect(calls.map(c => c.mode)).toEqual(["extract", "analyze", "analyze"]);
  expect(calls[1].payload.items).toHaveLength(3);
  expect(calls[2].payload.items).toHaveLength(1);
  expect(calls.every(c => c.jobId === JOB.id)).toBe(true);

  let reviews = saves.at(-1).scopeReviews;
  expect(reviews).toHaveLength(1);
  expect(reviews[0].results).toHaveLength(4);
  expect(reviews[0].source).toEqual({ kind: "text", text: "1 Remove shingles" });
  expect(reviews[0].shareSummaryWithHomeowner).toBe(false);

  // Leverage sort puts the high-leverage rebuttal first.
  const explanations = screen.getAllByText(/^Why \d$/).map(el => el.textContent);
  expect(explanations[0]).toBe("Why 4");

  fireEvent.click(screen.getByText("Generate homeowner summary"));
  await screen.findByText("Plain summary for you.");
  expect(saves.at(-1).scopeReviews[0].homeownerSummary).toBe("Plain summary for you.");
  expect(screen.getByText("Not visible to the homeowner until you share it.")).toBeInTheDocument();

  fireEvent.click(screen.getByText("Share with homeowner (portal)"));
  expect(saves.at(-1).scopeReviews[0].shareSummaryWithHomeowner).toBe(true);
  expect(screen.getByText("✓ Shown in customer portal")).toBeInTheDocument();
  // The share save kept the summary written by the earlier (async) step.
  expect(saves.at(-1).scopeReviews[0].homeownerSummary).toBe("Plain summary for you.");

  fireEvent.change(screen.getByPlaceholderText(/skylight above the kitchen/), { target: { value: "Skylight glazing cracked" } });
  fireEvent.click(screen.getByText("Generate supplement items"));
  await screen.findByText("Replace - Skylight");
  expect(screen.getByText(/Needs more info: Photo of glazing/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("Generate supplement letter"));
  await screen.findByText("Supplement letter body");

  reviews = saves.at(-1).scopeReviews;
  expect(reviews[0].supplements).toHaveLength(1);
  expect(reviews[0].supplements[0].letter).toBe("Supplement letter body");
  expect(reviews[0].shareSummaryWithHomeowner).toBe(true);
  expect(calls.find(c => c.mode === "supplementItems").payload.originalItems).toHaveLength(4);
});

test("regenerating the homeowner summary un-shares it until re-approved", async () => {
  mockServer([]);
  const saves = [];
  const existing = { id: "r1", createdAt: "2026-09-20T10:00:00Z", claimLabel: "Behr", source: { kind: "text", text: "x" },
    results: [{ ref: "1", itemText: "Vent", category: "cascade", strength: "high", explanation: "e", confidence: "confirmed" }],
    coverParagraph: "", homeownerSummary: "Old summary", shareSummaryWithHomeowner: true, supplements: [] };
  render(<ScopeReview job={{ ...JOB, scopeReviews: [existing] }} onSave={p => saves.push(p)} onClose={() => {}} />);
  expect(screen.getByText("✓ Shown in customer portal")).toBeInTheDocument();
  fireEvent.click(screen.getByText("↻ Homeowner summary"));
  await screen.findByText("Plain summary for you.");
  expect(saves.at(-1).scopeReviews[0]).toMatchObject({ homeownerSummary: "Plain summary for you.", shareSummaryWithHomeowner: false });
});

test("PDF path: uploads to {jobId}/{reviewId}.pdf, extracts from storage, keeps history of runs", async () => {
  const calls = [];
  mockServer(calls);
  supabase.storage.bucket.upload.mockResolvedValue({ error: null });
  const saves = [];
  const earlier = { id: "r0", createdAt: "2026-09-01T10:00:00Z", claimLabel: "First pass", source: { kind: "text", text: "x" }, results: [], supplements: [] };
  render(<ScopeReview job={{ ...JOB, scopeReviews: [earlier] }} onSave={p => saves.push(p)} onClose={() => {}} />);

  fireEvent.click(screen.getByText("+ New analysis"));
  const file = new File(["%PDF-1.4"], "estimate.pdf", { type: "application/pdf" });
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getByText(/estimate\.pdf/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("Analyze scope"));
  await screen.findByText("Why 4");

  const [path, uploaded, opts] = supabase.storage.bucket.upload.mock.calls[0];
  expect(path).toMatch(new RegExp(`^${JOB.id}/\\d+\\.pdf$`));
  expect(uploaded).toBe(file);
  expect(opts).toEqual({ contentType: "application/pdf" });
  expect(calls[0]).toMatchObject({ mode: "extractPdf", payload: { pdfPath: path } });

  const reviews = saves.at(-1).scopeReviews;
  expect(reviews.map(r => r.id)[0]).toBe("r0"); // earlier run kept
  expect(reviews).toHaveLength(2);
  expect(reviews[1].source).toEqual({ kind: "pdf", pdfPath: path, fileName: "estimate.pdf" });
});

test("failed analysis removes the uploaded PDF and shows the error, nothing saved", async () => {
  supabase.storage.bucket.upload.mockResolvedValue({ error: null });
  supabase.storage.bucket.remove.mockResolvedValue({});
  apiFetch.mockImplementation(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: "Claude is busy right now" }) }));
  const saves = [];
  render(<ScopeReview job={JOB} onSave={p => saves.push(p)} onClose={() => {}} />);
  const file = new File(["%PDF"], "e.pdf", { type: "application/pdf" });
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
  fireEvent.click(screen.getByText("Analyze scope"));
  await screen.findByText("Claude is busy right now");
  await waitFor(() => expect(supabase.storage.bucket.remove).toHaveBeenCalledTimes(1));
  expect(saves).toHaveLength(0);
});

test("rejects non-PDF and oversized files", () => {
  render(<ScopeReview job={JOB} onSave={() => {}} onClose={() => {}} />);
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [new File(["x"], "a.docx", { type: "application/msword" })] } });
  expect(screen.getByText(/doesn't look like a PDF/)).toBeInTheDocument();
  const big = new File(["x"], "big.pdf", { type: "application/pdf" });
  Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
  fireEvent.change(input, { target: { files: [big] } });
  expect(screen.getByText(/larger than 25MB/)).toBeInTheDocument();
});

const HOVER = { totalRoofArea: 1732, squares: 17.32, facets: 8, areaWithWaste: { plus10: 1905 }, pitches: [{ pitch: "6/12", area: 833, percentage: 48.09 }, { pitch: "2/12", area: 203, percentage: 11.72 }], lowSlopeArea: 203, eavesLength: 133.25, rakeLength: 130.92, dripEdgeLength: 264.17, ridgeHipLength: 64.92, valleyLength: 0, stepFlashingLength: 56.58, flashingLength: 4.58, fetchedAt: "2026-09-24T23:46:33.503Z" };
const REVIEW = { id: "r1", createdAt: "2026-09-25T10:00:00Z", claimLabel: "Lawson", source: { kind: "text", text: "x" },
  results: [{ ref: "7", itemText: "Drip edge 80 LF", category: "note", strength: "low", explanation: "e", confidence: "confirmed" }], supplements: [] };

test("coverage letter is rejected with guidance, nothing saved", async () => {
  apiFetch.mockImplementation(() => ok({ items: [{ ref: "L1", text: "Dwelling $7,349.23" }], documentType: "coverage_summary" }));
  const saves = [];
  render(<ScopeReview job={JOB} onSave={p => saves.push(p)} onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/Paste the carrier's line items/), { target: { value: "Dwelling $7,349.23" } });
  fireEvent.click(screen.getByText("Analyze scope"));
  await screen.findByText(/looks like a coverage letter or payment summary/);
  expect(apiFetch).toHaveBeenCalledTimes(1); // stopped before analyze
  expect(saves).toHaveLength(0);
});

test("measurements panel shows Hover numbers; missing measurements shows a hint", () => {
  const { unmount } = render(<ScopeReview job={{ ...JOB, hoverMeasurements: HOVER, scopeReviews: [REVIEW] }} onSave={() => {}} onClose={() => {}} />);
  expect(screen.getByText("1,732 sq ft (17.32 SQ)")).toBeInTheDocument();
  expect(screen.getByText("264.17 LF")).toBeInTheDocument();
  expect(screen.getByText("203 sq ft")).toBeInTheDocument();
  unmount();
  render(<ScopeReview job={{ ...JOB, scopeReviews: [REVIEW] }} onSave={() => {}} onClose={() => {}} />);
  expect(screen.getByText(/No Hover measurements on this job yet/)).toBeInTheDocument();
});

test("gap check sends items + site notes, saves findings, keeps earlier checks", async () => {
  const calls = [];
  apiFetch.mockImplementation((url, opts) => {
    const body = JSON.parse(opts.body); calls.push(body);
    return ok({ usedMeasurements: true, usedReferences: ["GAF starter"], findings: [
      { type: "missing", title: "Starter course missing", carrierRef: "", carrierQuantity: "", measuredQuantity: "", suggestedLineItem: "Starter 133.25 LF", justification: "j1", strength: "medium", confidence: "needs_info", whatToConfirm: "Photo of eave" },
      { type: "quantity", title: "Drip edge under-measured", carrierRef: "7", carrierQuantity: "80 LF", measuredQuantity: "133.25 + 130.92 = 264.17 LF", suggestedLineItem: "Drip edge 264.17 LF", justification: "j2", strength: "high", confidence: "confirmed", whatToConfirm: "" },
    ] });
  });
  const earlier = { id: "g0", createdAt: "2026-09-24T10:00:00Z", fieldNotes: "", usedMeasurements: false, usedReferences: [], findings: [] };
  const saves = [];
  render(<ScopeReview job={{ ...JOB, hoverMeasurements: HOVER, scopeReviews: [{ ...REVIEW, gapChecks: [earlier] }] }} onSave={p => saves.push(p)} onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/2 layers of shingles/), { target: { value: "2 layers on garage" } });
  fireEvent.click(screen.getByText("↻ Run gap check again"));
  await screen.findByText("Drip edge under-measured");
  expect(calls[0]).toMatchObject({ mode: "gapCheck", jobId: JOB.id, payload: { items: [{ ref: "7", itemText: "Drip edge 80 LF" }], fieldNotes: "2 layers on garage" } });
  const checks = saves.at(-1).scopeReviews[0].gapChecks;
  expect(checks).toHaveLength(2);
  expect(checks[1].findings.map(f => f.title)).toEqual(["Drip edge under-measured", "Starter course missing"]); // high leverage first
  expect(checks[1].fieldNotes).toBe("2 layers on garage");
  expect(screen.getByText("133.25 + 130.92 = 264.17 LF")).toBeInTheDocument();
  expect(screen.getByText(/Needs more info: Photo of eave/)).toBeInTheDocument();
});

test("reference library loads and saves to reserved row -3", async () => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const maybeSingle = jest.fn().mockResolvedValue({ data: { data: { references: [{ title: "Old", source: "s", text: "t" }] } }, error: null });
  supabase.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }), upsert }));
  render(<ScopeReview job={{ ...JOB, scopeReviews: [REVIEW] }} onSave={() => {}} onClose={() => {}} />);
  fireEvent.click(screen.getByText("📚 References"));
  await screen.findByDisplayValue("Old");
  fireEvent.click(screen.getByText("+ Add reference"));
  const titles = screen.getAllByPlaceholderText(/^Title/);
  fireEvent.change(titles[1], { target: { value: "GAF starter" } });
  fireEvent.change(screen.getAllByPlaceholderText("Exact wording…")[1], { target: { value: "Starter required at eaves." } });
  fireEvent.click(screen.getByText("💾 Save"));
  await screen.findByText("✓ Saved");
  const [rows, opts] = upsert.mock.calls[0];
  expect(opts).toEqual({ onConflict: "job_id" });
  expect(rows[0]).toMatchObject({ job_id: -3, user_email: "config" });
  expect(rows[0].data.references).toEqual([{ title: "Old", source: "s", text: "t" }, { title: "GAF starter", source: "", text: "Starter required at eaves." }]);
});
