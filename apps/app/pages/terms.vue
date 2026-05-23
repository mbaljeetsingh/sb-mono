<script setup lang="ts">
useSeoMeta({
  title: "Terms of Service · Scoreboard",
  description:
    "The terms that govern your use of Scoreboard at scoreboard.beejaysoft.com.",
});

const lastUpdated = "2026-05-22";
const contact = "scoreboard@beejaysoft.com";
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-10 sm:py-16">
    <header class="mb-10">
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
        Terms of Service
      </h1>
      <p class="mt-2 text-sm text-fg-muted">Last updated: {{ lastUpdated }}</p>
    </header>

    <article
      class="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h2:mt-10 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-base"
    >
      <h2>1. Acceptance of terms</h2>
      <p>
        By accessing or using Scoreboard at
        <code>scoreboard.beejaysoft.com</code> (“the Service”) you agree to be
        bound by these Terms of Service. If you do not agree, do not use the
        Service.
      </p>
      <p>
        Scoreboard is operated by BeeJaySoft, based in India. The Service is
        provided free of charge during this stage of development.
      </p>

      <h2>2. Description of the Service</h2>
      <p>
        Scoreboard is a free, open-source live-scoring tool for racquet sports
        (badminton, tennis, pickleball, table tennis). It lets you score matches
        from a phone or laptop, share live scoreboards via URL, and stream
        broadcast-quality overlays in OBS or similar tools.
      </p>
      <p>
        You can use Scoreboard either anonymously (no account required) or with
        a free account that lets you keep a history of your matches.
      </p>

      <h2>3. Accounts</h2>
      <p>
        If you create an account, you are responsible for keeping your password
        secure and for activity that happens under your account. Notify us
        promptly at
        <a :href="`mailto:${contact}`">{{ contact }}</a> if you suspect
        unauthorized access.
      </p>
      <p>
        You may delete your account at any time from your profile page. Deleting
        your account removes the matches you own.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use the Service to harass, threaten, defame, or harm others, or to
          publish material that does any of these.
        </li>
        <li>
          Upload content (team names, player names, sponsor logos, etc.) that
          you do not have the right to use, or that infringes anyone’s
          intellectual-property, privacy, or publicity rights.
        </li>
        <li>
          Attempt to disrupt, overload, or probe the Service for vulnerabilities
          without prior authorization.
        </li>
        <li>
          Use automated scraping, crawling, or scripting that creates
          unreasonable load.
        </li>
        <li>Use the Service to violate any applicable law or regulation.</li>
      </ul>

      <h2>5. Anonymous matches</h2>
      <p>
        Matches created without an account are protected only by the secrecy of
        their URL — anyone with the link can view the scoreboard and, for the
        control URL, score points on it. Do not share the control URL with
        people you don’t trust to score honestly.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        You retain ownership of the match content you create (team names,
        scores, tournament metadata, any sponsor assets you upload). By making a
        match URL public you grant us a non-exclusive, royalty-free license to
        display that content to anyone with the URL, solely as needed to operate
        the Service.
      </p>
      <p>
        The Scoreboard source code is released under the MIT License. The name
        “Scoreboard,” the logo, and the visual design of the hosted service are
        owned by BeeJaySoft.
      </p>

      <h2>7. Open source &amp; self-hosting</h2>
      <p>
        Scoreboard is available under the MIT License at
        <a href="https://github.com/mbaljeetsingh/sb-mono" target="_blank"
          >github.com/mbaljeetsingh/sb-mono</a
        >. You are free to self-host the software. These Terms apply only to the
        hosted instance at <code>scoreboard.beejaysoft.com</code>; self-hosted
        deployments are governed solely by the MIT License.
      </p>

      <h2>8. No warranty</h2>
      <p>
        The Service is provided <strong>“as is” and “as available”</strong>
        without warranties of any kind, either express or implied, including
        fitness for a particular purpose, accuracy of scores, or uninterrupted
        availability. Treat live scoring on Scoreboard as best-effort, not as an
        official referee’s record.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, BeeJaySoft shall not be liable
        for any indirect, incidental, special, consequential, or punitive
        damages, or any loss of profits, data, goodwill, or other intangible
        losses, resulting from your use of or inability to use the Service.
      </p>

      <h2>10. Termination</h2>
      <p>
        We may suspend or terminate access to the Service (in whole or for a
        specific account) if we reasonably believe these Terms have been
        violated, or if continuing to operate becomes impractical. Where
        possible we will give notice.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of India, without regard to its
        conflict-of-law provisions. Disputes shall be subject to the
        jurisdiction of the courts of Punjab, India.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms as the Service evolves. The “Last updated”
        date at the top reflects the most recent change. Continued use after a
        change means you accept the updated Terms.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms? Email
        <a :href="`mailto:${contact}`">{{ contact }}</a
        >.
      </p>
    </article>
  </main>
</template>
