import { ChatbotPanel } from "../components/ChatbotPanel";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Module 5 - Analytics & AI</p>
          <h1>Search, booking help, and policy answers without invented data.</h1>
          <p className="lead">
            This page gives the search and booking flows a chatbot panel. Trip and booking answers go through
            internal tools, while cancellation and check-in answers cite internal policy resources.
          </p>

          <div className="demo-grid">
            <article className="demo-card">
              <h2>Search flow</h2>
              <p>Use searchTrips through the GraphQL Gateway. Empty or offline services return a clear tool error.</p>
            </article>
            <article className="demo-card">
              <h2>Booking flow</h2>
              <p>Booking lookup requires both booking code and email before any private status is requested.</p>
            </article>
          </div>
        </div>

        <ChatbotPanel />
      </section>
    </main>
  );
}
