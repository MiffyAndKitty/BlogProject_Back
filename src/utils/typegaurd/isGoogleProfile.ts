export function isGoogleProfile(profile: any): boolean {
  return (
    typeof profile === 'object' &&
    'emails' in profile &&
    Array.isArray(profile.emails) &&
    profile.emails.length > 0 &&
    'value' in profile.emails[0] &&
    typeof profile.emails[0].value === 'string' &&
    'name' in profile &&
    typeof profile.name === 'object' &&
    profile.name &&
    'familyName' in profile.name &&
    typeof profile.name.familyName === 'string'
  );
}
