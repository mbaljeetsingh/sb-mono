<script setup lang="ts">
useSeoMeta({
  title: "Privacy Policy · Scoreboard",
  description:
    "How Scoreboard handles your data — what we collect, what we don't, and the third parties we rely on.",
});

const lastUpdated = "2026-05-22";
const contact = "scoreboard@beejaysoft.com";
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-10 sm:py-16">
    <header class="mb-10">
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
        Privacy Policy
      </h1>
      <p class="mt-2 text-sm text-fg-muted">Last updated: {{ lastUpdated }}</p>
    </header>

    <article
      class="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h2:mt-10 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-base"
    >
      <h2>1. Introduction</h2>
      <p>
        Scoreboard (“the Service”) is a free, open-source live-scoring tool for
        racquet sports. This Privacy Policy explains what data we collect when
        you use Scoreboard at
        <code>scoreboard.baljeetsingh.in</code>, why we collect it, and how it
        is handled.
      </p>
      <p>
        Scoreboard is operated by BeeJaySoft, based in India. The source code is
        MIT-licensed and self-hostable; if you self-host, this policy describes
        only the hosted instance at the URL above.
      </p>

      <h2>2. Information we collect</h2>

      <h3>Anonymous scoring</h3>
      <p>
        You can score a match without creating an account. In that mode we
        collect:
      </p>
      <ul>
        <li>
          The match data you enter (team names, scores, player names, tournament
          metadata) — stored in our database against an unguessable match ID.
        </li>
        <li>
          A stable per-browser identifier (<code>sb:device-id</code>) we
          generate locally and attach to events for provenance and conflict
          resolution. It is not linked to you personally.
        </li>
        <li>
          Standard server logs (IP address, user-agent, request path) retained
          by our hosting providers for short periods for abuse prevention and
          debugging.
        </li>
      </ul>

      <h3>When you sign in</h3>
      <p>If you create an account we additionally collect:</p>
      <ul>
        <li>
          Your email address, display name, and (optionally) an avatar image.
        </li>
        <li>
          The match rows you own, so we can show your history and let you delete
          it.
        </li>
      </ul>

      <h3>Product analytics &amp; error tracking</h3>
      <p>
        We use <strong>PostHog</strong> for product analytics, error tracking,
        and (rarely) session replay to fix specific bugs. PostHog records
        anonymous interaction events (page views, button clicks, error stack
        traces) and a randomized identifier. We do not pass your email or match
        content to PostHog.
      </p>

      <h2>3. How we use the information</h2>
      <ul>
        <li>
          To operate the Service — render scoreboards, sync events across
          devices, and let you retrieve past matches.
        </li>
        <li>To debug crashes and improve reliability via error reports.</li>
        <li>
          To understand which features are used so we can prioritize what to
          build next.
        </li>
        <li>
          To communicate with you about your account if you’ve signed in
          (password resets, security notices).
        </li>
      </ul>
      <p>
        We do <strong>not</strong> sell your data, run third-party advertising
        on the Service, or build advertising profiles.
      </p>

      <h2>4. Third parties we rely on</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — Postgres database, authentication,
          realtime sync, and file storage. Your account email, match data, and
          uploaded avatar live here.
        </li>
        <li>
          <strong>PostHog</strong> — anonymous product analytics and error
          tracking.
        </li>
        <li>
          <strong>Netlify / Vercel</strong> (or similar) — static hosting for
          the application bundle. Server logs are retained per their policies.
        </li>
      </ul>
      <p>
        These providers process data only on our instructions and only to
        deliver the Service.
      </p>

      <h2>5. Data retention</h2>
      <ul>
        <li>
          <strong>Anonymous matches</strong> with zero events are automatically
          deleted after a short window so abandoned sessions don’t accumulate.
        </li>
        <li>
          <strong>Anonymous matches with events</strong> are retained until you
          delete them or until the device that created them is wiped. They are
          not pruned on a fixed schedule today; that may change as the database
          grows.
        </li>
        <li>
          <strong>Account-owned matches</strong> are retained until you delete
          them or delete your account.
        </li>
      </ul>

      <h2>6. Your rights</h2>
      <p>
        You can request to access, correct, export, or delete the personal data
        we hold about you by emailing
        <a :href="`mailto:${contact}`">{{ contact }}</a
        >. If you have an account, you can also delete it from your profile
        page; that removes your owned matches.
      </p>
      <p>
        If you are in the EU/UK (GDPR) or India (DPDP Act) you have specific
        statutory rights, including the right to lodge a complaint with your
        data-protection authority.
      </p>

      <h2>7. Cookies and local storage</h2>
      <p>Scoreboard uses:</p>
      <ul>
        <li>
          <strong>IndexedDB</strong> on your device to store the match event log
          so scoring works through flaky WiFi.
        </li>
        <li>
          <strong>localStorage</strong> for small preferences (theme, control
          layout, device id).
        </li>
        <li>
          A first-party <strong>Supabase auth cookie</strong> when you sign in.
        </li>
      </ul>
      <p>
        We do not use third-party advertising cookies. PostHog uses local
        identifiers but no advertising cookies.
      </p>

      <h2>8. Children’s privacy</h2>
      <p>
        Scoreboard is not directed at children under 13. We do not knowingly
        collect personal information from children. Contact us if you believe a
        child has provided personal data without consent.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy as the Service evolves. The “Last updated”
        date at the top reflects the most recent change. Material changes will
        be highlighted on the home page or via email if you have an account.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions or requests? Email
        <a :href="`mailto:${contact}`">{{ contact }}</a
        >.
      </p>
    </article>
  </main>
</template>
