# DSP Demo Platform

Interactive DSP demos for advanced didactic exploration. The first module is an
RRC roll-off explorer for QPSK pulse shaping, IQ samples, spectrum, and eye
diagram.

## Requirements

- Node.js with npm available in the terminal PATH

## Commands

```powershell
npm install
npm run dev
npm test
npm run build
```

The app is organized as a small platform:

- `src/app`: app shell, catalog, and demo routes;
- `src/demos`: demo registry and individual demos;
- `src/shared`: reusable DSP, plotting, and UI helpers;
- `docs/typescript-guide.md`: project-specific TypeScript guide.
