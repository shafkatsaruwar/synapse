import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page prose">
      <p className="eyebrow">404</p>
      <h1>That page is not here.</h1>
      <p>
        <Link href="/">Back to Synapse</Link>
      </p>
    </div>
  );
}
