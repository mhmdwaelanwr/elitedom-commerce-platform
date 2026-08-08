import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="clean-room">
      <div className="clean-room__content">
        <p className="clean-room__eyebrow">404 / Route not found</p>
        <h1 className="clean-room__title">Nothing here.</h1>
        <p className="clean-room__text">The requested Elitedom route does not exist.</p>
        <Link className="clean-room__link" to="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
