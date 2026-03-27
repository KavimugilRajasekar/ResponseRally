import { prisma } from '../config/db.js';

export type SSOResult =
  | { status: 'ok'; userId: string }
  | { status: 'unauthorized' }
  | { status: 'not_onboarded' };

/**
 * Validate the tyn_session cookie against TYN server and map the returned
 * email to a local ResponseRally user.
 */
export async function validateSSO(cookieHeader: string): Promise<SSOResult> {
  const SSO_VALIDATE_URL = process.env.SSO_VALIDATE_URL || 'http://localhost:8000/api/sso/me/';
  const SSO_COOKIE_NAME = process.env.SSO_COOKIE_NAME || 'tyn_session';

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SSO_COOKIE_NAME}=([^;]+)`));
  const sessionCookie = match ? match[1] : null;
  if (!sessionCookie) return { status: 'unauthorized' };

  try {
    const ssoRes = await fetch(SSO_VALIDATE_URL, {
      headers: { Cookie: `${SSO_COOKIE_NAME}=${sessionCookie}` }
    });

    if (!ssoRes.ok) return { status: 'unauthorized' };

    const data = await ssoRes.json() as { email?: string };
    if (!data.email) return { status: 'unauthorized' };

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return { status: 'not_onboarded' };

    return { status: 'ok', userId: user.id };
  } catch {
    return { status: 'unauthorized' };
  }
}
