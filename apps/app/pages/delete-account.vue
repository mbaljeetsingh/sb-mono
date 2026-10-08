<script setup lang="ts">
/**
 * Public account-deletion page. Google Play's Data safety form requires a
 * deletion URL that loads without installing the app, so it can't sit behind
 * sign-in. Documents the in-app path (profile → Delete account, see
 * components/profile/DeleteAccountCard.vue) plus an email fallback. Ported
 * from np-mono's apps/web/app/pages/delete-account.vue.
 */
useSeoMeta({
  title: 'Delete your account · Scoreboard',
  description:
    'How to permanently delete your Scoreboard account and what happens to your data.',
  // Not a marketing page: reachable for Play, kept out of search results.
  robots: 'noindex, follow',
});

const contact = 'scoreboard@beejaysoft.com';
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-10 sm:py-16">
    <header class="mb-10">
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
        Delete your account
      </h1>
      <p class="mt-2 text-fg-muted">
        You can permanently delete your Scoreboard account at any time, from the
        app or by email.
      </p>
    </header>

    <article
      class="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h2:mt-10 prose-h2:text-xl"
    >
      <h2>From the app</h2>
      <ol>
        <li>Open Scoreboard and sign in</li>
        <li>Go to your <strong>Profile</strong></li>
        <li>Scroll to <strong>Delete account</strong></li>
        <li>Type <strong>DELETE</strong> to confirm</li>
      </ol>
      <p>
        Or open
        <a href="https://scoreboard.beejaysoft.com/profile"
          >scoreboard.beejaysoft.com/profile</a
        >
        in a browser.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your profile, photo and sign-in</li>
        <li>Every match you own, with its scores</li>
        <li>Shared overlay and scoreboard links for those matches</li>
        <li>Player names saved on the device you delete from</li>
      </ul>

      <h2>What is kept</h2>
      <p>
        Matches scored without signing in aren't linked to any account, so
        deleting an account doesn't remove them. If you'd like one removed,
        email us its link and we will delete it.
      </p>

      <h2>By email</h2>
      <p>
        If you can't sign in, email
        <a :href="`mailto:${contact}`">{{ contact }}</a>
        from the address on your account with the subject
        <strong>Delete my account</strong>. We will confirm and delete it within
        30 days.
      </p>
    </article>
  </main>
</template>
