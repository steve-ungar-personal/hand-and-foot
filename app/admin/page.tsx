import Link from "next/link";

export default function AdminPage() {
  return (
    <>
      <h1>Admin</h1>
      <Link href="/teams" className="card link">
        <strong>Teams</strong>
        <div className="small muted">Add, rename, edit and delete saved teams.</div>
      </Link>
      <Link href="/leagues" className="card link">
        <strong>Leagues &amp; scoring rules</strong>
        <div className="small muted">Add, rename and delete leagues, and set each league&apos;s scoring.</div>
      </Link>
    </>
  );
}
