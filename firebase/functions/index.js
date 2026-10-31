const functions = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

// Firebase Auth's production 1st-gen onCreate trigger sets the claim required
// for Supabase's third-party Firebase JWT integration. This is NOT an admin role.
exports.assignSupabaseAuthenticatedRole = functions.auth.user().onCreate(async (user) => {
  if (!user?.uid) return;
  await getAuth().setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    role: "authenticated",
  });
});
