import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { clubAction, savedClubs } from "@/lib/clubs";
export const Route = createFileRoute("/clubs")({
  head: () => ({ meta: [{ title: "Your film clubs — Watch Together" }] }),
  component: Clubs,
});
function Clubs() {
  const nav = useNavigate();
  const [clubs, setClubs] = useState<ReturnType<typeof savedClubs>>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setClubs(savedClubs()), []);
  return (
    <main className="club-site club-directory">
      <header className="club-nav">
        <Link to="/" className="club-wordmark">
          watch <em>together</em>
        </Link>
        <Link to="/">Back to the lobby</Link>
      </header>
      <section className="club-directory-intro">
        <p>A standing invitation.</p>
        <h1>Your film clubs.</h1>
        <p>
          A shared shelf, a regular screening, the same familiar faces. Clubs have their own
          reusable invite link.
        </p>
      </section>
      <div className="club-directory-grid">
        <section>
          <h2>On this browser</h2>
          {!clubs.length && (
            <p className="feature-muted">Clubs you create or visit will appear here.</p>
          )}
          {clubs.map((club) => (
            <Link
              key={club.id}
              to="/club/$id"
              params={{ id: club.id }}
              className="club-directory-link"
            >
              <span>
                {club.name}
                <small>{club.ownerSecret ? "You host this club" : "Member link saved"}</small>
              </span>
              <ArrowRight size={18} />
            </Link>
          ))}
        </section>
        <section className="club-create-card">
          <h2>Start a club.</h2>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const club = await clubAction(null, { type: "create", name });
                void nav({ to: "/club/$id", params: { id: club.id } });
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not create club.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="club-name">Club name</label>
            <input
              id="club-name"
              required
              maxLength={60}
              placeholder="The Sunday Matinee"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="club-submit" disabled={busy}>
              {busy ? "Opening…" : "Create film club"}
              <Plus size={16} />
            </button>
            {error && <p role="alert">{error}</p>}
          </form>
          <p className="feature-muted">
            No account required. Keep your host key safe; the invite link gives friends access to
            your club.
          </p>
        </section>
      </div>
      <footer className="club-footer">
        <p>Good company, on repeat.</p>
        <Link to="/">Watch something tonight →</Link>
      </footer>
    </main>
  );
}
