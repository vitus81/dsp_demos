import { Link } from "react-router-dom";
import { demoRegistry } from "../demos/demoRegistry";

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

      <div className="demo-grid" aria-label="Available DSP demos">
        {demoRegistry.map((demo) => (
          <Link className="demo-card" key={demo.id} to={`/demo/${demo.id}`}>
            <span className="demo-category">{demo.category}</span>
            <h2>{demo.title}</h2>
            <p>{demo.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
