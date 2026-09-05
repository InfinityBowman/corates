// Public API addresses carry ORCID's own verification flag; only verified ones count

interface OrcidPublicEmailResponse {
  email?: Array<{ email?: string; verified?: boolean; primary?: boolean; visibility?: string }>;
}

export async function fetchOrcidPublicEmail(
  orcidId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(`https://pub.orcid.org/v3.0/${orcidId}/email`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as OrcidPublicEmailResponse;
    const verified = (data.email ?? []).filter(entry => entry.verified && entry.email);
    const chosen = verified.find(entry => entry.primary) ?? verified[0];
    return chosen?.email?.trim().toLowerCase() || null;
  } catch {
    // Onboarding collects an email if the public API is unavailable
    return null;
  }
}
