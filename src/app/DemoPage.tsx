import { Link, Navigate, useParams } from "react-router-dom";
import { getDemoById } from "../demos/demoRegistry";

export function DemoPage() {
  const { demoId } = useParams();
  const demo = demoId ? getDemoById(demoId) : undefined;

  if (!demo) {
    return <Navigate to="/" replace />;
  }

  const DemoComponent = demo.component;

  return (
    <section className="demo-page">
      <Link className="back-link" to="/">
        Back to catalog
      </Link>
      <DemoComponent />
    </section>
  );
}
