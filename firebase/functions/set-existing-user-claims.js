// One-time migration for Firebase users created before the onCreate trigger.
// Run from firebase/functions after `npm install` using an account with Firebase Admin access.
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
initializeApp();

async function main() {
  let nextPageToken;
  do {
    const page = await getAuth().listUsers(1000, nextPageToken);
    for (const user of page.users) {
      await getAuth().setCustomUserClaims(user.uid, {
        ...(user.customClaims || {}),
        role: "authenticated",
      });
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  console.log("Updated Firebase users with the Supabase authenticated claim.");
}
main().catch((error) => { console.error(error); process.exit(1); });
