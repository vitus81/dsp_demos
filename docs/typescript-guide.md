# TypeScript Guide for the DSP Demo Platform

This project uses TypeScript because the app is meant to grow from one RRC demo
into a reusable DSP demo platform. TypeScript makes the shape of data explicit:
which parameters a simulation expects, what a signal contains, and which fields a
demo must expose to appear in the catalog.

## TypeScript vs JavaScript

TypeScript is JavaScript with a type checker. The browser still runs JavaScript,
but the project is checked before it is built.

Useful consequences:

- passing the wrong parameter name is caught earlier;
- signal objects are easier to understand from their type;
- future demos can reuse shared DSP utilities with less guesswork.

Tradeoff:

- there is a build step;
- some code is a little more verbose;
- TypeScript does not make floating-point math more accurate by itself.

## Basic Types Used Here

`number` is the normal JavaScript floating-point type. It is used for scalar
values such as roll-off, sample rate, and symbol count.

```ts
const rolloff: number = 0.35;
```

`Array<number>` is a flexible JavaScript array. It is convenient for UI data or
small lists, but it has more overhead than a typed array.

```ts
const timeAxis: Array<number> = [0, 0.125, 0.25];
```

`Float64Array` is a typed array of 64-bit floating-point samples. It is a good
fit for DSP buffers because it is compact, predictable, and close to how numeric
arrays are represented in scientific code.

```ts
const samples = new Float64Array(1024);
```

## Important Project Types

Shared DSP types live in `src/shared/dsp/types.ts`.

```ts
export type ComplexSample = {
  i: number;
  q: number;
};

export type ComplexSignal = {
  i: Float64Array;
  q: Float64Array;
  sampleRate: number;
};
```

The `type` keyword describes the shape of an object. For example, a
`ComplexSample` must have an `i` and a `q` value. TypeScript will complain if a
function expects `ComplexSample` and receives an object missing one of those
fields.

## How the App Is Organized

The app has three main areas:

- `src/app`: routing, catalog, and page shell;
- `src/demos`: demo registry and individual demo modules;
- `src/shared`: reusable DSP, plotting, and UI helpers.

The first demo is registered in `src/demos/demoRegistry.ts`. A future demo should
add one new entry there and provide its own React component.

```ts
{
  id: "rrc-rolloff",
  title: "RRC Roll-Off Explorer",
  category: "Digital Communications",
  description: "...",
  component: RrcRollOffDemo,
}
```

## Reading a React TypeScript Component

React components are functions that return UI.

```tsx
export function RrcRollOffDemo() {
  const [params, setParams] = useState({ rolloff: 0.35 });
  return <div>{params.rolloff}</div>;
}
```

`useState` stores interactive state. In the RRC demo, sliders update `params`;
`useMemo` recalculates the DSP simulation when those parameters change.

```tsx
const simulation = useMemo(() => runRrcSimulation(params), [params]);
```

That line means: run the simulation again only when `params` changes.

## How the RRC Demo Works

The RRC demo follows a small transmit chain:

1. Generate reproducible QPSK symbols.
2. Oversample them by inserting zeros between symbols.
3. Create a root raised cosine filter.
4. Convolve I and Q branches with the filter.
5. Build plots from the resulting arrays.

The core DSP functions are intentionally small:

- `generateQpskSymbols`
- `oversampleSymbols`
- `createRrcFilter`
- `convolve`
- `buildEyeDiagram`
- `computeSpectrumDb`

This makes them easier to test and easier to reuse in later demos.

## Adding a New Demo

For a new demo:

1. Create a folder under `src/demos`, for example `src/demos/fft`.
2. Add a React component such as `FftWindowDemo.tsx`.
3. Reuse helpers from `src/shared` where possible.
4. Add the demo to `demoRegistry`.
5. Add focused tests for the DSP logic and a smoke test for the UI.

Keep the first version specific and readable. Add a shared abstraction only when
two or more demos need the same behavior.
