# Reliability: Manual → Autopilot

**Levels of Service Reliability Automation** — an interactive [Slidev](https://sli.dev)
deck by [Severin Neumann](https://github.com/svrnm).

> "AI SRE" today usually means an LLM bolted onto on-call — reactive troubleshooting
> with humans nudged in or out of the loop. But reliability spans the whole lifecycle:
> building resilient software, resource and release management, operations. Borrowing
> SAE's "levels of driving automation," this talk lays out a ladder from manual toil to
> full autonomy, so you can see where your team really stands and where AI actually
> helps (and where it doesn't).

The deck reflects the current state of a CNCF white paper draft. Contributors welcome.

## Running it locally

```bash
npm install
npm run dev      # opens the deck at http://localhost:3030
```

Other scripts:

```bash
npm run build    # static build into dist/
npm run export   # export to PDF
```

## Layout

| Path | What's in it |
| --- | --- |
| `slides.md` | The deck itself |
| `components/` | Interactive Vue components (the driving demo, the levels grid, the ladder) |
| `data.ts` | The levels and domains model shared across components |
| `style.css` | Theme and brand tokens |
| `OUTLINE.md` | Long-form speaker outline the deck was built from |
| `ABSTRACT.md` | Talk abstract |

## License

Dual-licensed:

- **Content** (`slides.md`, `OUTLINE.md`, `ABSTRACT.md`, prose) — [CC BY 4.0](LICENSE)
- **Code** (`components/`, `data.ts`, `style.css`, config) — [MIT](LICENSE-CODE)

**Trademarks and logos are excluded from both licenses.** The Bronto marks and
dinosaur artwork, and the AWS, GitHub and Kubernetes logos, belong to their
respective owners — if you reuse this material you must remove or replace them.
See [NOTICE](NOTICE) for the full list and disclaimer.
