import { destroyAuthToken } from "@/lib/espo/auth";
import { destroySession, getCredentials, getSession } from "@/lib/espo/session";

export async function POST(): Promise<Response> {
  const session = await getSession();
  const credentials = getCredentials(session);

  if (credentials) {
    await destroyAuthToken(credentials);
  }

  await destroySession(session);

  return Response.json({ status: "success" });
}
