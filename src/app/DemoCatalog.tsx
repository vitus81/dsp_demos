import { Link } from "react-router-dom";
import { demoRegistry } from "../demos/demoRegistry";

const demoCategories = [
  "Filtering and sample rate conversion",
  "Digital communications",
  "Live spectral analysis",
];

export function DemoCatalog() {
  return (
    <section className="catalog-page">
      <div className="page-heading">
        <p className="eyebrow">Catalog</p>
        <h1>DSP demos for advanced visual intuition</h1>
        <p>
          Each demo is a small interactive lab: concrete parameters, visible
          signal consequences, and enough math to keep the intuition honest.
        </p>
      </div>

      <div className="catalog-sections" aria-label="Available DSP demos">
        {demoCategories.map((category) => {
          const demos = demoRegistry.filter((demo) => demo.category === category);

          return (
            <section className="catalog-section" key={category}>
              <h2 className="catalog-section-title">{category}</h2>
              <div className="demo-grid">
                {demos.map((demo) => (
                  <Link className="demo-card" key={demo.id} to={`/demo/${demo.id}`}>
                    <span className="demo-category">{demo.category}</span>
                    <h3>{demo.title}</h3>
                    <p>{demo.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
